import { type Address } from "viem";

export type IronCladContractAddresses = {
    lendingPool: Address;
    protocolDataProvider: Address;
};

export type IronCladCtorParams = {
    addresses: IronCladContractAddresses;
};
