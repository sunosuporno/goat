import { Tool } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { RENZO_ABI } from "./abi/renzo";
import { EZETH_ABI } from "./abi/ezeth";
import { ChainSpecifications } from "./types/ChainSpecifications";

export class RenzoService {
    constructor(private readonly chainSpecifications: ChainSpecifications) {}
}
