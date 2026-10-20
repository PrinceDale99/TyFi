pragma circom 2.1.6;

// TyFi weather trigger circuit (Groth16 / BN254).
//
// Proves that an authorized oracle signed a wind reading for (typhoon, region)
// and that the reading meets the payout threshold — without putting the raw
// wind speed on-chain. The vault contract derives typhoon_id / region_id from
// the Symbols it is called with, so a proof cannot be replayed for another
// storm or region.

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template WeatherThreshold() {
    // --- Public ---
    signal input oracle_key_hash;    // Poseidon(Ax, Ay) of the oracle's EdDSA key
    signal input typhoon_id;         // sha256(XDR(Symbol)) truncated to 248 bits
    signal input region_id;          // same encoding as typhoon_id
    signal input payout_threshold;   // km/h
    signal input damage_percentage;  // 0..=100

    // --- Private ---
    signal input wind_speed;         // km/h, the raw reading kept off-chain
    signal input Ax;
    signal input Ay;
    signal input R8x;
    signal input R8y;
    signal input S;

    // Range-check the numeric inputs so the comparators below are sound.
    component windBits = Num2Bits(32);
    windBits.in <== wind_speed;
    component thresholdBits = Num2Bits(32);
    thresholdBits.in <== payout_threshold;
    component damageBits = Num2Bits(8);
    damageBits.in <== damage_percentage;

    // 1. The reading meets the payout threshold.
    component meets = GreaterEqThan(32);
    meets.in[0] <== wind_speed;
    meets.in[1] <== payout_threshold;
    meets.out === 1;

    // 2. A zero threshold would make every reading pay out.
    component thresholdIsZero = IsZero();
    thresholdIsZero.in <== payout_threshold;
    thresholdIsZero.out === 0;

    // 3. Damage is a percentage.
    component damageInRange = LessEqThan(8);
    damageInRange.in[0] <== damage_percentage;
    damageInRange.in[1] <== 100;
    damageInRange.out === 1;

    // 4. The signing key is the one registered for this oracle.
    component keyHash = Poseidon(2);
    keyHash.inputs[0] <== Ax;
    keyHash.inputs[1] <== Ay;
    keyHash.out === oracle_key_hash;

    // 5. The oracle signed exactly this (typhoon, region, wind, damage) reading.
    component msg = Poseidon(4);
    msg.inputs[0] <== typhoon_id;
    msg.inputs[1] <== region_id;
    msg.inputs[2] <== wind_speed;
    msg.inputs[3] <== damage_percentage;

    component sig = EdDSAPoseidonVerifier();
    sig.enabled <== 1;
    sig.Ax <== Ax;
    sig.Ay <== Ay;
    sig.R8x <== R8x;
    sig.R8y <== R8y;
    sig.S <== S;
    sig.M <== msg.out;
}

// Public signal order is what the vault contract feeds into the IC MSM.
component main { public [oracle_key_hash, typhoon_id, region_id, payout_threshold, damage_percentage] } = WeatherThreshold();
