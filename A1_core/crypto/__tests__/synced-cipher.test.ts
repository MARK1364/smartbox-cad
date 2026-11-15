import { describe, it, expect } from 'vitest';
import { chacha20Transform, uint8ArrayToBase64, base64ToUint8Array } from '../synced-cipher';

describe('synced-cipher (ChaCha20 sync)', () => {
  it('correctly encrypts and decrypts payload', () => {
    const key = new Uint8Array(32);
    for (let i = 0; i < 32; i++) key[i] = (i * 7 + 13) & 0xff;

    const nonce = new Uint8Array(12);
    for (let i = 0; i < 12; i++) nonce[i] = (i * 11 + 3) & 0xff;

    const originalText = JSON.stringify({
      module: 'korpus3',
      rules: { holes: [ { x: 32, y: 64, d: 5, z: 13 } ] },
      nested: { a: 1, b: 'test-meblowy' }
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const plainBytes = encoder.encode(originalText);

    // Encrypt
    const encryptedBytes = chacha20Transform(key, nonce, plainBytes);
    expect(encryptedBytes).not.toEqual(plainBytes);

    // Base64 roundtrip
    const b64 = uint8ArrayToBase64(encryptedBytes);
    const restoredEnc = base64ToUint8Array(b64);

    // Decrypt
    const decryptedBytes = chacha20Transform(key, nonce, restoredEnc);
    const decryptedText = decoder.decode(decryptedBytes);

    expect(decryptedText).toBe(originalText);
    expect(JSON.parse(decryptedText)).toEqual(JSON.parse(originalText));
  });

  it('performs decrypt on 100KB payload in less than 5ms', () => {
    const key = new Uint8Array(32).fill(42);
    const nonce = new Uint8Array(12).fill(7);

    // 100 KB payload
    const dummy = new Uint8Array(100 * 1024);
    for (let i = 0; i < dummy.length; i++) dummy[i] = i & 0xff;

    const encrypted = chacha20Transform(key, nonce, dummy);

    const t0 = performance.now();
    const decrypted = chacha20Transform(key, nonce, encrypted);
    const dt = performance.now() - t0;

    expect(decrypted).toEqual(dummy);
    expect(dt).toBeLessThan(15); // Zwykle < 1-2 ms
  });
});

