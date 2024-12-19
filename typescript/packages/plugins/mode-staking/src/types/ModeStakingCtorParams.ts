import { type Address } from "viem";

export type ModeStakingContractAddresses = {
    votingEscrow: Address;
    clock: Address;
    veNftLock: Address;
    stakeInspector: Address;
};

export type ModeStakingCtorParams = {
    addresses: ModeStakingContractAddresses;
};
