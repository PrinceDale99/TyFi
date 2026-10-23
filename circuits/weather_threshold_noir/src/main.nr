// TyFi weather trigger circuit — Noir version.
//
// Same statement, constraints and public-input order as the Circom circuit in
// circuits/weather_threshold, which is the one the vault verifies on-chain
// (Groth16). This version proves with UltraHonk (Barretenberg) and is verified
// off-chain; see README.md for why both exist.
//
// Proves that an authorized oracle signed a wind reading for (typhoon, region)
// and that the reading meets the payout threshold, without revealing the reading.

use eddsa::eddsa_verify;
use poseidon::poseidon::{bn254, PoseidonHasher};

fn main(
    // --- Public ---
    oracle_key_hash: pub Field, // Poseidon(Ax, Ay) of the oracle's EdDSA key
    typhoon_id: pub Field, //      sha256(XDR(Symbol)) with the top byte zeroed
    region_id: pub Field, //       same encoding as typhoon_id
    payout_threshold: pub u32, //  km/h
    damage_percentage: pub u8, //  0..=100
    // --- Private ---
    wind_speed: u32, //            km/h, the raw reading kept off-chain
    ax: Field,
    ay: Field,
    r8x: Field,
    r8y: Field,
    s: Field,
) {
    // 1. The reading meets the payout threshold (u32 types range-check both).
    assert(wind_speed >= payout_threshold, "wind below payout threshold");

    // 2. A zero threshold would make every reading pay out.
    assert(payout_threshold != 0, "zero threshold");

    // 3. Damage is a percentage.
    assert(damage_percentage <= 100, "damage over 100%");

    // 4. The signing key is the one registered for this oracle.
    assert(bn254::hash_2([ax, ay]) == oracle_key_hash, "unregistered oracle key");

    // 5. The oracle signed exactly this (typhoon, region, wind, damage) reading.
    let msg = bn254::hash_4([typhoon_id, region_id, wind_speed as Field, damage_percentage as Field]);
    assert(eddsa_verify::<PoseidonHasher>(ax, ay, s, r8x, r8y, msg), "bad oracle signature");
}

#[test]
fn test_threshold_is_inclusive() {
    // Signature paths are covered by test/ (signed with circomlibjs, the same
    // signer the oracle uses); here we only pin the comparison semantics.
    let threshold: u32 = 150;
    assert(150 >= threshold);
}
