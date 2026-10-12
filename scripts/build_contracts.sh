#!/bin/bash
set -euo pipefail

echo "=== Building Soroban Contracts ==="
cd "$(dirname "$0")/../contracts"

# Protocol 22+ contracts target wasm32v1-none. smart_wallet is built first:
# the factory's tests embed its WASM to deploy real wallets.
for pkg in smart_wallet smart-wallet-factory typhoon_resilience_vault tyfi_dao; do
  echo "→ Building ${pkg}..."
  stellar contract build --package "${pkg}"
done

echo "=== All Soroban WASM artifacts successfully compiled ==="
ls -l target/wasm32v1-none/release/*.wasm
