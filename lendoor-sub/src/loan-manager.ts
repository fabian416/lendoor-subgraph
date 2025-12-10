import { BigInt, Bytes } from "@graphprotocol/graph-ts"

import {
  LoanOpened as LoanOpenedEvent,
  LoanClosed as LoanClosedEvent,
  LoanDefaulted as LoanDefaultedEvent, // si lo usás en yaml
} from "../generated/LoanManager/LoanManager"

import {
  ProtocolStat,
  DailyProtocolStat,
  Borrower,
  ActiveLoan,
  LoanActivity,
} from "../generated/schema"

// ----------------- helpers -----------------

const SECONDS_PER_DAY = 86400

function buildIdFromEvent(prefix: string, txHash: Bytes, logIndex: BigInt): string {
  return prefix + "-" + txHash.toHex() + "-" + logIndex.toString()
}

function dayStartTimestamp(ts: BigInt): BigInt {
  return ts.div(BigInt.fromI32(SECONDS_PER_DAY)).times(BigInt.fromI32(SECONDS_PER_DAY))
}

function dayId(ts: BigInt): string {
  return dayStartTimestamp(ts).toString()
}

function getDailyStat(ts: BigInt): DailyProtocolStat {
  const id = dayId(ts)
  let daily = DailyProtocolStat.load(id)

  if (daily == null) {
    daily = new DailyProtocolStat(id)
    daily.dayStart = dayStartTimestamp(ts)

    daily.loansOriginated = BigInt.fromI32(0)
    daily.uniqueBorrowers = BigInt.fromI32(0)

    daily.principalOriginated = BigInt.fromI32(0)
    daily.principalRepaid = BigInt.fromI32(0)
    daily.interestRepaid = BigInt.fromI32(0)

    daily.lastUpdated = ts
  }

  return daily as DailyProtocolStat
}

function getProtocolStat(): ProtocolStat {
  let stat = ProtocolStat.load("global")

  if (stat == null) {
    stat = new ProtocolStat("global")

    stat.loansOriginated = BigInt.fromI32(0)
    stat.uniqueBorrowers = BigInt.fromI32(0)

    stat.principalOriginated = BigInt.fromI32(0)
    stat.principalRepaid = BigInt.fromI32(0)
    stat.interestRepaid = BigInt.fromI32(0)

    stat.lastUpdated = BigInt.fromI32(0)
  }

  return stat as ProtocolStat
}

// ----------------- handlers -----------------

/**
 * LoanOpened(indexed address user, uint256 principal, uint256 amountDue, uint64 due, uint16 feeBps, uint32 gracePeriod)
 * (firma según tu ABI generado)
 */
export function handleLoanOpened(event: LoanOpenedEvent): void {
  let stat = getProtocolStat()
  let daily = getDailyStat(event.block.timestamp)

  // ---- counters ----
  stat.loansOriginated = stat.loansOriginated.plus(BigInt.fromI32(1))
  daily.loansOriginated = daily.loansOriginated.plus(BigInt.fromI32(1))

  // ---- principal real originated ----
  stat.principalOriginated = stat.principalOriginated.plus(event.params.principal)
  daily.principalOriginated = daily.principalOriginated.plus(event.params.principal)

  // ---- unique borrowers ----
  let borrowerId = event.params.user.toHexString()
  let borrower = Borrower.load(borrowerId)

  if (borrower == null) {
    borrower = new Borrower(borrowerId)
    borrower.firstSeen = event.block.timestamp
    borrower.save()

    stat.uniqueBorrowers = stat.uniqueBorrowers.plus(BigInt.fromI32(1))
    daily.uniqueBorrowers = daily.uniqueBorrowers.plus(BigInt.fromI32(1))
  }

  // ---- ActiveLoan state ----
  let loan = ActiveLoan.load(borrowerId)
  if (loan == null) {
    loan = new ActiveLoan(borrowerId)
  }

  loan.principal = event.params.principal
  loan.amountDue = event.params.amountDue

  // estos son opcionales/nullable en schema
  // OJO: feeBps es Int en schema (i32).
  // Si tu codegen lo genera como i32, esto está OK.
  // Si lo genera como BigInt, cambialo a: event.params.feeBps.toI32()
  loan.feeBps = event.params.feeBps

  loan.start = event.block.timestamp
  loan.due = event.params.due
  loan.active = true

  loan.save()

  // ---- LoanActivity feed ----
  let actId = buildIdFromEvent("lm-open", event.transaction.hash, event.logIndex)
  let act = new LoanActivity(actId)
  act.type = "OPEN"
  act.borrower = event.params.user
  act.principal = event.params.principal
  act.amountDue = event.params.amountDue

  act.txHash = event.transaction.hash
  act.logIndex = event.logIndex
  act.blockNumber = event.block.number
  act.blockTimestamp = event.block.timestamp

  act.save()

  // ---- finalize ----
  stat.lastUpdated = event.block.timestamp
  daily.lastUpdated = event.block.timestamp

  stat.save()
  daily.save()
}

/**
 * LoanClosed(indexed address user, uint256 paid)
 */
export function handleLoanClosed(event: LoanClosedEvent): void {
  let stat = getProtocolStat()
  let daily = getDailyStat(event.block.timestamp)

  let borrowerId = event.params.user.toHexString()
  let loan = ActiveLoan.load(borrowerId)

  let principal = loan ? loan.principal : BigInt.fromI32(0)
  let paid = event.params.paid

  // interest real best-effort:
  // interest = paid - principal (no negativo)
  let interest = BigInt.fromI32(0)
  if (paid.gt(principal)) {
    interest = paid.minus(principal)
  }

  // ---- accumulate principal/interest repaid ----
  stat.principalRepaid = stat.principalRepaid.plus(principal)
  daily.principalRepaid = daily.principalRepaid.plus(principal)

  stat.interestRepaid = stat.interestRepaid.plus(interest)
  daily.interestRepaid = daily.interestRepaid.plus(interest)

  // ---- close ActiveLoan ----
  if (loan != null) {
    loan.active = false
    loan.save()
  }

  // ---- LoanActivity feed ----
  let actId = buildIdFromEvent("lm-close", event.transaction.hash, event.logIndex)
  let act = new LoanActivity(actId)
  act.type = "CLOSE"
  act.borrower = event.params.user
  act.paid = paid
  act.principal = principal
  act.interest = interest

  act.txHash = event.transaction.hash
  act.logIndex = event.logIndex
  act.blockNumber = event.block.number
  act.blockTimestamp = event.block.timestamp

  act.save()

  // ---- finalize ----
  stat.lastUpdated = event.block.timestamp
  daily.lastUpdated = event.block.timestamp

  stat.save()
  daily.save()
}

/**
 * LoanDefaulted(indexed address user, uint256 debt)
 * Si lo querés mostrar en el feed.
 * (Ajustá el nombre del param si tu ABI lo llama distinto)
 */
export function handleLoanDefaulted(event: LoanDefaultedEvent): void {
  let borrowerId = event.params.user.toHexString()
  let loan = ActiveLoan.load(borrowerId)

  if (loan != null) {
    loan.active = false
    loan.save()
  }

  let actId = buildIdFromEvent("lm-default", event.transaction.hash, event.logIndex)
  let act = new LoanActivity(actId)
  act.type = "DEFAULT"
  act.borrower = event.params.user

  act.txHash = event.transaction.hash
  act.logIndex = event.logIndex
  act.blockNumber = event.block.number
  act.blockTimestamp = event.block.timestamp

  act.save()
}