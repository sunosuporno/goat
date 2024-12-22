import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class LoopDepositParameters extends createToolParameters(
    z.object({
        assetAddress: z
            .string()
            .describe("The address of the asset to deposit and borrow"),
        initialAmount: z
            .string()
            .describe("The initial amount of the asset to deposit"),
        numLoops: z
            .number()
            .min(1)
            .max(5)
            .describe("Number of loops to perform"),
        referralCode: z
            .string()
            .optional()
            .default("0")
            .describe("Referral code"),
    })
) {}

export class LoopWithdrawParameters extends createToolParameters(
    z.object({
        asset: z.string().describe("The asset to withdraw"),
        position: z
            .object({
                borrowedAmounts: z
                    .array(z.string())
                    .describe("Array of borrowed amounts to unwind"),
                totalDeposited: z.string().describe("Total amount deposited"),
                totalBorrowed: z.string().describe("Total amount borrowed"),
            })
            .describe("Position details"),
    })
) {}

export class BorrowIUSDParameters extends createToolParameters(
    z.object({
        collateralToken: z
            .string()
            .describe("The token to deposit as collateral"),
        collateralAmount: z
            .string()
            .describe("Amount of collateral to deposit"),
        iusdAmount: z.string().describe("Amount of iUSD to borrow"),
        referralCode: z
            .string()
            .optional()
            .default("0")
            .describe("Referral code"),
    })
) {}

export class RepayIUSDParameters extends createToolParameters(
    z.object({
        collateralToken: z.string().describe("The collateral token used"),
        repayAmount: z.string().describe("Amount of iUSD to repay"),
    })
) {}

export class MonitorPositionParameters extends createToolParameters(
    z.object({
        collateralToken: z
            .string()
            .describe("The collateral token to check position for"),
    })
) {}
