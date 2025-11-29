import { BaseLog } from "../../common/types/types";
import { Address } from 'viem';

/**
 * Emitted when an operation is canceled.
 * 
 * @property operationId The unique identifier of the operation.
 * @property nonce The nonce of the operation.
 */
export type OperationCanceledLog = BaseLog & {
    operationId: `0x${string}` | undefined;
    nonce: number | undefined;
}

/**
 * Emitted when an operation is executed.
 * 
 * @property operationId The unique identifier of the operation.
 * @property nonce The nonce of the operation.
 */
export type OperationExecutedLog = BaseLog & {
    operationId: `0x${string}` | undefined;
    nonce: number | undefined;
}

/**
 * Emitted when an operation is scheduled.
 * 
 * @property operationId The unique identifier of the operation.
 * @property nonce The nonce of the operation.
 * @property schedule The timestamp when the operation can be executed.
 * @property caller The address that scheduled the operation.
 * @property target The target contract address.
 * @property data The calldata for the operation.
 */
export type OperationScheduledLog = BaseLog & {
    operationId: `0x${string}` | undefined;
    nonce: number | undefined;
    schedule: bigint | undefined;
    caller: Address | undefined;
    target: Address | undefined;
    data: `0x${string}` | undefined;
}

/**
 * Emitted when a role's admin is changed.
 * 
 * @property roleId The role identifier.
 * @property admin The new admin role identifier.
 */
export type RoleAdminChangedLog = BaseLog & {
    roleId: bigint | undefined;
    admin: bigint | undefined;
}

/**
 * Emitted when a role's grant delay is changed.
 * 
 * @property roleId The role identifier.
 * @property delay The new delay in seconds.
 * @property since The timestamp when the change takes effect.
 */
export type RoleGrantDelayChangedLog = BaseLog & {
    roleId: bigint | undefined;
    delay: number | undefined;
    since: bigint | undefined;
}

/**
 * Emitted when a role is granted to an account.
 * 
 * @property roleId The role identifier.
 * @property account The account receiving the role.
 * @property delay The execution delay for this grant.
 * @property since The timestamp when the role becomes active.
 * @property newMember True if this is the first time the account receives the role.
 */
export type RoleGrantedLog = BaseLog & {
    roleId: bigint | undefined;
    account: Address | undefined;
    delay: number | undefined;
    since: bigint | undefined;
    newMember: boolean | undefined;
}

/**
 * Emitted when a role's guardian is changed.
 * 
 * @property roleId The role identifier.
 * @property guardian The new guardian role identifier.
 */
export type RoleGuardianChangedLog = BaseLog & {
    roleId: bigint | undefined;
    guardian: bigint | undefined;
}

/**
 * Emitted when a role is labeled.
 * 
 * @property roleId The role identifier.
 * @property label The human-readable label for the role.
 */
export type RoleLabelLog = BaseLog & {
    roleId: bigint | undefined;
    label: string | undefined;
}

/**
 * Emitted when a role is revoked from an account.
 * 
 * @property roleId The role identifier.
 * @property account The account losing the role.
 */
export type RoleRevokedLog = BaseLog & {
    roleId: bigint | undefined;
    account: Address | undefined;
}

/**
 * Emitted when a target's admin delay is updated.
 * 
 * @property target The target contract address.
 * @property delay The new admin delay in seconds.
 * @property since The timestamp when the change takes effect.
 */
export type TargetAdminDelayUpdatedLog = BaseLog & {
    target: Address | undefined;
    delay: number | undefined;
    since: bigint | undefined;
}

/**
 * Emitted when a target is closed or reopened.
 * 
 * @property target The target contract address.
 * @property closed True if the target is closed, false if reopened.
 */
export type TargetClosedLog = BaseLog & {
    target: Address | undefined;
    closed: boolean | undefined;
}

/**
 * Emitted when a function's required role is updated.
 * 
 * @property target The target contract address.
 * @property selector The function selector.
 * @property roleId The role required to call this function.
 */
export type TargetFunctionRoleUpdatedLog = BaseLog & {
    target: Address | undefined;
    selector: `0x${string}` | undefined;
    roleId: bigint | undefined;
}
