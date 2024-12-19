import type {
    IronCladCtorParams,
    IronCladContractAddresses,
} from "./types/IroncladCtorParams";
import { type Chain, PluginBase, ToolBase } from "@goat-sdk/core";
import { mode } from "viem/chains";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";

const SUPPORTED_CHAINS = [mode];

export class IronCladPlugin extends PluginBase<EVMWalletClient> {
    private readonly addresses: IronCladContractAddresses;
    constructor(params: IronCladCtorParams) {
        super("ironclad", []);
        this.addresses = params.addresses;
    }

    supportsChain = (chain: Chain) =>
        chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export const ironclad = (params: IronCladCtorParams) =>
    new IronCladPlugin(params);
