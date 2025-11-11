/**
 * ABI for IFlatFee
 * Auto-generated from Foundry build artifacts
 */
export const IFlatFee = [{"type":"function","name":"requestedFee","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},{"type":"function","name":"updateRequestedFee","inputs":[{"name":"newFee","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"function","name":"withdrawFees","inputs":[{"name":"to","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},{"type":"event","name":"FeesWithdrawn","inputs":[{"name":"to","type":"address","indexed":true,"internalType":"address"},{"name":"amount","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"event","name":"RequestedFeeUpdated","inputs":[{"name":"oldFee","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"newFee","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},{"type":"error","name":"FeeRequired","inputs":[{"name":"provided","type":"uint256","internalType":"uint256"},{"name":"required","type":"uint256","internalType":"uint256"}]},{"type":"error","name":"FeesWithdrawalFailed","inputs":[]},{"type":"error","name":"NoDirectPaymentsAllowed","inputs":[]},{"type":"error","name":"NoFeesToWithdraw","inputs":[]}] as const;

export default IFlatFee;
