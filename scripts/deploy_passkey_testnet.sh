#!/bin/bash
# Deploy the Week 3 seedless passkey stack to Stellar Testnet:
#   1. upload the smart_wallet WASM (installed, not instantiated — the factory
#      instantiates one copy per passkey),
#   2. deploy smart_wallet_factory with its admin + wallet code hash,
#   3. record everything in contracts/deployments/testnet-passkey.json.
#
# Usage: scripts/deploy_passkey_testnet.sh [source-identity]   (default: admin)
set -euo pipefail

SOURCE="${1:-admin}"
NETWORK="testnet"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM_DIR="${ROOT}/contracts/target/wasm32v1-none/release"
OUT="${ROOT}/contracts/deployments/testnet-passkey.json"

"${ROOT}/scripts/build_contracts.sh" >/dev/null

ADMIN="$(stellar keys address "${SOURCE}")"
echo "Deployer/admin: ${ADMIN}"

echo "→ Uploading smart_wallet WASM..."
WALLET_HASH="$(stellar contract upload --wasm "${WASM_DIR}/smart_wallet.wasm" --source "${SOURCE}" --network "${NETWORK}")"
echo "  wallet wasm hash: ${WALLET_HASH}"

echo "→ Deploying smart_wallet_factory..."
FACTORY_ID="$(stellar contract deploy --wasm "${WASM_DIR}/smart_wallet_factory.wasm" --source "${SOURCE}" --network "${NETWORK}" \
  -- --admin "${ADMIN}" --wallet_wasm_hash "${WALLET_HASH}")"
echo "  factory: ${FACTORY_ID}"

echo "→ Verifying on-chain state..."
ONCHAIN_HASH="$(stellar contract invoke --id "${FACTORY_ID}" --source "${SOURCE}" --network "${NETWORK}" --send=no -- wallet_wasm_hash | tr -d '"')"
[ "${ONCHAIN_HASH}" = "${WALLET_HASH}" ] || { echo "Factory wallet hash mismatch: ${ONCHAIN_HASH}"; exit 1; }

cat > "${OUT}" <<JSON
{
  "network": "testnet",
  "networkPassphrase": "Test SDF Network ; September 2015",
  "rpcUrl": "https://soroban-testnet.stellar.org",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "admin": "${ADMIN}",
  "smartWallet": {
    "wasmHash": "${WALLET_HASH}",
    "wasmSizeBytes": $(wc -c < "${WASM_DIR}/smart_wallet.wasm")
  },
  "smartWalletFactory": {
    "address": "${FACTORY_ID}",
    "wasmSizeBytes": $(wc -c < "${WASM_DIR}/smart_wallet_factory.wasm"),
    "explorerUrl": "https://stellar.expert/explorer/testnet/contract/${FACTORY_ID}"
  }
}
JSON
echo "Wrote ${OUT}"
