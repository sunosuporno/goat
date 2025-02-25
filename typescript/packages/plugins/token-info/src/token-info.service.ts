import { TokenInfo, CoinGeckoToken } from "./types";
import { TokenInfoParameters } from "./parameters";
import { KNOWN_TOKENS } from "./token";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { Tool } from "@goat-sdk/core";
import { ERC20_ABI } from "./abi/erc20";

export class TokenInfoService {
    private readonly coingeckoBaseUrl: string;
    private readonly apiKey: string;

    constructor(apiKey: string) {
        this.coingeckoBaseUrl = "https://api.coingecko.com/api/v3/";
        this.apiKey = apiKey;
    }

    @Tool({
        name: "get_token_info",
        description: "Get token information for a given symbol",
    })
    async getTokenInfo(
        walletClient: EVMWalletClient,
        parameters: TokenInfoParameters,
    ): Promise<TokenInfo | null> {
        console.log("walletClient", walletClient);
        const chainId = walletClient.getChain().id;
        console.log(
            `Searching for token: ${parameters.symbol} on chain: ${chainId}`,
        );

        // First check known tokens
        const knownToken =
            KNOWN_TOKENS[
                parameters.symbol.toUpperCase() as keyof typeof KNOWN_TOKENS
            ];
        if (knownToken) {
            console.log(`Found token in known tokens list: ${knownToken.name}`);
            const chainData = knownToken.chains[chainId.toString()];
            if (!chainData) {
                console.log(
                    `Token ${knownToken.symbol} not available on chain ${chainId}`,
                );
                return null; // Token not available on current network
            }

            console.log(`Returning known token data for ${knownToken.symbol}`);
            return {
                symbol: knownToken.symbol,
                name: knownToken.name,
                decimals: knownToken.decimals,
                contractAddress: chainData.contractAddress,
            };
        }

        console.log(`Token not found in known list, trying CoinGecko API...`);
        // If not found, try CoinGecko
        try {
            const response = await fetch(
                `${this.coingeckoBaseUrl}coins/list?include_platform=true`,
                {
                    method: "GET",
                    headers: {
                        accept: "application/json",
                        "x-cg-demo-api-key": this.apiKey,
                    },
                },
            );
            const data: CoinGeckoToken[] = await response.json();

            const matches = data.filter(
                (token) =>
                    token.symbol.toLowerCase() ===
                    parameters.symbol.toLowerCase(),
            );
            console.log(`Found ${matches.length} matching tokens on CoinGecko`);
            if (matches.length > 0) {
                console.log(
                    "Matching tokens:",
                    matches.map((token) => ({
                        name: token.name,
                        symbol: token.symbol,
                        platforms: token.platforms,
                    })),
                );
            }
            for (const token of matches) {
                console.log(`Checking token: ${token.name}`);
                const platformAddress = this.getPlatformAddressForChainId(
                    token.platforms,
                    chainId,
                );

                if (platformAddress) {
                    console.log(
                        `Found valid contract address for ${token.name}`,
                    );
                    const tokenDecimals = await walletClient.read({
                        address: platformAddress as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: "decimals",
                    });
                    const tokenDecimalsParsed = (
                        tokenDecimals as { value: number }
                    ).value;
                    return {
                        symbol: token.symbol.toUpperCase(),
                        name: token.name,
                        contractAddress: platformAddress as `0x${string}`,
                        decimals: tokenDecimalsParsed,
                    };
                }
                console.log(
                    `No valid contract address found for ${token.name} on chain ${chainId}`,
                );
            }

            console.log(`No matching tokens found on CoinGecko`);
            return null;
        } catch (error) {
            console.error(`CoinGecko API error:`, error);
            return null;
        }
    }

    private getPlatformAddressForChainId(
        platforms: Record<string, string> | undefined,
        chainId: number,
    ): string | null {
        if (!platforms) return null;

        // Map chain IDs to CoinGecko platform identifiers
        const platformMap: Record<number, string> = {
            1: "ethereum",
            137: "polygon-pos",
            10: "optimistic-ethereum",
            42161: "arbitrum-one",
            8453: "base",
            34443: "mode",
            // Add more mappings as needed
        };

        const platformIdentifier = platformMap[chainId];
        console.log(`Platform identifier: ${platformIdentifier}`);
        if (!platformIdentifier) {
            console.log(`No platform mapping found for chain ID ${chainId}`);
            return null;
        }

        if (platforms[platformIdentifier]) {
            console.log(
                `Found contract address on platform ${platformIdentifier}: ${platforms[platformIdentifier]}`,
            );
            return platforms[platformIdentifier];
        }

        console.log(
            `No contract address found for chain ${chainId} in platforms:`,
            platforms,
        );
        return null;
    }
}
