#!/bin/bash
# Operator rent maintenance for the passkey stack.
#
# Contracts deliberately do not extend TTLs on user transactions (that would
# make an individual user's payment pay rent for code shared by every wallet).
# Run this on a schedule (e.g. weekly cron) to keep the shared pieces alive:
#   - the smart_wallet WASM code entry (shared by all wallets),
#   - the factory instance + its code.
# Archived per-wallet entries are restored on demand by the relayer.
#
# Usage: scripts/extend_passkey_ttl.sh [source-identity] [ledgers]
set -euo pipefail

SOURCE="${1:-admin}"
LEDGERS="${2:-535679}"   # ~31 days at 5s ledgers
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"
DEPLOYMENT="./contracts/deployments/testnet-passkey.json"

FACTORY_ID="$(node -p "require('${DEPLOYMENT}').smartWalletFactory.address")"
WALLET_HASH="$(node -p "require('${DEPLOYMENT}').smartWallet.wasmHash")"

echo "→ Extending smart_wallet code ${WALLET_HASH} by ${LEDGERS} ledgers"
stellar contract extend --wasm-hash "${WALLET_HASH}" --ledgers-to-extend "${LEDGERS}" --durability persistent --source "${SOURCE}" --network testnet

echo "→ Extending factory instance + code ${FACTORY_ID}"
stellar contract extend --id "${FACTORY_ID}" --key-xdr AAAAFA== --ledgers-to-extend "${LEDGERS}" --durability persistent --source "${SOURCE}" --network testnet
stellar contract extend --wasm "${ROOT}/contracts/target/wasm32v1-none/release/smart_wallet_factory.wasm" --ledgers-to-extend "${LEDGERS}" --durability persistent --source "${SOURCE}" --network testnet
echo "Done."
