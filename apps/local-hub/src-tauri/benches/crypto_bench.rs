// Benchmarks for crypto operations to identify performance bottlenecks.
//
// Run with: cargo bench --bench crypto_bench
//
// Key finding: derive_key_from_passphrase uses 600,000 PBKDF2 iterations,
// which is intentionally slow (~200-800ms depending on hardware). This is
// the primary candidate for perceived "hangs" during encryption init/unlock.

use criterion::{criterion_group, criterion_main, Criterion};
use hh_local_hub_lib::crypto;

fn bench_derive_key(c: &mut Criterion) {
    let salt = crypto::generate_salt();

    c.bench_function("derive_key_from_passphrase (600k PBKDF2)", |b| {
        b.iter(|| {
            crypto::derive_key_from_passphrase("test-passphrase-benchmark", &salt);
        });
    });
}

fn bench_generate_salt(c: &mut Criterion) {
    c.bench_function("generate_salt (32 bytes)", |b| {
        b.iter(|| {
            crypto::generate_salt();
        });
    });
}

fn bench_key_to_hex(c: &mut Criterion) {
    let key = crypto::derive_key_from_passphrase("bench", b"salt-for-bench-32-bytes-padding!");

    c.bench_function("key_to_hex", |b| {
        b.iter(|| {
            crypto::key_to_hex(&key);
        });
    });
}

fn bench_generate_keypair(c: &mut Criterion) {
    c.bench_function("pairing::generate_keypair", |b| {
        b.iter(|| {
            crypto::pairing::generate_keypair();
        });
    });
}

fn bench_derive_shared_key(c: &mut Criterion) {
    let hub = crypto::pairing::generate_keypair();
    let client = crypto::pairing::generate_keypair();

    c.bench_function("pairing::derive_shared_key (ECDH + HKDF)", |b| {
        b.iter(|| {
            crypto::pairing::derive_shared_key(
                &hub.private_key_bytes,
                &client.public_key,
                &hub.public_key,
            )
            .unwrap();
        });
    });
}

fn bench_encrypt_small(c: &mut Criterion) {
    let hub = crypto::pairing::generate_keypair();
    let client = crypto::pairing::generate_keypair();
    let shared = crypto::pairing::derive_shared_key(
        &hub.private_key_bytes,
        &client.public_key,
        &hub.public_key,
    )
    .unwrap();

    let plaintext = b"small payload for benchmark";

    c.bench_function("pairing::encrypt (27 bytes)", |b| {
        b.iter(|| {
            crypto::pairing::encrypt(&shared, plaintext, b"command").unwrap();
        });
    });
}

fn bench_encrypt_large(c: &mut Criterion) {
    let hub = crypto::pairing::generate_keypair();
    let client = crypto::pairing::generate_keypair();
    let shared = crypto::pairing::derive_shared_key(
        &hub.private_key_bytes,
        &client.public_key,
        &hub.public_key,
    )
    .unwrap();

    let plaintext = vec![0xABu8; 100_000]; // 100KB payload

    c.bench_function("pairing::encrypt (100KB)", |b| {
        b.iter(|| {
            crypto::pairing::encrypt(&shared, &plaintext, b"command").unwrap();
        });
    });
}

fn bench_decrypt_small(c: &mut Criterion) {
    let hub = crypto::pairing::generate_keypair();
    let client = crypto::pairing::generate_keypair();
    let shared = crypto::pairing::derive_shared_key(
        &hub.private_key_bytes,
        &client.public_key,
        &hub.public_key,
    )
    .unwrap();

    let encrypted = crypto::pairing::encrypt(&shared, b"small payload", b"command").unwrap();

    c.bench_function("pairing::decrypt (small)", |b| {
        b.iter(|| {
            crypto::pairing::decrypt(&shared, &encrypted, b"command").unwrap();
        });
    });
}

fn bench_encrypt_decrypt_roundtrip(c: &mut Criterion) {
    let hub = crypto::pairing::generate_keypair();
    let client = crypto::pairing::generate_keypair();
    let shared = crypto::pairing::derive_shared_key(
        &hub.private_key_bytes,
        &client.public_key,
        &hub.public_key,
    )
    .unwrap();

    let plaintext = b"roundtrip benchmark payload";

    c.bench_function("pairing::encrypt+decrypt roundtrip", |b| {
        b.iter(|| {
            let encrypted = crypto::pairing::encrypt(&shared, plaintext, b"cmd").unwrap();
            crypto::pairing::decrypt(&shared, &encrypted, b"cmd").unwrap();
        });
    });
}

fn bench_encode_decode_public_key(c: &mut Criterion) {
    let kp = crypto::pairing::generate_keypair();

    c.bench_function("pairing::encode+decode public key", |b| {
        b.iter(|| {
            let encoded = crypto::pairing::encode_public_key(&kp.public_key);
            crypto::pairing::decode_public_key(&encoded).unwrap();
        });
    });
}

criterion_group!(
    benches,
    bench_derive_key,
    bench_generate_salt,
    bench_key_to_hex,
    bench_generate_keypair,
    bench_derive_shared_key,
    bench_encrypt_small,
    bench_encrypt_large,
    bench_decrypt_small,
    bench_encrypt_decrypt_roundtrip,
    bench_encode_decode_public_key,
);
criterion_main!(benches);
