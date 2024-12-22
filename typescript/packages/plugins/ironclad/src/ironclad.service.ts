import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
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

const LENDING_POOL_ADDRESS = "0xB702cE183b4E1Faa574834715E5D4a6378D0eEd3";
const PROTOCOL_DATA_PROVIDER_ADDRESS =
    "0x29563f73De731Ae555093deb795ba4D1E584e42E";
const IUSD_ADDRESS = "0xA70266C8F8Cf33647dcFEE763961aFf418D9E1E4";

export class IroncladService {
    constructor() {}

    @Tool({
        name: "ironclad_loop_deposit",
        description:
            "Perform a looped deposit (recursive borrowing) on Ironclad. Send the amount of the asset (in base units) you want to deposit as the initial amount.",
    })
    async loopDeposit(
        walletClient: EVMWalletClient,
        parameters: LoopDepositParameters
    ): Promise<LoopPosition> {
        try {
            console.log(
                `[Ironclad] ====== Starting Loop Deposit Operation ======`
            );
            console.log(`[Ironclad] Asset Address: ${parameters.assetAddress}`);
            console.log(
                `[Ironclad] Initial Amount: ${parameters.initialAmount}`
            );
            console.log(`[Ironclad] Number of Loops: ${parameters.numLoops}`);
            console.log(
                `[Ironclad] User Address: ${walletClient.getAddress()}`
            );

            const position: LoopPosition = {
                borrowedAmounts: [],
                totalDeposited: "0",
                totalBorrowed: "0",
            };

            const asset = parameters.assetAddress;
            console.log(`[Ironclad] Checking allowance for initial deposit...`);
            const allowanceResult = await walletClient.read({
                address: asset as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [walletClient.getAddress(), LENDING_POOL_ADDRESS],
            });
            const allowance = (allowanceResult as { value: bigint }).value;

            console.log(`[Ironclad] Current allowance: ${allowance}`);
            console.log(
                `[Ironclad] Required allowance: ${parameters.initialAmount}`
            );

            if (Number(allowance) < Number(parameters.initialAmount)) {
                console.log(`[Ironclad] Insufficient allowance, approving...`);
                await walletClient.sendTransaction({
                    to: asset,
                    abi: ERC20_ABI,
                    functionName: "approve",
                    args: [LENDING_POOL_ADDRESS, parameters.initialAmount],
                });
                console.log(`[Ironclad] Approval transaction successful`);
            } else {
                console.log(`[Ironclad] Sufficient allowance already exists`);
            }

            console.log(
                `[Ironclad] Performing initial deposit of ${parameters.initialAmount}`
            );
            // Initial deposit
            await walletClient.sendTransaction({
                to: LENDING_POOL_ADDRESS,
                abi: LENDING_POOL_ABI,
                functionName: "deposit",
                args: [
                    asset,
                    parameters.initialAmount,
                    walletClient.getAddress(),
                    parameters.referralCode,
                ],
            });

            console.log(`[Ironclad] Initial deposit successful`);

            position.totalDeposited = parameters.initialAmount;
            let currentAmount = parameters.initialAmount;

            // Execute loops
            for (let i = 0; i < parameters.numLoops; i++) {
                console.log(
                    `\n[Ironclad] ====== Starting Loop ${i + 1}/${
                        parameters.numLoops
                    } ======`
                );

                // Get reserve configuration
                console.log(`[Ironclad] Fetching reserve configuration...`);
                const reserveConfigResult = await walletClient.read({
                    address: PROTOCOL_DATA_PROVIDER_ADDRESS as `0x${string}`,
                    abi: PROTOCOL_DATA_PROVIDER_ABI,
                    functionName: "getReserveConfigurationData",
                    args: [asset],
                });

                const reserveConfig = (reserveConfigResult as { value: any[] })
                    .value;
                const ltv = Number(reserveConfig[1]);
                console.log(`[Ironclad] LTV from protocol: ${ltv / 100}%`);

                const borrowAmount = (
                    (Number(currentAmount) * ltv) /
                    10000
                ).toString();
                console.log(
                    `[Ironclad] Calculated borrow amount: ${borrowAmount}`
                );

                // Borrow
                console.log(`[Ironclad] Executing borrow transaction...`);
                await walletClient.sendTransaction({
                    to: LENDING_POOL_ADDRESS,
                    abi: LENDING_POOL_ABI,
                    functionName: "borrow",
                    args: [
                        asset,
                        borrowAmount,
                        2, // Variable rate mode
                        parameters.referralCode,
                        walletClient.getAddress(),
                    ],
                });
                console.log(`[Ironclad] Borrow successful`);

                // Allowance check
                console.log(
                    `[Ironclad] Checking allowance for subsequent deposit...`
                );
                const loopAllowanceResult = await walletClient.read({
                    address: asset as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "allowance",
                    args: [walletClient.getAddress(), LENDING_POOL_ADDRESS],
                });
                const loopAllowance = (loopAllowanceResult as { value: bigint })
                    .value;

                if (Number(loopAllowance) < Number(borrowAmount)) {
                    console.log(
                        `[Ironclad] Insufficient allowance, approving...`
                    );
                    await walletClient.sendTransaction({
                        to: asset,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [LENDING_POOL_ADDRESS, borrowAmount],
                    });
                    console.log(`[Ironclad] Approval successful`);
                }

                // Deposit
                console.log(`[Ironclad] Depositing borrowed amount...`);
                await walletClient.sendTransaction({
                    to: LENDING_POOL_ADDRESS,
                    abi: LENDING_POOL_ABI,
                    functionName: "deposit",
                    args: [
                        asset,
                        borrowAmount,
                        walletClient.getAddress(),
                        parameters.referralCode,
                    ],
                });
                console.log(`[Ironclad] Deposit successful`);

                // Update position tracking
                position.borrowedAmounts.push(borrowAmount);
                position.totalBorrowed = (
                    Number(position.totalBorrowed) + Number(borrowAmount)
                ).toString();
                position.totalDeposited = (
                    Number(position.totalDeposited) + Number(borrowAmount)
                ).toString();
                currentAmount = borrowAmount;

                console.log(`[Ironclad] Loop ${i + 1} Summary:`);
                console.log(`  - Amount Borrowed: ${borrowAmount}`);
                console.log(`  - Total Borrowed: ${position.totalBorrowed}`);
                console.log(`  - Total Deposited: ${position.totalDeposited}`);
                console.log(
                    `[Ironclad] ====== Loop ${i + 1} Complete ======\n`
                );
            }

            console.log(
                `\n[Ironclad] ====== Loop Deposit Operation Complete ======`
            );
            console.log(`[Ironclad] Final Position Summary:`);
            console.log(`  - Total Deposited: ${position.totalDeposited}`);
            console.log(`  - Total Borrowed: ${position.totalBorrowed}`);
            console.log(
                `  - Number of Loops Completed: ${parameters.numLoops}`
            );
            console.log(
                `[Ironclad] ==========================================\n`
            );

            return position;
        } catch (error) {
            console.error(`[Ironclad] ❌ Error in loop deposit operation:`);
            console.error(`[Ironclad] ${error}`);
            console.error(`[Ironclad] Stack trace:`, error);
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
        name: "ironclad_monitor_loop_position",
        description: "Monitor health of a looped position on Ironclad",
    })
    async monitorLoopPosition(
        walletClient: EVMWalletClient,
        parameters: MonitorPositionParameters
    ): Promise<{
        totalCollateral: string;
        totalBorrowed: string;
        currentLTV: string;
        healthFactor: string;
        liquidationThreshold: string;
    }> {
        try {
            const asset = await walletClient.resolveAddress(
                parameters.collateralToken
            );
            const decimals = Number(
                await walletClient.read({
                    address: asset as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                })
            );

            // Get user's reserve data
            const userReserveData = (await walletClient.read({
                address: PROTOCOL_DATA_PROVIDER_ADDRESS,
                abi: PROTOCOL_DATA_PROVIDER_ABI,
                functionName: "getUserReserveData",
                args: [asset, walletClient.getAddress()],
            })) as unknown as any[];

            // Get reserve configuration
            const reserveConfig = (await walletClient.read({
                address: PROTOCOL_DATA_PROVIDER_ADDRESS,
                abi: PROTOCOL_DATA_PROVIDER_ABI,
                functionName: "getReserveConfigurationData",
                args: [asset],
            })) as unknown as any[];

            const totalCollateral = formatUnits(userReserveData[0], decimals);
            const totalBorrowed = formatUnits(userReserveData[2], decimals);
            const liquidationThreshold = Number(reserveConfig[2]) / 10000; // Convert from bps

            // Calculate current LTV and health factor
            const currentLTV =
                totalBorrowed === "0"
                    ? "0"
                    : (
                          (Number(totalBorrowed) / Number(totalCollateral)) *
                          100
                      ).toFixed(2);

            const healthFactor =
                totalBorrowed === "0"
                    ? "∞"
                    : (
                          (Number(totalCollateral) * liquidationThreshold) /
                          Number(totalBorrowed)
                      ).toFixed(2);

            return {
                totalCollateral,
                totalBorrowed,
                currentLTV: `${currentLTV}%`,
                healthFactor,
                liquidationThreshold: `${(liquidationThreshold * 100).toFixed(
                    2
                )}%`,
            };
        } catch (error) {
            throw Error(`Failed to monitor loop position: ${error}`);
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
