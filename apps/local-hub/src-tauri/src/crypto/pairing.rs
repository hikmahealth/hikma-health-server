// X25519 keypair generation, ECDH key agreement, and AES-256-GCM encryption
// for device pairing between mobile clients and the local hub.
//
// Pure module — all functions take inputs and return outputs, no side effects.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ring::aead::{self, Aad, BoundKey, Nonce, NonceSequence, NONCE_LEN};
use ring::error::Unspecified;
use ring::hkdf;
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use x25519_dalek::{PublicKey, StaticSecret};

/// Newtype for a 32-byte X25519 public key
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PairingPublicKey(pub [u8; 32]);

/// Newtype for a 32-byte derived AES-256-GCM shared secret (never serialized)
#[derive(Clone)]
pub struct SharedSecret(pub [u8; 32]);

/// Generated hub keypair: private key bytes + derived public key
pub struct HubKeypair {
    pub private_key_bytes: [u8; 32],
    pub public_key: PairingPublicKey,
}

const HKDF_SALT: &[u8] = b"hikma-health-pairing-v1";

/// Generates a new X25519 keypair using OS randomness.
pub fn generate_keypair() -> HubKeypair {
    let rng = SystemRandom::new();
    let mut private_bytes = [0u8; 32];
    rng.fill(&mut private_bytes)
        .expect("Failed to generate random bytes for keypair");

    let secret = StaticSecret::from(private_bytes);
    let public = PublicKey::from(&secret);

    HubKeypair {
        private_key_bytes: private_bytes,
        public_key: PairingPublicKey(public.to_bytes()),
    }
}

/// Re-derives the public key from a stored private key.
pub fn public_key_from_private(private_bytes: &[u8; 32]) -> PairingPublicKey {
    let secret = StaticSecret::from(*private_bytes);
    PairingPublicKey(PublicKey::from(&secret).to_bytes())
}

/// Performs X25519 ECDH + HKDF-SHA256 to derive a shared AES-256-GCM key.
///
/// HKDF info = hub_pub ‖ client_pub (64 bytes) for domain separation.
/// Returns an error if the ECDH result is the all-zero point (invalid peer key).
pub fn derive_shared_key(
    hub_private: &[u8; 32],
    client_pub: &PairingPublicKey,
    hub_pub: &PairingPublicKey,
) -> Result<SharedSecret, String> {
    let secret = StaticSecret::from(*hub_private);
    let peer_public = PublicKey::from(client_pub.0);
    let shared_point = secret.diffie_hellman(&peer_public);

    // Reject the all-zero shared secret (low-order point attack)
    if shared_point.as_bytes().iter().all(|&b| b == 0) {
        return Err("ECDH produced all-zero shared secret (invalid peer key)".to_string());
    }

    // HKDF extract + expand
    let salt = hkdf::Salt::new(hkdf::HKDF_SHA256, HKDF_SALT);
    let prk = salt.extract(shared_point.as_bytes());

    // info = hub_pub ‖ client_pub
    let mut info = [0u8; 64];
    info[..32].copy_from_slice(&hub_pub.0);
    info[32..].copy_from_slice(&client_pub.0);

    let info_refs: &[&[u8]] = &[&info];
    let okm = prk
        .expand(info_refs, HkdfLen(32))
        .map_err(|_| "HKDF expand failed")?;

    let mut key_bytes = [0u8; 32];
    okm.fill(&mut key_bytes).map_err(|_| "HKDF fill failed")?;

    Ok(SharedSecret(key_bytes))
}

/// Encrypts plaintext with AES-256-GCM.
///
/// Returns base64url(nonce ‖ ciphertext ‖ tag). The `aad` parameter provides
/// domain separation (e.g. b"command", b"query").
pub fn encrypt(shared_key: &SharedSecret, plaintext: &[u8], aad: &[u8]) -> Result<String, String> {
    let rng = SystemRandom::new();
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rng.fill(&mut nonce_bytes)
        .map_err(|_| "Failed to generate nonce")?;

    let unbound_key = aead::UnboundKey::new(&aead::AES_256_GCM, &shared_key.0)
        .map_err(|_| "Failed to create AES key")?;
    let mut sealing_key = aead::SealingKey::new(unbound_key, SingleNonce(Some(nonce_bytes)));

    let mut in_out = plaintext.to_vec();
    sealing_key
        .seal_in_place_append_tag(Aad::from(aad), &mut in_out)
        .map_err(|_| "AES-GCM seal failed")?;

    // nonce ‖ ciphertext ‖ tag
    let mut output = Vec::with_capacity(NONCE_LEN + in_out.len());
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&in_out);

    Ok(URL_SAFE_NO_PAD.encode(&output))
}

/// Decrypts a base64url(nonce ‖ ciphertext ‖ tag) payload.
pub fn decrypt(shared_key: &SharedSecret, encoded: &str, aad: &[u8]) -> Result<Vec<u8>, String> {
    let data = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if data.len() < NONCE_LEN + aead::AES_256_GCM.tag_len() {
        return Err("Ciphertext too short".to_string());
    }

    let (nonce_bytes, ciphertext_and_tag) = data.split_at(NONCE_LEN);
    let mut nonce_arr = [0u8; NONCE_LEN];
    nonce_arr.copy_from_slice(nonce_bytes);

    let unbound_key = aead::UnboundKey::new(&aead::AES_256_GCM, &shared_key.0)
        .map_err(|_| "Failed to create AES key")?;
    let mut opening_key = aead::OpeningKey::new(unbound_key, SingleNonce(Some(nonce_arr)));

    let mut in_out = ciphertext_and_tag.to_vec();
    let plaintext = opening_key
        .open_in_place(Aad::from(aad), &mut in_out)
        .map_err(|_| "AES-GCM decryption failed (wrong key or tampered data)")?;

    Ok(plaintext.to_vec())
}

/// Encodes a public key as URL-safe base64 (no padding), producing 43 chars.
pub fn encode_public_key(pk: &PairingPublicKey) -> String {
    URL_SAFE_NO_PAD.encode(pk.0)
}

/// Decodes a URL-safe base64 string back to a PairingPublicKey.
pub fn decode_public_key(encoded: &str) -> Result<PairingPublicKey, String> {
    let bytes = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|e| format!("Invalid base64 public key: {}", e))?;

    if bytes.len() != 32 {
        return Err(format!(
            "Invalid public key length: expected 32 bytes, got {}",
            bytes.len()
        ));
    }

    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(PairingPublicKey(arr))
}

// -- ring helpers --

/// HKDF output length wrapper required by ring's API.
struct HkdfLen(usize);

impl hkdf::KeyType for HkdfLen {
    fn len(&self) -> usize {
        self.0
    }
}

/// A NonceSequence that yields exactly one nonce, then errors.
/// Used because we create a fresh key per encrypt/decrypt call.
struct SingleNonce(Option<[u8; NONCE_LEN]>);

impl NonceSequence for SingleNonce {
    fn advance(&mut self) -> Result<Nonce, Unspecified> {
        self.0
            .take()
            .map(Nonce::assume_unique_for_key)
            .ok_or(Unspecified)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn keypair_public_consistent_with_private() {
        let kp = generate_keypair();
        let derived = public_key_from_private(&kp.private_key_bytes);
        assert_eq!(kp.public_key, derived);
    }

    #[test]
    fn shared_key_agreement_symmetric() {
        let hub = generate_keypair();
        let client = generate_keypair();

        let hub_shared =
            derive_shared_key(&hub.private_key_bytes, &client.public_key, &hub.public_key).unwrap();

        // Client side: same ECDH but the info order is still hub_pub ‖ client_pub
        // Manually replicate what the client would do (same ECDH, same info order hub_pub ‖ client_pub):
        let client_secret = StaticSecret::from(client.private_key_bytes);
        let peer_public = PublicKey::from(hub.public_key.0);
        let shared_point = client_secret.diffie_hellman(&peer_public);

        let salt = hkdf::Salt::new(hkdf::HKDF_SHA256, HKDF_SALT);
        let prk = salt.extract(shared_point.as_bytes());
        let mut info = [0u8; 64];
        info[..32].copy_from_slice(&hub.public_key.0);
        info[32..].copy_from_slice(&client.public_key.0);
        let info_refs: &[&[u8]] = &[&info];
        let okm = prk.expand(info_refs, HkdfLen(32)).unwrap();
        let mut client_key = [0u8; 32];
        okm.fill(&mut client_key).unwrap();

        assert_eq!(hub_shared.0, client_key);
    }

    #[test]
    fn encrypt_decrypt_roundtrip_basic() {
        let hub = generate_keypair();
        let client = generate_keypair();
        let shared =
            derive_shared_key(&hub.private_key_bytes, &client.public_key, &hub.public_key).unwrap();

        let plaintext = b"hello hikma health";
        let aad = b"command";
        let encrypted = encrypt(&shared, plaintext, aad).unwrap();
        let decrypted = decrypt(&shared, &encrypted, aad).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn wrong_key_fails_decryption() {
        let hub = generate_keypair();
        let client = generate_keypair();
        let shared =
            derive_shared_key(&hub.private_key_bytes, &client.public_key, &hub.public_key).unwrap();

        let wrong_key = SharedSecret([0xAA; 32]);

        let encrypted = encrypt(&shared, b"secret data", b"command").unwrap();
        let result = decrypt(&wrong_key, &encrypted, b"command");
        assert!(result.is_err());
    }

    #[test]
    fn wrong_aad_fails_decryption() {
        let hub = generate_keypair();
        let client = generate_keypair();
        let shared =
            derive_shared_key(&hub.private_key_bytes, &client.public_key, &hub.public_key).unwrap();

        let encrypted = encrypt(&shared, b"data", b"command").unwrap();
        let result = decrypt(&shared, &encrypted, b"query");
        assert!(result.is_err());
    }

    #[test]
    fn encode_decode_public_key_roundtrip() {
        let kp = generate_keypair();
        let encoded = encode_public_key(&kp.public_key);
        assert_eq!(encoded.len(), 43); // 32 bytes → 43 base64url chars (no pad)
        let decoded = decode_public_key(&encoded).unwrap();
        assert_eq!(decoded, kp.public_key);
    }

    proptest! {
        #[test]
        fn encrypt_decrypt_roundtrip_arbitrary(
            plaintext in prop::collection::vec(any::<u8>(), 0..10000),
            aad_label in prop::sample::select(vec!["command", "query", "command_response", "query_response"]),
        ) {
            let hub = generate_keypair();
            let client = generate_keypair();
            let shared = derive_shared_key(
                &hub.private_key_bytes,
                &client.public_key,
                &hub.public_key,
            ).unwrap();

            let encrypted = encrypt(&shared, &plaintext, aad_label.as_bytes()).unwrap();
            let decrypted = decrypt(&shared, &encrypted, aad_label.as_bytes()).unwrap();
            prop_assert_eq!(decrypted, plaintext);
        }

        #[test]
        fn keypair_generation_consistent(
            _i in 0..20i32,
        ) {
            let kp = generate_keypair();
            let derived = public_key_from_private(&kp.private_key_bytes);
            prop_assert_eq!(kp.public_key, derived);
        }

        #[test]
        fn encode_decode_roundtrip(
            bytes in prop::collection::vec(any::<u8>(), 32..33),
        ) {
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            let pk = PairingPublicKey(arr);
            let encoded = encode_public_key(&pk);
            let decoded = decode_public_key(&encoded).unwrap();
            prop_assert_eq!(pk, decoded);
        }

        /// Property: each encryption of the same plaintext produces different ciphertext
        /// (because a fresh random nonce is used each time)
        #[test]
        fn encrypt_is_non_deterministic(
            plaintext in prop::collection::vec(any::<u8>(), 1..100),
        ) {
            let key = SharedSecret([0xAB; 32]);
            let enc1 = encrypt(&key, &plaintext, b"test").unwrap();
            let enc2 = encrypt(&key, &plaintext, b"test").unwrap();
            prop_assert_ne!(enc1, enc2, "two encryptions should produce different ciphertexts");
        }

        /// Property: shared key derivation is deterministic for the same inputs
        #[test]
        fn shared_key_derivation_deterministic(
            _i in 0..10i32,
        ) {
            let hub = generate_keypair();
            let client = generate_keypair();
            let sk1 = derive_shared_key(
                &hub.private_key_bytes, &client.public_key, &hub.public_key,
            ).unwrap();
            let sk2 = derive_shared_key(
                &hub.private_key_bytes, &client.public_key, &hub.public_key,
            ).unwrap();
            prop_assert_eq!(sk1.0, sk2.0);
        }

        /// Property: different keypairs produce different shared secrets
        #[test]
        fn different_peers_different_shared_keys(
            _i in 0..10i32,
        ) {
            let hub = generate_keypair();
            let client1 = generate_keypair();
            let client2 = generate_keypair();
            let sk1 = derive_shared_key(
                &hub.private_key_bytes, &client1.public_key, &hub.public_key,
            ).unwrap();
            let sk2 = derive_shared_key(
                &hub.private_key_bytes, &client2.public_key, &hub.public_key,
            ).unwrap();
            // Extremely unlikely to be equal for different keypairs
            prop_assert_ne!(sk1.0, sk2.0);
        }
    }

    // ========================================================================
    // Edge case tests for decode_public_key
    // ========================================================================

    #[test]
    fn decode_public_key_wrong_length_short() {
        let short = URL_SAFE_NO_PAD.encode(&[0u8; 16]);
        let result = decode_public_key(&short);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("expected 32 bytes"));
    }

    #[test]
    fn decode_public_key_wrong_length_long() {
        let long = URL_SAFE_NO_PAD.encode(&[0u8; 64]);
        let result = decode_public_key(&long);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("expected 32 bytes"));
    }

    #[test]
    fn decode_public_key_invalid_base64() {
        let result = decode_public_key("not!!valid!!base64!!");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid base64"));
    }

    #[test]
    fn decode_public_key_empty_string() {
        let result = decode_public_key("");
        assert!(result.is_err());
    }

    // ========================================================================
    // Ciphertext tampering tests
    // ========================================================================

    #[test]
    fn tampered_ciphertext_fails_decryption() {
        let key = SharedSecret([0x42; 32]);
        let encrypted = encrypt(&key, b"secret", b"aad").unwrap();

        // Decode, flip a byte in the middle, re-encode
        let mut raw = URL_SAFE_NO_PAD.decode(&encrypted).unwrap();
        let mid = raw.len() / 2;
        raw[mid] ^= 0xFF;
        let tampered = URL_SAFE_NO_PAD.encode(&raw);

        let result = decrypt(&key, &tampered, b"aad");
        assert!(result.is_err());
    }

    #[test]
    fn truncated_ciphertext_fails_decryption() {
        let key = SharedSecret([0x42; 32]);
        let encrypted = encrypt(&key, b"secret", b"aad").unwrap();

        // Truncate to just a few bytes
        let raw = URL_SAFE_NO_PAD.decode(&encrypted).unwrap();
        let truncated = URL_SAFE_NO_PAD.encode(&raw[..5]);

        let result = decrypt(&key, &truncated, b"aad");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too short"));
    }

    #[test]
    fn empty_ciphertext_fails_decryption() {
        let key = SharedSecret([0x42; 32]);
        let result = decrypt(&key, "", b"aad");
        assert!(result.is_err());
    }

    #[test]
    fn encrypt_empty_plaintext_roundtrips() {
        let key = SharedSecret([0x42; 32]);
        let encrypted = encrypt(&key, b"", b"aad").unwrap();
        let decrypted = decrypt(&key, &encrypted, b"aad").unwrap();
        assert!(decrypted.is_empty());
    }

    // ========================================================================
    // PairingPublicKey equality and hashing
    // ========================================================================

    #[test]
    fn pairing_public_key_equality() {
        let pk1 = PairingPublicKey([1u8; 32]);
        let pk2 = PairingPublicKey([1u8; 32]);
        let pk3 = PairingPublicKey([2u8; 32]);
        assert_eq!(pk1, pk2);
        assert_ne!(pk1, pk3);
    }

    #[test]
    fn pairing_public_key_hashable() {
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(PairingPublicKey([1u8; 32]));
        set.insert(PairingPublicKey([1u8; 32])); // duplicate
        set.insert(PairingPublicKey([2u8; 32]));
        assert_eq!(set.len(), 2);
    }
}
