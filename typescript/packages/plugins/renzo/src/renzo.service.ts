import { Tool } from "@goat-sdk/core";
import type { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { RENZO_ABI } from "./abi/renzo";
import { EZETH_ABI } from "./abi/ezeth";
import type { ChainSpecifications } from "./types/ChainSpecifications";
import { depositSchema } from "./parameters";
import { parseUnits } from "viem";
import { z } from "zod";

export class RenzoService {
    constructor(private readonly chainSpecifications: ChainSpecifications) {}

    @Tool({
        name: "renzo_deposit_erc20",
        description: "Deposit ERC20 LST tokens into Renzo",
    })
    async depositERC20(
        walletClient: EVMWalletClient,
        spec: ChainSpecifications,
        parameters: z.infer<typeof depositSchema>
    ): Promise<string> {
        try {
            const depositToken = await walletClient.read({
                address: spec[walletClient.getChain().id].renzoDepositAddress,
                abi: RENZO_ABI,
                functionName: "depositToken",
            });

            if (
                parameters._token.toLowerCase() !==
                (depositToken as unknown as string).toLowerCase()
            ) {
                throw new Error(
                    `Invalid token: ${parameters._token}. Expected deposit token: ${depositToken}`
                );
            }

            const depositAmount = parseUnits(parameters._amountIn, 18);
            const _minOut = parseUnits(parameters._minOut, 18);

            const hash = await walletClient.sendTransaction({
                to: spec[walletClient.getChain().id].renzoDepositAddress,
                abi: RENZO_ABI,
                functionName: "deposit",
                args: [depositAmount, _minOut, parameters._deadline],
            });

            return hash.hash;
        } catch (error) {
            throw Error(`Failed to deposit ERC20: ${error}`);
        }
    }
}
