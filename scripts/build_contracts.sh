#!/bin/bash
set -e

echo "=== Building Soroban Contracts ==="
cd "$(dirname "$0")/../contracts"

echo "1. Building typhoon_resilience_vault..."
cargo build --target wasm32-unknown-unknown --release -p typhoon_resilience_vault

echo "2. Building smart_wallet_factory..."
cargo build --target wasm32-unknown-unknown --release -p smart_wallet_factory

echo "3. Building tyfi_dao..."
cargo build --target wasm32-unknown-unknown --release -p tyfi_dao

echo "=== All Soroban WASM artifacts successfully compiled ==="
