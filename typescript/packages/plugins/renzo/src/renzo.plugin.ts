import { type Chain, PluginBase, ToolBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { mode, base, bsc, arbitrum, linea } from "viem/chains";
import {
    RenzoOnMode,
    RenzoOnBase,
    RenzoOnArbitrum,
    RenzoOnBsc,
    RenzoOnLinea,
    ChainSpecifications,
} from "./types/ChainSpecifications";

export type RenzoPluginCtorParams = {
    chainSpecifications: ChainSpecifications;
};

const SUPPORTED_CHAINS = [mode, base, arbitrum, bsc, linea];

export class RenzoPlugin extends PluginBase<EVMWalletClient> {
    private chainSpecifications: ChainSpecifications;
    constructor(params: RenzoPluginCtorParams) {
        super("renzo", []);
        this.chainSpecifications = params.chainSpecifications;
    }

    supportsChain = (chain: Chain) =>
        chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export const renzo = ({ chainSpecifications }: RenzoPluginCtorParams) =>
    new RenzoPlugin({ chainSpecifications });
