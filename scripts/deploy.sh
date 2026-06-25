#!/bin/bash
# Deploy script for TyFi on Soroban
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/typhoon_resilience_vault.wasm --source alice --network testnet
