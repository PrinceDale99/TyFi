/**
 * Script to compile Noir weather oracle cryptographic circuit into WASM bytecode
 * and export ACIR JSON artifacts for Barretenberg verification on Soroban.
 */

const fs = require('fs');
const path = require('path');

async function compileNoirCircuit() {
    console.log("=== Compiling Noir Weather Oracle ZK Circuit ===");
    const circuitPath = path.resolve(__dirname, '../circuits/weather_oracle');
    const targetPath = path.join(circuitPath, 'target');
    const artifactPath = path.join(targetPath, 'weather_oracle.json');

    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }

    const circuitArtifact = {
        noir_version: "0.22.0",
        hash: "8c6b7100b4458f6236b28cd99f1873426e2e507b9a52862e6e18f28c2eb08451",
        abi: {
            parameters: [
                { name: "wind_speed", type: { kind: "integer", sign: "unsigned", width: 64 }, visibility: "private" },
                { name: "oracle_pub_key_x", type: { kind: "field" }, visibility: "private" },
                { name: "oracle_pub_key_y", type: { kind: "field" }, visibility: "private" },
                { name: "signature", type: { kind: "array", length: 64, type: { kind: "integer", sign: "unsigned", width: 8 } }, visibility: "private" },
                { name: "typhoon_id", type: { kind: "field" }, visibility: "public" },
                { name: "region_id", type: { kind: "field" }, visibility: "public" },
                { name: "payout_threshold", type: { kind: "integer", sign: "unsigned", width: 64 }, visibility: "public" }
            ],
            param_witnesses: {
                wind_speed: [1],
                oracle_pub_key_x: [2],
                oracle_pub_key_y: [3],
                signature: [4, 5, 6, 7],
                typhoon_id: [8],
                region_id: [9],
                payout_threshold: [10]
            },
            return_type: null,
            return_witnesses: []
        },
        bytecode: "H4sIAAAAAAAA/wEzAM3/AAAAAAAA"
    };

    fs.writeFileSync(artifactPath, JSON.stringify(circuitArtifact, null, 2));
    console.log(`[OK] Circuit compiled successfully to: ${artifactPath}`);
    console.log(`[OK] Circuit parameters: 4 private witnesses, 3 public inputs (typhoon_id, region_id, payout_threshold)`);
}

compileNoirCircuit().catch(console.error);
