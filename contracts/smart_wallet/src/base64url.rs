//! Minimal `no_std` base64url encoder (RFC 4648 §5, no padding).
//!
//! WebAuthn places the challenge into `clientDataJSON` as unpadded base64url,
//! so the wallet encodes the 32-byte Soroban signature payload the same way
//! and compares the strings byte-for-byte.

const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// Length of the unpadded base64url encoding of a 32-byte value.
pub const ENCODED_32_LEN: usize = 43;

/// Encode exactly 32 bytes as unpadded base64url (43 characters).
pub fn encode_32(input: &[u8; 32]) -> [u8; ENCODED_32_LEN] {
    let mut out = [0u8; ENCODED_32_LEN];
    let mut o = 0;
    let mut i = 0;
    // 30 bytes = 10 full 3-byte groups → 40 characters.
    while i + 3 <= 30 {
        let n = ((input[i] as u32) << 16) | ((input[i + 1] as u32) << 8) | input[i + 2] as u32;
        out[o] = ALPHABET[((n >> 18) & 63) as usize];
        out[o + 1] = ALPHABET[((n >> 12) & 63) as usize];
        out[o + 2] = ALPHABET[((n >> 6) & 63) as usize];
        out[o + 3] = ALPHABET[(n & 63) as usize];
        i += 3;
        o += 4;
    }
    // Remaining 2 bytes → 3 characters (no padding).
    let n = ((input[30] as u32) << 16) | ((input[31] as u32) << 8);
    out[o] = ALPHABET[((n >> 18) & 63) as usize];
    out[o + 1] = ALPHABET[((n >> 12) & 63) as usize];
    out[o + 2] = ALPHABET[((n >> 6) & 63) as usize];
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_zero_bytes() {
        assert_eq!(&encode_32(&[0u8; 32]), b"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    }

    #[test]
    fn encodes_url_safe_alphabet() {
        // 0xff…ff exercises the '-' / '_' characters that differ from standard base64.
        assert_eq!(&encode_32(&[0xffu8; 32]), b"__________________________________________8");
    }

    #[test]
    fn encodes_known_vector() {
        let mut input = [0u8; 32];
        for (i, b) in input.iter_mut().enumerate() {
            *b = i as u8;
        }
        // Cross-checked with Node: Buffer.from([...Array(32).keys()]).toString('base64url')
        assert_eq!(&encode_32(&input), b"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8");
    }
}
