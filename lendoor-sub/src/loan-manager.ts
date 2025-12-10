import { BigInt } from "@graphprotocol/graph-ts"
import {
  LoanOpened as LoanOpenedEvent,
  LoanClosed as LoanClosedEvent,
} from "../generated/LoanManager/LoanManager"

import {
  ProtocolStat,
  Borrower,
  DailyProtocolStat,
} from "../generated/schema"

const SECONDS_PER_DAY = 86400

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

// ✅ LoanOpened(user, principal, amountDue, ...)
export function handleLoanOpened(event: LoanOpenedEvent): void {
  let stat = getProtocolStat()
  let daily = getDailyStat(event.block.timestamp)

  stat.loansOriginated = stat.loansOriginated.plus(BigInt.fromI32(1))
  daily.loansOriginated = daily.loansOriginated.plus(BigInt.fromI32(1))

  // principal real
  stat.principalOriginated = stat.principalOriginated.plus(event.params.principal)
  daily.principalOriginated = daily.principalOriginated.plus(event.params.principal)

  // unique borrowers
  let borrowerId = event.params.user.toHexString()
  let borrower = Borrower.load(borrowerId)

  if (borrower == null) {
    borrower = new Borrower(borrowerId)
    borrower.firstSeen = event.block.timestamp
    borrower.save()

    stat.uniqueBorrowers = stat.uniqueBorrowers.plus(BigInt.fromI32(1))
    daily.uniqueBorrowers = daily.uniqueBorrowers.plus(BigInt.fromI32(1))
  }

  stat.lastUpdated = event.block.timestamp
  daily.lastUpdated = event.block.timestamp

  stat.save()
  daily.save()
}

// ✅ LoanClosed(user, paid)
export function handleLoanClosed(event: LoanClosedEvent): void {
  let stat = getProtocolStat()
  let daily = getDailyStat(event.block.timestamp)

  // OJO: este evento solo da "paid".
  // Para separar principal vs interest en forma exacta
  // necesitarías un evento más rico o almacenar loan state.
  // Por ahora: lo sumamos como principalRepaid "best effort".
  stat.principalRepaid = stat.principalRepaid.plus(event.params.paid)
  daily.principalRepaid = daily.principalRepaid.plus(event.params.paid)

  stat.lastUpdated = event.block.timestamp
  daily.lastUpdated = event.block.timestamp

  stat.save()
  daily.save()
}