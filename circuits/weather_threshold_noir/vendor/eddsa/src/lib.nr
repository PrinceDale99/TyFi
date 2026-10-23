use poseidon;
use std::default::Default;
use std::hash::Hasher;

use edwards::{bjj::BabyJubJub, Curve, CurveTrait, ScalarField};

// Baby JubJub subgroup order
global SUBORDER: Field =
    2736030358979909402780800718157159386076813972158567259200215660948447373041;

// Generator * 8
global BASE8_X: Field =
    5299619240641551281634865583518297030282874472190772894086521144482721001553;
global BASE8_Y: Field =
    16950150798460657717958625567821834550301663161624707787222815936182638968203;

pub fn eddsa_verify<H>(
    pub_key_x: Field,
    pub_key_y: Field,
    signature_s: Field,
    signature_r8_x: Field,
    signature_r8_y: Field,
    message: Field,
) -> bool
where
    H: Hasher + Default,
{
    // Verifies by testing:
    // S * B8 = R8 + H(R8, A, m) * A8

    // BabyJubJub::new asserts the point is on the curve
    let pub_key = BabyJubJub::new(pub_key_x, pub_key_y);
    let signature_r8 = BabyJubJub::new(signature_r8_x, signature_r8_y);
    // Ensure S < Subgroup Order
    assert(signature_s.lt(SUBORDER));
    // Calculate the h = H(R, A, msg)
    let mut hasher = H::default();
    hasher.write(signature_r8_x);
    hasher.write(signature_r8_y);
    hasher.write(pub_key_x);
    hasher.write(pub_key_y);
    hasher.write(message);
    let hash: Field = hasher.finish();
    // Calculate second part of the right side:  right2 = h*8*A
    // Multiply by 8 by doubling 3 times. This also ensures that the result is in the subgroup.
    let pub_key_mul_2 = pub_key.dbl();
    let pub_key_mul_4 = pub_key_mul_2.dbl();
    let pub_key_mul_8 = pub_key_mul_4.dbl();
    // We check that A8 is not zero.
    assert(!pub_key_mul_8.is_zero());
    // Compute the right side: R8 + h * A8
    let right = signature_r8 + pub_key_mul_8.mul(ScalarField::<64>::from(hash));
    // Calculate left side of equation left = S * B8
    let base8: BabyJubJub = Curve { x: BASE8_X, y: BASE8_Y };
    let left = base8.mul(ScalarField::<63>::from(signature_s));

    left == right
}

// Returns the public key of the given secret key as (pub_key_x, pub_key_y)
pub fn eddsa_to_pub(secret: Field) -> (Field, Field) {
    let pub_key = BabyJubJub::one().mul(ScalarField::<64>::from(secret));
    (pub_key.x, pub_key.y)
}

mod tests {
    use poseidon::poseidon::PoseidonHasher;
    use poseidon::poseidon2::Poseidon2Hasher;

    use edwards::{bjj::BabyJubJub, Curve, CurveTrait, ScalarField};

    use super::{BASE8_X, BASE8_Y, eddsa_to_pub, eddsa_verify};

    #[test]
    fn main() {
        let priv_key_a = 123;
        let priv_key_b = 456;
        let msg = 789;

        let pub_key_a = BabyJubJub::one().mul(ScalarField::<63>::from(priv_key_a));
        let pub_key_b = BabyJubJub::one().mul(ScalarField::<63>::from(priv_key_b));
        let (pub_key_a_x, pub_key_a_y) = eddsa_to_pub(priv_key_a);
        let (pub_key_b_x, pub_key_b_y) = eddsa_to_pub(priv_key_b);
        assert(BabyJubJub::new(pub_key_a_x, pub_key_a_y) == pub_key_a);
        assert(BabyJubJub::new(pub_key_b_x, pub_key_b_y) == pub_key_b);
        // Manually computed as fields can't use modulo. Importantly the commitment is within
        // the subgroup order. Note that choice of hash is flexible for this step.
        let r_a = 1414770703199880747815475415092878800081323795074043628810774576767372531818;
        let r_b = 571799555715456644614141527517766533395606396271089506978608487688924659618;

        let base8: BabyJubJub = Curve { x: BASE8_X, y: BASE8_Y };
        let r8_a = base8.mul(ScalarField::<63>::from(r_a));
        let r8_b = base8.mul(ScalarField::<63>::from(r_b));
        let s_a = 30333430637424319196043722294837632681219980330991241982145549329256671548;
        let s_b = 1646085314320208098241070054368798527940102577261034947654839408482102287019;
        // User A verifies their signature over the message
        assert(eddsa_verify::<PoseidonHasher>(pub_key_a.x, pub_key_a.y, s_a, r8_a.x, r8_a.y, msg));
        // User B's signature over the message can't be used with user A's pub key
        assert(!eddsa_verify::<PoseidonHasher>(pub_key_a.x, pub_key_a.y, s_b, r8_b.x, r8_b.y, msg));
        // User A's signature over the message can't be used with another message
        assert(
            !eddsa_verify::<PoseidonHasher>(pub_key_a.x, pub_key_a.y, s_a, r8_a.x, r8_a.y, msg + 1),
        );
        // Using a different hash should fail
        assert(
            !eddsa_verify::<Poseidon2Hasher>(pub_key_a.x, pub_key_a.y, s_a, r8_a.x, r8_a.y, msg),
        );
    }
}

#[export]
fn bench_eddsa_poseidon(
    pub_key_x: Field,
    pub_key_y: Field,
    signature_s: Field,
    signature_r8_x: Field,
    signature_r8_y: Field,
    message: Field,
) -> bool {
    eddsa_verify::<poseidon::poseidon::PoseidonHasher>(
        pub_key_x,
        pub_key_y,
        signature_s,
        signature_r8_x,
        signature_r8_y,
        message,
    )
}
