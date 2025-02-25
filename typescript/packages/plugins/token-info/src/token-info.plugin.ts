import { type Chain, PluginBase } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { TokenInfoService } from "./token-info.service";
import {
    base,
    mode,
    mantle,
    arbitrum,
    optimism,
    polygon,
    zksync,
} from "viem/chains";

const SUPPORTED_CHAINS = [
    base,
    mode,
    mantle,
    arbitrum,
    optimism,
    polygon,
    zksync,
];

export type TokenInfoCtorParams = {
    coingeckoApiKey: string;
};

export class TokenInfoPlugin extends PluginBase<EVMWalletClient> {
    constructor(params: TokenInfoCtorParams) {
        super("token-info", [new TokenInfoService(params.coingeckoApiKey)]);
    }

    supportsChain = (chain: Chain) =>
        chain.type === "evm" && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
}

export const tokenInfo = (params: TokenInfoCtorParams) =>
    new TokenInfoPlugin(params);
