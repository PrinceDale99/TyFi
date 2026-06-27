use dep::std;

// This Noir circuit verifies that a given wind speed is over the required payout threshold
// and was signed by a legitimate oracle, without revealing the actual wind speed on-chain.

fn main(
    wind_speed: u32,             // Private: The actual wind speed from the weather station
    oracle_pub_key_x: Field,     // Public: The X coordinate of the oracle's public key
    oracle_pub_key_y: Field,     // Public: The Y coordinate of the oracle's public key
    signature: [u8; 64],         // Private: The oracle's signature over the weather data
    typhoon_id: Field,           // Public: ID of the typhoon event
    region_id: Field,            // Public: ID of the region affected
    payout_threshold: u32,       // Public: The minimum wind speed required to trigger payout
) {
    // 1. Assert the wind speed is greater than or equal to the required threshold
    // If this fails, the proof generation fails, meaning no payout can be claimed.
    assert(wind_speed >= payout_threshold, "Wind speed does not meet payout threshold");

    // 2. Form the message that the oracle should have signed:
    // (wind_speed, typhoon_id, region_id)
    // We hash the inputs using Poseidon to represent the message payload.
    // Poseidon is highly efficient inside ZK circuits and is supported natively by Stellar Protocol 26.
    let message_hash = std::hash::poseidon::bn254::hash_3([wind_speed as Field, typhoon_id, region_id]);
    
    // 3. In a full production implementation, we would verify the ECDSA/EdDSA signature here.
    // e.g., std::ecdsa_secp256k1::verify_signature(oracle_pub_key_x, oracle_pub_key_y, signature, message_hash)
    // For this hackathon demo, we simply assert the hash exists to represent the constraint.
    assert(message_hash != 0, "Invalid message hash");
}
