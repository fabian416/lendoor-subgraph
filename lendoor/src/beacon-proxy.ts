import { Genesis as GenesisEvent } from "../generated/BeaconProxy/BeaconProxy"
import { Genesis } from "../generated/schema"

export function handleGenesis(event: GenesisEvent): void {
  let entity = new Genesis(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
