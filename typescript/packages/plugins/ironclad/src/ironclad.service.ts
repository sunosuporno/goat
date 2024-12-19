import { Tool } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { formatUnits, parseUnits } from "viem";
import type { Address } from "viem";
import { z } from "zod";
import { ERC20_ABI } from "./abi/erc20";
import { LENDING_POOL_ABI } from "./abi/lendingPool";
import { PROTOCOL_DATA_PROVIDER_ABI } from "./abi/protocolDataProvider";
import { LoopDepositParameters, LoopWithdrawParameters } from "./parameters";
import {
    BorrowIUSDParameters,
    RepayIUSDParameters,
    MonitorPositionParameters,
} from "./parameters";

interface LoopPosition {
    borrowedAmounts: string[];
    totalDeposited: string;
    totalBorrowed: string;
}

const LENDING_POOL_ADDRESS: Address =
    "0x794a61358D6845594F94dc1DB02A252CC533d587";
const PROTOCOL_DATA_PROVIDER_ADDRESS: Address =
    "0x057835e7b4fbbb396b5c6928b391752106d2eb7b";
const IUSD_ADDRESS: Address = "0xe7334Ad0e325139329E747cF2Fc24538dD564987";

export class IroncladService {
    constructor() {}

    @Tool({
        name: "ironclad_loop_deposit",
        description:
            "Perform a looped deposit (recursive borrowing) on Ironclad",
    })
    async loopDeposit(
        walletClient: EVMWalletClient,
        parameters: LoopDepositParameters
    ): Promise<LoopPosition> {
        try {
            const position: LoopPosition = {
                borrowedAmounts: [],
                totalDeposited: "0",
                totalBorrowed: "0",
            };

            const asset = await walletClient.resolveAddress(parameters.asset);
            const decimals = Number(
                await walletClient.read({
                    address: asset as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            // Check and handle allowance
            const allowance = await walletClient.read({
                address: asset as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [walletClient.getAddress(), LENDING_POOL_ADDRESS],
            });

            if (Number(allowance) < Number(parameters.initialAmount)) {
                await walletClient.sendTransaction({
                    to: asset,
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [
                        LENDING_POOL_ADDRESS,
                        parseUnits(parameters.initialAmount, decimals),
                    ],
                });
            }

            // Initial deposit
            await walletClient.sendTransaction({
                to: LENDING_POOL_ADDRESS,
                abi: LENDING_POOL_ABI,
                functionName: "deposit",
                args: [
                    asset,
                    parseUnits(parameters.initialAmount, decimals),
                    walletClient.getAddress(),
                    parameters.referralCode,
                ],
            });

            position.totalDeposited = parameters.initialAmount;
            let currentAmount = parameters.initialAmount;

            // Execute loops
            for (let i = 0; i < parameters.numLoops; i++) {
                // Get reserve configuration data for proper LTV
                const reserveConfig = await walletClient.read({
                    address: PROTOCOL_DATA_PROVIDER_ADDRESS as `0x${string}`,
                    abi: PROTOCOL_DATA_PROVIDER_ABI,
                    functionName: "getReserveConfigurationData",
                    args: [asset],
                });

                // Use the actual LTV from protocol
                const borrowAmount = (
                    (Number(currentAmount) *
                        Number((reserveConfig as unknown as any[])[1])) /
                    10000
                ).toString();

                // Borrow
                await walletClient.sendTransaction({
                    to: LENDING_POOL_ADDRESS,
                    abi: LENDING_POOL_ABI,
                    functionName: "borrow",
                    args: [
                        asset,
                        parseUnits(borrowAmount, decimals),
                        2, // Variable rate mode
                        parameters.referralCode,
                        walletClient.getAddress(),
                    ],
                });

                // Check and handle allowance for borrowed amount
                const loopAllowance = await walletClient.read({
                    address: asset as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "allowance",
                    args: [walletClient.getAddress(), LENDING_POOL_ADDRESS],
                });

                if (Number(loopAllowance) < Number(borrowAmount)) {
                    await walletClient.sendTransaction({
                        to: asset,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [
                            LENDING_POOL_ADDRESS,
                            parseUnits(borrowAmount, decimals),
                        ],
                    });
                }

                // Deposit borrowed amount
                await walletClient.sendTransaction({
                    to: LENDING_POOL_ADDRESS,
                    abi: LENDING_POOL_ABI,
                    functionName: "deposit",
                    args: [
                        asset,
                        parseUnits(borrowAmount, decimals),
                        walletClient.getAddress(),
                        parameters.referralCode,
                    ],
                });

                // Track position
                position.borrowedAmounts.push(borrowAmount);
                position.totalBorrowed = (
                    Number(position.totalBorrowed) + Number(borrowAmount)
                ).toString();
                position.totalDeposited = (
                    Number(position.totalDeposited) + Number(borrowAmount)
                ).toString();

                currentAmount = borrowAmount;
            }

            return position;
        } catch (error) {
            throw Error(`Failed to execute loop deposit: ${error}`);
        }
    }

    @Tool({
        name: "ironclad_loop_withdraw",
        description: "Unwind a looped position on Ironclad",
    })
    async loopWithdraw(
        walletClient: EVMWalletClient,
        parameters: LoopWithdrawParameters
    ): Promise<void> {
        try {
            const asset = await walletClient.resolveAddress(parameters.asset);
            const decimals = Number(
                await walletClient.read({
                    address: asset as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            // Unwind in reverse order
            for (
                let i = parameters.position.borrowedAmounts.length - 1;
                i >= 0;
                i--
            ) {
                const amountToRepay = parameters.position.borrowedAmounts[i];

                // Withdraw enough to repay
                await walletClient.sendTransaction({
                    to: LENDING_POOL_ADDRESS,
                    abi: LENDING_POOL_ABI,
                    functionName: "withdraw",
                    args: [
                        asset,
                        parseUnits(amountToRepay, decimals),
                        walletClient.getAddress(),
                    ],
                });

                // Check and handle allowance for repayment
                const allowance = await walletClient.read({
                    address: asset as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "allowance",
                    args: [walletClient.getAddress(), LENDING_POOL_ADDRESS],
                });

                if (Number(allowance) < Number(amountToRepay)) {
                    await walletClient.sendTransaction({
                        to: asset,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [
                            LENDING_POOL_ADDRESS,
                            parseUnits(amountToRepay, decimals),
                        ],
                    });
                }

                // Inside loopWithdraw function, before repaying
                const reserveData = await walletClient.read({
                    address: PROTOCOL_DATA_PROVIDER_ADDRESS,
                    abi: PROTOCOL_DATA_PROVIDER_ABI,
                    functionName: "getUserReserveData",
                    args: [asset, walletClient.getAddress()],
                });

                // Use currentVariableDebt from the response
                const currentDebt = (reserveData as unknown as any[])[2]; // index 2 is currentVariableDebt

                // Repay borrowed amount
                await walletClient.sendTransaction({
                    to: LENDING_POOL_ADDRESS,
                    abi: LENDING_POOL_ABI,
                    functionName: "repay",
                    args: [
                        asset,
                        parseUnits(amountToRepay, decimals),
                        2, // Variable rate mode
                        walletClient.getAddress(),
                    ],
                });
            }

            // Finally withdraw initial deposit
            await walletClient.sendTransaction({
                to: LENDING_POOL_ADDRESS,
                abi: LENDING_POOL_ABI,
                functionName: "withdraw",
                args: [
                    asset,
                    parseUnits(parameters.position.totalDeposited, decimals),
                    walletClient.getAddress(),
                ],
            });
        } catch (error) {
            throw Error(`Failed to execute loop withdraw: ${error}`);
        }
    }

    @Tool({
        name: "ironclad_borrow_iusd",
        description: "Deposit collateral and borrow iUSD against it",
    })
    async borrowIUSD(
        walletClient: EVMWalletClient,
        parameters: BorrowIUSDParameters
    ): Promise<string> {
        try {
            const collateralToken = await walletClient.resolveAddress(
                parameters.collateralToken
            );

            // Get collateral token decimals
            const collateralDecimals = Number(
                await walletClient.read({
                    address: collateralToken as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            // Get iUSD decimals
            const iusdDecimals = Number(
                await walletClient.read({
                    address: IUSD_ADDRESS as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            // Check and handle collateral allowance
            const allowance = await walletClient.read({
                address: collateralToken as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [walletClient.getAddress(), LENDING_POOL_ADDRESS],
            });

            if (Number(allowance) < Number(parameters.collateralAmount)) {
                await walletClient.sendTransaction({
                    to: collateralToken,
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [
                        LENDING_POOL_ADDRESS,
                        parseUnits(
                            parameters.collateralAmount,
                            collateralDecimals
                        ),
                    ],
                });
            }

            // Deposit collateral
            await walletClient.sendTransaction({
                to: LENDING_POOL_ADDRESS,
                abi: LENDING_POOL_ABI,
                functionName: "deposit",
                args: [
                    collateralToken,
                    parseUnits(parameters.collateralAmount, collateralDecimals),
                    walletClient.getAddress(),
                    parameters.referralCode,
                ],
            });

            // Borrow iUSD
            const txHash = await walletClient.sendTransaction({
                to: LENDING_POOL_ADDRESS,
                abi: LENDING_POOL_ABI,
                functionName: "borrow",
                args: [
                    IUSD_ADDRESS,
                    parseUnits(parameters.iusdAmount, iusdDecimals),
                    2, // Variable rate
                    parameters.referralCode,
                    walletClient.getAddress(),
                ],
            });

            return txHash.hash;
        } catch (error) {
            throw Error(`Failed to borrow iUSD: ${error}`);
        }
    }

    @Tool({
        name: "ironclad_repay_iusd",
        description: "Repay borrowed iUSD",
    })
    async repayIUSD(
        walletClient: EVMWalletClient,
        parameters: RepayIUSDParameters
    ): Promise<string> {
        try {
            // Get iUSD decimals
            const iusdDecimals = Number(
                await walletClient.read({
                    address: IUSD_ADDRESS as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            // Check and handle iUSD allowance
            const allowance = await walletClient.read({
                address: IUSD_ADDRESS as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [walletClient.getAddress(), LENDING_POOL_ADDRESS],
            });

            if (Number(allowance) < Number(parameters.repayAmount)) {
                await walletClient.sendTransaction({
                    to: IUSD_ADDRESS,
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [
                        LENDING_POOL_ADDRESS,
                        parseUnits(parameters.repayAmount, iusdDecimals),
                    ],
                });
            }

            // Repay iUSD
            const txHash = await walletClient.sendTransaction({
                to: LENDING_POOL_ADDRESS,
                abi: LENDING_POOL_ABI,
                functionName: "repay",
                args: [
                    IUSD_ADDRESS,
                    parseUnits(parameters.repayAmount, iusdDecimals),
                    2, // Variable rate
                    walletClient.getAddress(),
                ],
            });

            return txHash.hash;
        } catch (error) {
            throw Error(`Failed to repay iUSD: ${error}`);
        }
    }

    @Tool({
        name: "ironclad_monitor_position",
        description: "Monitor health of an iUSD position",
    })
    async monitorPosition(
        walletClient: EVMWalletClient,
        parameters: MonitorPositionParameters
    ): Promise<{
        currentCollateral: string;
        currentBorrow: string;
        currentRate: string;
    }> {
        try {
            const collateralToken = await walletClient.resolveAddress(
                parameters.collateralToken
            );

            // Get token decimals
            const decimals = Number(
                await walletClient.read({
                    address: collateralToken as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            const userReserveData = await walletClient.read({
                address: PROTOCOL_DATA_PROVIDER_ADDRESS as `0x${string}`,
                abi: PROTOCOL_DATA_PROVIDER_ABI,
                functionName: "getUserReserveData",
                args: [collateralToken, walletClient.getAddress()],
            });

            const data = userReserveData as unknown as any[];

            return {
                currentCollateral: formatUnits(data[0], decimals), // currentATokenBalance
                currentBorrow: formatUnits(data[2], 6), // currentVariableDebt (iUSD is 6 decimals)
                currentRate: formatUnits(data[4], 27), // variableBorrowRate
            };
        } catch (error) {
            throw Error(`Failed to monitor position: ${error}`);
        }
    }
}
