import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { parseUnits } from "viem";
import { encodeAbiParameters } from "viem";
import { ERC20_ABI } from "./abi/erc20";
import { KIM_FACTORY_ABI } from "./abi/factory";
import { POOL_ABI } from "./abi/pool";
import { POSITION_MANAGER_ABI } from "./abi/positionManager";
import { SWAP_ROUTER_ABI } from "./abi/swaprouter";
import {
    BurnParams,
    CollectParams,
    DecreaseLiquidityParams,
    ExactInputParams,
    ExactInputSingleParams,
    ExactOutputParams,
    ExactOutputSingleParams,
    GetSwapRouterAddressParams,
    GlobalStateResponseParams,
    IncreaseLiquidityParams,
    MintParams,
} from "./parameters";

const SWAP_ROUTER_ADDRESS = "0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8";
const POSITION_MANAGER_ADDRESS = "0x2e8614625226D26180aDf6530C3b1677d3D7cf10";
const FACTORY_ADDRESS = "0xB5F00c2C5f8821155D8ed27E31932CFD9DB3C5D5";

export class KimService {
    @Tool({
        name: "kim_get_swap_router_address",
        description: "Get the address of the swap router",
    })
    async getSwapRouterAddress(parameters: GetSwapRouterAddressParams) {
        return SWAP_ROUTER_ADDRESS;
    }

    @Tool({
        description:
            "Swap an exact amount of input tokens for an output token in a single hop. Have the token amounts in their base units. Don't need to approve the swap router for the output token. User will have sufficient balance of the input token. The swap router address is already provided in the function. Returns a transaction hash on success. Once you get a transaction hash, the swap is complete - do not call this function again.",
    })
    async swapExactInputSingleHop(
        walletClient: EVMWalletClient,
        parameters: ExactInputSingleParams
    ) {
        try {
            console.log("\n🔄 Executing Single Hop Swap");
            console.log("-------------------");
            console.log("📍 Token In:", parameters.tokenInAddress);
            console.log("📍 Token Out:", parameters.tokenOutAddress);
            console.log("📍 Amount In:", parameters.amountIn);
            console.log("📍 Min Amount Out:", parameters.amountOutMinimum);

            console.log("📝 Approving tokens...");
            const approvalHash = await walletClient.sendTransaction({
                to: parameters.tokenInAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [SWAP_ROUTER_ADDRESS, parameters.amountIn],
            });
            console.log("✅ Approval Hash:", approvalHash.hash);

            const timestamp =
                Math.floor(Date.now() / 1000) + parameters.deadline;

            console.log(
                "📍 Deadline:",
                new Date(timestamp * 1000).toISOString()
            );

            const hash = await walletClient.sendTransaction({
                to: SWAP_ROUTER_ADDRESS,
                abi: SWAP_ROUTER_ABI,
                functionName: "exactInputSingle",
                args: [
                    {
                        tokenIn: parameters.tokenInAddress,
                        tokenOut: parameters.tokenOutAddress,
                        recipient: walletClient.getAddress(),
                        deadline: timestamp,
                        amountIn: parameters.amountIn,
                        amountOutMinimum: parameters.amountOutMinimum,
                        limitSqrtPrice: parameters.limitSqrtPrice,
                    },
                ],
            });

            console.log("✅ Transaction Hash:", hash.hash);
            return hash.hash;
        } catch (error) {
            console.log("❌ Swap Failed:", error);
            throw Error(`Failed to swap exact input single hop: ${error}`);
        }
    }

    @Tool({
        name: "kim_swap_exact_output_single_hop",
        description:
            "Swap an exact amount of output tokens for a single hop. Have the token amounts in their base units. Don't need to approve the swap router for the output token. User will have sufficient balance of the input token. The swap router address is already provided in the function. Returns a transaction hash on success. Once you get a transaction hash, the swap is complete - do not call this function again.",
    })
    async swapExactOutputSingleHop(
        walletClient: EVMWalletClient,
        parameters: ExactOutputSingleParams
    ): Promise<string> {
        try {
            console.log("\n🔄 Executing Single Hop Exact Output Swap");
            console.log("-------------------");
            console.log("📍 Token In:", parameters.tokenInAddress);
            console.log("📍 Token Out:", parameters.tokenOutAddress);
            console.log("📍 Amount Out:", parameters.amountOut);
            console.log("📍 Max Amount In:", parameters.amountInMaximum);
            console.log("📍 Limit Sqrt Price:", parameters.limitSqrtPrice);
            console.log("📍 Deadline:", parameters.deadline);

            const tokenIn = parameters.tokenInAddress;
            const tokenOut = parameters.tokenOutAddress;

            const amountOut = parameters.amountOut;
            const amountInMaximum = parameters.amountInMaximum;
            const limitSqrtPrice = parameters.limitSqrtPrice;
            const timestamp =
                Math.floor(Date.now() / 1000) + parameters.deadline;

            console.log(
                "📍 Deadline:",
                new Date(timestamp * 1000).toISOString()
            );

            console.log("📝 Approving tokens...");
            const approvalHash = await walletClient.sendTransaction({
                to: parameters.tokenInAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [SWAP_ROUTER_ADDRESS, amountInMaximum],
            });
            console.log("✅ Approval Hash:", approvalHash.hash);

            const hash = await walletClient.sendTransaction({
                to: SWAP_ROUTER_ADDRESS,
                abi: SWAP_ROUTER_ABI,
                functionName: "exactOutputSingle",
                args: [
                    {
                        tokenIn: tokenIn,
                        tokenOut: tokenOut,
                        recipient: walletClient.getAddress(),
                        deadline: timestamp,
                        amountOut: amountOut,
                        amountInMaximum: amountInMaximum,
                        limitSqrtPrice: limitSqrtPrice,
                    },
                ],
            });

            console.log("✅ Transaction Hash:", hash.hash);
            return hash.hash;
        } catch (error) {
            console.log("❌ Swap Failed:", error);
            throw Error(`Failed to swap exact output single hop: ${error}`);
        }
    }

    @Tool({
        name: "kim_swap_exact_input_multi_hop",
        description: "Swap an exact amount of input tokens in multiple hops",
    })
    async swapExactInputMultiHop(
        walletClient: EVMWalletClient,
        parameters: ExactInputParams
    ): Promise<string> {
        try {
            const recipient = await walletClient.resolveAddress(
                parameters.recipient
            );

            // Get first and last token decimals
            const tokenInDecimals = Number(
                await walletClient.read({
                    address: parameters.path.tokenIn as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            const tokenOutDecimals = Number(
                await walletClient.read({
                    address: parameters.path.tokenOut as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            // Encode the path
            const encodedPath = encodeAbiParameters(
                [{ type: "address[]" }, { type: "uint24[]" }],
                [
                    [
                        parameters.path.tokenIn as `0x${string}`,
                        ...parameters.path.intermediateTokens.map(
                            (t: string) => t as `0x${string}`
                        ),
                        parameters.path.tokenOut as `0x${string}`,
                    ],
                    parameters.path.fees,
                ]
            );

            const hash = await walletClient.sendTransaction({
                to: SWAP_ROUTER_ADDRESS,
                abi: SWAP_ROUTER_ABI,
                functionName: "exactInput",
                args: [
                    encodedPath,
                    recipient,
                    parameters.deadline,
                    parseUnits(parameters.amountIn, tokenInDecimals),
                    parseUnits(parameters.amountOutMinimum, tokenOutDecimals),
                ],
            });

            return hash.hash;
        } catch (error) {
            throw new Error(`Failed to swap: ${error}`);
        }
    }

    @Tool({
        name: "kim_swap_exact_output_multi_hop",
        description:
            "Swap tokens to receive an exact amount of output tokens in multiple hops",
    })
    async swapExactOutputMultiHop(
        walletClient: EVMWalletClient,
        parameters: ExactOutputParams
    ): Promise<string> {
        try {
            const recipient = await walletClient.resolveAddress(
                parameters.recipient
            );

            // Get first and last token decimals
            const tokenInDecimals = Number(
                await walletClient.read({
                    address: parameters.path.tokenIn as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            const tokenOutDecimals = Number(
                await walletClient.read({
                    address: parameters.path.tokenOut as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            // Encode the path
            const encodedPath = encodeAbiParameters(
                [{ type: "address[]" }, { type: "uint24[]" }],
                [
                    [
                        parameters.path.tokenIn as `0x${string}`,
                        ...parameters.path.intermediateTokens.map(
                            (t: string) => t as `0x${string}`
                        ),
                        parameters.path.tokenOut as `0x${string}`,
                    ],
                    parameters.path.fees,
                ]
            );

            const hash = await walletClient.sendTransaction({
                to: SWAP_ROUTER_ADDRESS,
                abi: SWAP_ROUTER_ABI,
                functionName: "exactOutput",
                args: [
                    encodedPath,
                    recipient,
                    parameters.deadline,
                    parseUnits(parameters.amountOut, tokenOutDecimals),
                    parseUnits(parameters.amountInMaximum, tokenInDecimals),
                ],
            });

            return hash.hash;
        } catch (error) {
            throw new Error(`Failed to swap: ${error}`);
        }
    }

    @Tool({
        name: "kim_mint_position",
        description:
            "Mint a new liquidity position in a pool. Returns a transaction hash on success. Once you get a transaction hash, the mint is complete - do not call this function again.",
    })
    async mintPosition(
        walletClient: EVMWalletClient,
        parameters: MintParams
    ): Promise<string> {
        try {
            console.log("\n🏭 Minting New Position");
            console.log("-------------------");

            const tickSpacing = 60;
            const recipient = walletClient.getAddress();
            console.log("📍 Recipient:", recipient);

            // First determine token order
            const isOrderMatched =
                parameters.token0Address.toLowerCase() <
                parameters.token1Address.toLowerCase();

            // Set tokens and amounts in correct order
            const [token0, token1] = isOrderMatched
                ? [parameters.token0Address, parameters.token1Address]
                : [parameters.token1Address, parameters.token0Address];

            const [amount0Raw, amount1Raw] = isOrderMatched
                ? [parameters.amount0Desired, parameters.amount1Desired]
                : [parameters.amount1Desired, parameters.amount0Desired];

            console.log("\n🔍 Getting Pool Info");
            console.log("-------------------");
            const poolAddressResult = await walletClient.read({
                address: FACTORY_ADDRESS as `0x${string}`,
                abi: KIM_FACTORY_ABI,
                functionName: "poolByPair",
                args: [token0, token1],
            });
            const poolAddress = (poolAddressResult as { value: string }).value;
            console.log("📍 Pool Address:", poolAddress);

            console.log("\n📊 Getting Global State");
            const globalState = await walletClient.read({
                address: poolAddress as `0x${string}`,
                abi: POOL_ABI,
                functionName: "globalState",
            });
            console.log("📍 Global State:", globalState);
            const globalStateArray = (globalState as { value: any[] }).value;
            const currentTick = parseInt(globalStateArray[1].toString());
            console.log("📍 Current Tick:", currentTick);

            // Calculate nearest tick that's divisible by spacing
            const nearestTick =
                Math.floor(currentTick / tickSpacing) * tickSpacing;

            // Use provided ticks if they exist and are valid numbers
            const tickLower = nearestTick - tickSpacing * 5; // 300 ticks below
            const tickUpper = nearestTick + tickSpacing * 5; // 300 ticks above

            console.log("📍 Nearest Tick:", nearestTick);
            console.log("📍 Tick Lower:", tickLower);
            console.log("📍 Tick Upper:", tickUpper);

            console.log("\n📝 Approving Tokens");
            console.log("-------------------");
            const approvalHash0 = await walletClient.sendTransaction({
                to: token0 as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [POSITION_MANAGER_ADDRESS, amount0Raw],
            });
            console.log("✅ Token0 Approval Hash:", approvalHash0.hash);

            const approvalHash1 = await walletClient.sendTransaction({
                to: token1 as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [POSITION_MANAGER_ADDRESS, amount1Raw],
            });
            console.log("✅ Token1 Approval Hash:", approvalHash1.hash);

            // Add timestamp calculation
            const timestamp =
                Math.floor(Date.now() / 1000) + parameters.deadline;
            console.log(
                "📍 Deadline:",
                new Date(timestamp * 1000).toISOString()
            );

            console.log("\n🔨 Minting Position");
            console.log("-------------------");
            const hash = await walletClient.sendTransaction({
                to: POSITION_MANAGER_ADDRESS,
                abi: POSITION_MANAGER_ABI,
                functionName: "mint",
                args: [
                    {
                        token0,
                        token1,
                        tickLower: tickLower,
                        tickUpper: tickUpper,
                        amount0Desired: amount0Raw,
                        amount1Desired: amount1Raw,
                        amount0Min: 0,
                        amount1Min: 0,
                        recipient,
                        deadline: timestamp,
                    },
                ],
            });

            console.log("\n✅ Mint Successful");
            console.log("-------------------");
            console.log("Transaction Hash:", hash.hash);
            return hash.hash;
        } catch (error) {
            console.log("\n❌ Mint Failed");
            console.log("-------------------");
            console.error("Error Details:", error);
            throw new Error(`Failed to mint position: ${error}`);
        }
    }

    @Tool({
        name: "kim_increase_liquidity",
        description:
            "Increase liquidity in an existing position. Returns a transaction hash on success. Once you get a transaction hash, the increase is complete - do not call this function again.",
    })
    async increaseLiquidity(
        walletClient: EVMWalletClient,
        parameters: IncreaseLiquidityParams
    ): Promise<string> {
        try {
            console.log("\n🔄 Increasing Liquidity");
            console.log("-------------------");

            // Set tokens and amounts in correct order
            const isOrderMatched =
                parameters.token0Address.toLowerCase() <
                parameters.token1Address.toLowerCase();

            const [token0, token1] = isOrderMatched
                ? [parameters.token0Address, parameters.token1Address]
                : [parameters.token1Address, parameters.token0Address];

            const [amount0Raw, amount1Raw] = isOrderMatched
                ? [parameters.amount0Desired, parameters.amount1Desired]
                : [parameters.amount1Desired, parameters.amount0Desired];

            console.log("📍 Token0:", token0, "Amount:", amount0Raw);
            console.log("📍 Token1:", token1, "Amount:", amount1Raw);

            console.log("\n📝 Approving Tokens");
            console.log("-------------------");
            const approvalHash0 = await walletClient.sendTransaction({
                to: token0 as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [POSITION_MANAGER_ADDRESS, amount0Raw],
            });
            console.log("✅ Token0 Approval Hash:", approvalHash0.hash);

            const approvalHash1 = await walletClient.sendTransaction({
                to: token1 as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [POSITION_MANAGER_ADDRESS, amount1Raw],
            });
            console.log("✅ Token1 Approval Hash:", approvalHash1.hash);

            // Calculate deadline as current time + deadline seconds
            const timestamp = Math.floor(Date.now() / 1000) + 60; // 60 seconds from now
            console.log("\n⏰ Deadline Info:");
            console.log("Current Time:", Math.floor(Date.now() / 1000));
            console.log("Deadline:", timestamp);
            console.log(
                "Deadline Date:",
                new Date(timestamp * 1000).toISOString()
            );

            console.log("\n🔨 Increasing Position");
            console.log("-------------------");
            const hash = await walletClient.sendTransaction({
                to: POSITION_MANAGER_ADDRESS,
                abi: POSITION_MANAGER_ABI,
                functionName: "increaseLiquidity",
                args: [
                    {
                        tokenId: parameters.tokenId,
                        amount0Desired: amount0Raw,
                        amount1Desired: amount1Raw,
                        amount0Min: 0n,
                        amount1Min: 0n,
                        deadline: timestamp,
                    },
                ],
            });

            console.log("\n✅ Increase Successful");
            console.log("-------------------");
            console.log("Transaction Hash:", hash.hash);
            return hash.hash;
        } catch (error) {
            console.log("\n❌ Increase Failed");
            console.log("-------------------");
            console.error("Error Details:", error);
            throw new Error(`Failed to increase liquidity: ${error}`);
        }
    }

    @Tool({
        name: "kim_decrease_liquidity",
        description:
            "Decrease liquidity in an existing position by specifying a percentage (0-100). Returns a transaction hash on success. Once you get a transaction hash, the decrease is complete - do not call this function again.",
    })
    async decreaseLiquidity(
        walletClient: EVMWalletClient,
        parameters: DecreaseLiquidityParams
    ): Promise<string> {
        try {
            console.log("\n📉 Decreasing Liquidity");
            console.log("-------------------");
            console.log("📍 Token ID:", parameters.tokenId);
            console.log("📍 Percentage to Remove:", parameters.percentage, "%");

            // Get position info
            const positionResult = await walletClient.read({
                address: POSITION_MANAGER_ADDRESS as `0x${string}`,
                abi: POSITION_MANAGER_ABI,
                functionName: "positions",
                args: [parameters.tokenId],
            });
            const position = (positionResult as { value: any[] }).value;

            const currentLiquidity = position[6];
            const liquidityToRemove =
                (currentLiquidity * BigInt(parameters.percentage)) /
                BigInt(100);

            console.log("\n🧮 Calculations:");
            console.log("📍 Current Liquidity:", currentLiquidity.toString());
            console.log(
                "📍 Liquidity to Remove:",
                liquidityToRemove.toString()
            );
            console.log("📍 Removal Percentage:", `${parameters.percentage}%`);

            // Set min amounts to 0 for now
            const amount0Min = 0n;
            const amount1Min = 0n;

            console.log("\n🔒 Slippage Protection:");
            console.log("Amount0 Min:", amount0Min.toString());
            console.log("Amount1 Min:", amount1Min.toString());

            const timestamp = Math.floor(Date.now() / 1000) + 60;

            const hash = await walletClient.sendTransaction({
                to: POSITION_MANAGER_ADDRESS,
                abi: POSITION_MANAGER_ABI,
                functionName: "decreaseLiquidity",
                args: [
                    {
                        tokenId: parameters.tokenId,
                        liquidity: liquidityToRemove,
                        amount0Min: amount0Min,
                        amount1Min: amount1Min,
                        deadline: timestamp,
                    },
                ],
            });

            console.log("\n✅ Decrease Successful");
            console.log("Transaction Hash:", hash.hash);
            return hash.hash;
        } catch (error) {
            console.log("\n❌ Decrease Failed");
            console.error("Error Details:", error);
            throw new Error(`Failed to decrease liquidity: ${error}`);
        }
    }

    @Tool({
        name: "kim_collect",
        description: "Collect tokens from a liquidity position",
    })
    async collect(
        walletClient: EVMWalletClient,
        parameters: CollectParams
    ): Promise<string> {
        try {
            const recipient = await walletClient.resolveAddress(
                parameters.recipient
            );

            const [token0Decimals, token1Decimals] = await Promise.all([
                Number(
                    await walletClient.read({
                        address: parameters.token0 as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: "decimals",
                    })
                ),
                Number(
                    await walletClient.read({
                        address: parameters.token1 as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: "decimals",
                    })
                ),
            ]);

            const hash = await walletClient.sendTransaction({
                to: POSITION_MANAGER_ADDRESS,
                abi: POSITION_MANAGER_ABI,
                functionName: "collect",
                args: [
                    {
                        tokenId: parameters.tokenId,
                        recipient,
                        amount0Max: parseUnits(
                            parameters.amount0Max,
                            token0Decimals
                        ),
                        amount1Max: parseUnits(
                            parameters.amount1Max,
                            token1Decimals
                        ),
                    },
                ],
            });

            return hash.hash;
        } catch (error) {
            throw new Error(`Failed to collect: ${error}`);
        }
    }

    @Tool({
        name: "kim_burn",
        description:
            "Burn a liquidity position NFT after all tokens have been collected",
    })
    async burn(
        walletClient: EVMWalletClient,
        parameters: BurnParams
    ): Promise<string> {
        try {
            const hash = await walletClient.sendTransaction({
                to: POSITION_MANAGER_ADDRESS,
                abi: POSITION_MANAGER_ABI,
                functionName: "burn",
                args: [parameters.tokenId],
            });

            return hash.hash;
        } catch (error) {
            throw new Error(`Failed to burn position: ${error}`);
        }
    }
}
