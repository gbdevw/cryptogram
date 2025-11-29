import { BaseLog } from "../../common/types/types";
import { Address } from 'viem';

/**
 * Emitted when the authority address is updated.
 * 
 * @property authority The new authority address.
 */
export type AuthorityUpdatedLog = BaseLog & {
    authority: Address | undefined;
}
