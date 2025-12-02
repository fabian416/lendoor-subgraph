import { newMockEvent } from "matchstick-as"
import { ethereum } from "@graphprotocol/graph-ts"
import { Genesis } from "../generated/BeaconProxy/BeaconProxy"

export function createGenesisEvent(): Genesis {
  let genesisEvent = changetype<Genesis>(newMockEvent())

  genesisEvent.parameters = new Array()

  return genesisEvent
}
