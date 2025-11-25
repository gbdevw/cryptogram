import { BaseLog } from "../../common/types/types";
import { Address } from 'viem';

/**
 * Emitted when the fee is updated.
 * 
 * @property oldFee The old fee.
 * @property newFee The new fee.
 */
export type RequestedFeeUpdatedLog = BaseLog & {
    oldFee: bigint | undefined;
    newFee: bigint | undefined;
}

/**
 * Emitted when the fees are withdrawn.
 * 
 * @property to The address to which the fees are withdrawn.
 * @property amount The amount withdrawn.
 */
export type FeesWithdrawnLog = BaseLog & {
    to: Address | undefined;
    amount: bigint | undefined;
}