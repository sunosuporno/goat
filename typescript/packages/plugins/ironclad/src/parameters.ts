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
        assetAddress: z
            .string()
            .describe("The address of the asset to withdraw"),
    })
) {}

export class BorrowIUSDParameters extends createToolParameters(
    z.object({
        collateralTokenAddress: z
            .string()
            .describe("The address of the token to deposit as collateral"),
        collateralAmount: z
            .string()
            .describe("Amount of collateral to deposit"),
        maxFeePercentage: z
            .string()
            .describe("Maximum fee percentage for the borrowing operation"),
        lusdAmount: z.string().describe("Amount of LUSD to borrow"),
        upperHint: z
            .string()
            .optional()
            .default("0x0000000000000000000000000000000000000000")
            .describe("Upper hint for the trove insertion"),
        lowerHint: z
            .string()
            .optional()
            .default("0x0000000000000000000000000000000000000000")
            .describe("Lower hint for the trove insertion"),
    })
) {}

export class RepayIUSDParameters extends createToolParameters(
    z.object({
        collateralToken: z.string().describe("The collateral token used"),
    })
) {}

export class MonitorPositionParameters extends createToolParameters(
    z.object({
        collateralToken: z
            .string()
            .describe("The collateral token to check position for"),
    })
) {}

export class CalculateMaxWithdrawableParameters extends createToolParameters(
    z.object({
        assetAddress: z
            .string()
            .describe(
                "The address of the asset to calculate max withdrawable amount for"
            ),
    })
) {}
