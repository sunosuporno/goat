import { z } from "zod";

export const depositSchema = z.object({
    asset: z.string().describe("The asset to deposit"),
    amount: z.string().describe("The amount of the asset to deposit"),
    onBehalfOf: z.string().describe("The address to deposit on behalf of"),
    referralCode: z.string().describe("The referral code to use"),
});

export const borrowSchema = z.object({
    asset: z.string().describe("The asset to withdraw"),
    amount: z.string().describe("The amount of the asset to withdraw"),
    interestRateMode: z.string().describe("The interest rate mode to use"),
    referralCode: z.string().describe("The referral code to use"),
    onBehalfOf: z.string().describe("The address to withdraw on behalf of"),
});

export const repaySchema = z.object({
    asset: z.string().describe("The asset to repay"),
    amount: z.string().describe("The amount of the asset to repay"),
    rateMode: z.string().describe("The rate mode to use"),
    onBehalfOf: z.string().describe("The address to repay on behalf of"),
});

export const withdrawSchema = z.object({
    asset: z.string().describe("The asset to withdraw"),
    amount: z.string().describe("The amount of the asset to withdraw"),
    to: z.string().describe("The address to withdraw to"),
});
