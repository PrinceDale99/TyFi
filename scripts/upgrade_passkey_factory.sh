#!/bin/bash
# Upgrade the deployed smart_wallet_factory in place (address and all state,
# including every wallet registration, are preserved). Admin-gated on-chain.
#
# Usage: scripts/upgrade_passkey_factory.sh [admin-identity]
set -euo pipefail

SOURCE="${1:-admin}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"
FACTORY_ID="$(node -p "require('./contracts/deployments/testnet-passkey.json').smartWalletFactory.address")"

(cd contracts && stellar contract build --package smart-wallet-factory >/dev/null)
echo "→ Uploading new factory WASM..."
NEW_HASH="$(stellar contract upload --wasm contracts/target/wasm32v1-none/release/smart_wallet_factory.wasm --source "${SOURCE}" --network testnet)"
echo "  hash: ${NEW_HASH}"

echo "→ Upgrading ${FACTORY_ID}..."
stellar contract invoke --id "${FACTORY_ID}" --source "${SOURCE}" --network testnet -- upgrade --new_wasm_hash "${NEW_HASH}"

echo "→ Verifying state survived the upgrade..."
stellar contract invoke --id "${FACTORY_ID}" --source "${SOURCE}" --network testnet --send=no -- wallet_count
echo "Done. Factory code: ${NEW_HASH}"
