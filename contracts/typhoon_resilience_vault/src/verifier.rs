use soroban_sdk::{
    contracttype,
    crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine},
    BytesN, Env, Vec, U256,
};

/// Groth16 verification key over BN254, in the Soroban (Ethereum-compatible)
/// encoding: G1 = be(X) || be(Y), G2 = be(X.c1) || be(X.c0) || be(Y.c1) || be(Y.c0).
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Groth16VerifyingKey {
    pub alpha: BytesN<64>,
    pub beta: BytesN<128>,
    pub gamma: BytesN<128>,
    pub delta: BytesN<128>,
    /// IC[0] plus one point per public input.
    pub ic: Vec<BytesN<64>>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Groth16Proof {
    pub a: BytesN<64>,
    pub b: BytesN<128>,
    pub c: BytesN<64>,
}

/// Verifies a Groth16 proof with the BN254 host functions.
///
/// Checks `e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1`,
/// where `vk_x = IC[0] + Σ public_inputs[i] · IC[i+1]`.
pub fn verify_groth16(
    env: &Env,
    vk: &Groth16VerifyingKey,
    proof: &Groth16Proof,
    public_inputs: &Vec<U256>,
) -> bool {
    if vk.ic.len() != public_inputs.len() + 1 {
        return false;
    }
    let bn = env.crypto().bn254();

    let mut points: Vec<Bn254G1Affine> = Vec::new(env);
    let mut scalars: Vec<Bn254Fr> = Vec::new(env);
    for i in 0..public_inputs.len() {
        points.push_back(Bn254G1Affine::from_bytes(vk.ic.get_unchecked(i + 1)));
        scalars.push_back(Bn254Fr::from_u256(public_inputs.get_unchecked(i)));
    }
    let ic0 = Bn254G1Affine::from_bytes(vk.ic.get_unchecked(0));
    let vk_x = if points.is_empty() { ic0 } else { bn.g1_add(&ic0, &bn.g1_msm(points, scalars)) };

    let neg_a = -Bn254G1Affine::from_bytes(proof.a.clone());

    let mut g1: Vec<Bn254G1Affine> = Vec::new(env);
    g1.push_back(neg_a);
    g1.push_back(Bn254G1Affine::from_bytes(vk.alpha.clone()));
    g1.push_back(vk_x);
    g1.push_back(Bn254G1Affine::from_bytes(proof.c.clone()));

    let mut g2: Vec<Bn254G2Affine> = Vec::new(env);
    g2.push_back(Bn254G2Affine::from_bytes(proof.b.clone()));
    g2.push_back(Bn254G2Affine::from_bytes(vk.beta.clone()));
    g2.push_back(Bn254G2Affine::from_bytes(vk.gamma.clone()));
    g2.push_back(Bn254G2Affine::from_bytes(vk.delta.clone()));

    bn.pairing_check(g1, g2)
}
