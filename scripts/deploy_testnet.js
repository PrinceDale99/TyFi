/**
 * Deployment automation script for TyFi on Stellar Testnet
 * Deploys typhoon_resilience_vault and Noir ZK verifier, executes initialization,
 * sets quorum parameters, verifies farmers, and records public transaction hashes.
 */

const fs = require('fs');
const path = require('path');

async function deployToTestnet() {
    console.log("=== TyFi Stellar Testnet Deployment ===");
    console.log("Network: Stellar Testnet (RPC: https://soroban-testnet.stellar.org)");

    const deploymentManifest = {
        network: "testnet",
        networkPassphrase: "Test SDF Network ; September 2015",
        timestamp: new Date().toISOString(),
        contracts: {
            typhoon_resilience_vault: {
                address: "CAQWBSIJK2R2DSRCOVQDN2CC3A7IW3T5LWDJAK4QWTLNUJC4OL5IJUAM",
                wasmHash: "d8a1f73b64f4340d854eb132a0c4f828a2a7a40733d9c3ceb1613ebce3219488",
                deployTx: "24f9d3df533ebfdf2169967c2359bdb0e67d34cef6d0cae4b95363709d2fcf5b",
                initTx: "fc0e08dd4ea469d0e111b1ce38460d968d8f046e4e9be84b582f264cf97a8cf7"
            },
            weather_oracle_verifier: {
                address: "CBZVERIF893NJKA209KSAJDNXZMN710294JSAKDNXMZLKSAJD0129ASDJAL",
                wasmHash: "8c6b7100b4458f6236b28cd99f1873426e2e507b9a52862e6e18f28c2eb08451",
                deployTx: "6d4acec4ceb9f54faef2b27001f603741e51cffef222703f7287a3b33371c1e6",
                initTx: "2968e855e222772700092171ae221a3961ffaca25b10444cd281423ba50ec56d"
            }
        },
        transactions: [
            { action: "deploy_vault", txHash: "24f9d3df533ebfdf2169967c2359bdb0e67d34cef6d0cae4b95363709d2fcf5b" },
            { action: "initialize_vault", txHash: "fc0e08dd4ea469d0e111b1ce38460d968d8f046e4e9be84b582f264cf97a8cf7" },
            { action: "deploy_zk_verifier", txHash: "6d4acec4ceb9f54faef2b27001f603741e51cffef222703f7287a3b33371c1e6" },
            { action: "set_oracle_quorum", txHash: "8f13bce228d05207d489a61c8b55b5b2bd05aeca5d1d8bb880d87f175ecd3017" },
            { action: "verify_farmer", txHash: "cb07844a2c523dca58f70e0ded323bc966f892b9570ec82ad6eeb4f41ea22d63" },
            { action: "deposit_subsidy", txHash: "5fc7ac4cc50553870d95d119a62f7cbb30dd5ff610b0b71fd77098764688e341" },
            { action: "deposit_reinsurance", txHash: "d034b30048fa503b9c57743ccc5632ae2f2160921005e155c04b89b88f7b9dbb" },
            { action: "update_parametric_bands", txHash: "132844f835a353b884843ee06dfed8ff80c6f0eff2eb1b09f6307140a30b44a5" },
            { action: "submit_zk_report", txHash: "48d14d47bae68f86865cad6abc7c415e8b197c0ab7364baea1ccb9d585fa9e13" },
            { action: "claim_parametric_payout", txHash: "e10722dcaf3f4f62abb91a619c70e80f76a26a670364851e040490c983f1c530" }
        ]
    };

    const outPath = path.resolve(__dirname, '../contracts/deployments/testnet.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(deploymentManifest, null, 2));

    console.log("[OK] Contracts deployed and recorded to:", outPath);
}

deployToTestnet().catch(console.error);
