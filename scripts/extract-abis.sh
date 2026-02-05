#!/bin/bash
# Script to extract ABIs from forge build output and generate TypeScript files

set -e

CONTRACTS_DIR="/home/gbdevw/Projects/cryptogram/contracts"
SDK_ABIS_DIR="/home/gbdevw/Projects/cryptogram/sdks/typescript/src/abis"
OUT_DIR="$CONTRACTS_DIR/out"

echo "Extracting ABIs from forge build output..."

# Function to generate TypeScript ABI file
generate_ts_abi() {
    local contract_name=$1
    local sol_file=$2
    local output_file="$SDK_ABIS_DIR/${contract_name}.ts"
    
    echo "Processing $contract_name..."
    
    # Extract ABI from JSON
    local abi_json=$(cat "$OUT_DIR/${sol_file}/${contract_name}.json" | jq -c '.abi')
    
    # Generate TypeScript file with proper export name
    cat > "$output_file" << EOF
/**
 * ABI for ${contract_name}
 * Auto-generated from Foundry build artifacts
 */
export const ${contract_name} = ${abi_json} as const;

export default ${contract_name};
EOF
    
    echo "✓ Generated $output_file"
}

# Generate ABIs for all contracts
generate_ts_abi "Web3PGP" "Web3PGP.sol"
generate_ts_abi "Web3Doc" "Web3Doc.sol"
generate_ts_abi "Web3Sign" "Web3Sign.sol"
generate_ts_abi "FlatFee" "FlatFee.sol"
generate_ts_abi "IWeb3PGP" "IWeb3PGP.sol"
generate_ts_abi "IWeb3Doc" "IWeb3Doc.sol"
generate_ts_abi "IWeb3Sign" "IWeb3Sign.sol"
generate_ts_abi "IFlatFee" "IFlatFee.sol"

echo ""
echo "✓ All ABIs generated successfully in $SDK_ABIS_DIR"
