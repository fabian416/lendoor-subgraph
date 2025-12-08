import { Bytes, BigInt } from "@graphprotocol/graph-ts"

import {
  Deposit as DepositEvent,
  Withdraw as WithdrawEvent,
  Borrow as BorrowEvent,
  Repay as RepayEvent,
  VaultStatus as VaultStatusEvent,
} from "../generated/BeaconProxy/BeaconProxy"

import {
  VaultActivity,
  VaultStatusSnapshot,
} from "../generated/schema"

function buildIdFromEvent(prefix: string, txHash: Bytes, logIndex: BigInt): string {
  return prefix + "-" + txHash.toHex() + "-" + logIndex.toString()
}

// ---------------- ACTIVITY FEED ----------------

export function handleDeposit(event: DepositEvent): void {
  let id = buildIdFromEvent("deposit", event.transaction.hash, event.logIndex)
  let entity = new VaultActivity(id)
  entity.type = "DEPOSIT"
  entity.account = event.params.owner
  entity.counterparty = event.params.sender
  entity.assets = event.params.assets
  entity.shares = event.params.shares
  entity.txHash = event.transaction.hash
  entity.logIndex = event.logIndex
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
  let id = buildIdFromEvent("withdraw", event.transaction.hash, event.logIndex)
  let entity = new VaultActivity(id)
  entity.type = "WITHDRAW"
  entity.account = event.params.owner
  entity.counterparty = event.params.receiver
  entity.assets = event.params.assets
  entity.shares = event.params.shares
  entity.txHash = event.transaction.hash
  entity.logIndex = event.logIndex
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.save()
}

export function handleRepay(event: RepayEvent): void {
  let id = buildIdFromEvent("repay", event.transaction.hash, event.logIndex)
  let entity = new VaultActivity(id)

  entity.type = "REPAY"
  entity.account = event.params.account

  entity.assets = event.params.assets
  entity.unset("shares")
  entity.unset("counterparty")

  entity.txHash = event.transaction.hash
  entity.logIndex = event.logIndex
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp

  entity.save()
}

export function handleBorrow(event: BorrowEvent): void {
  let id = buildIdFromEvent("borrow", event.transaction.hash, event.logIndex)
  let entity = new VaultActivity(id)

  entity.type = "BORROW"
  entity.account = event.params.account

  entity.assets = event.params.assets
  entity.unset("shares")
  entity.unset("counterparty")

  entity.txHash = event.transaction.hash
  entity.logIndex = event.logIndex
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp

  entity.save()
}

// ---------------- STATUS SNAPSHOTS ----------------

export function handleVaultStatus(event: VaultStatusEvent): void {
  let id = buildIdFromEvent("status", event.transaction.hash, event.logIndex)
  let snapshot = new VaultStatusSnapshot(id)

  snapshot.totalShares = event.params.totalShares
  snapshot.totalBorrows = event.params.totalBorrows
  snapshot.accumulatedFees = event.params.accumulatedFees
  snapshot.cash = event.params.cash
  snapshot.interestAccumulator = event.params.interestAccumulator
  snapshot.interestRate = event.params.interestRate

  snapshot.vaultTimestamp = event.params.timestamp

  snapshot.blockNumber = event.block.number
  snapshot.blockTimestamp = event.block.timestamp
  snapshot.txHash = event.transaction.hash
  snapshot.logIndex = event.logIndex

  snapshot.save()
}