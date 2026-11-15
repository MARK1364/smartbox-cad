/**
 * synced-cipher.ts
 * 
 * Ultralekki, w 100% synchroniczny szyfr strumieniowy (ChaCha20) operujący na Uint8Array.
 * Nie wymaga asynchronicznego Web Crypto API (subtle), dzięki czemu silniki matematyczne
 * A2 i A3 mogą pobierać zdeszyfrowane reguły natychmiast i synchronicznie w < 1 ms.
 */

function rotl(v: number, c: number): number {
  return ((v << c) | (v >>> (32 - c))) >>> 0;
}

function quarterRound(x: Uint32Array, a: number, b: number, c: number, d: number): void {
  x[a] = (x[a] + x[b]) >>> 0; x[d] = rotl(x[d] ^ x[a], 16);
  x[c] = (x[c] + x[d]) >>> 0; x[b] = rotl(x[b] ^ x[c], 12);
  x[a] = (x[a] + x[b]) >>> 0; x[d] = rotl(x[d] ^ x[a], 8);
  x[c] = (x[c] + x[d]) >>> 0; x[b] = rotl(x[b] ^ x[c], 7);
}

/**
 * ChaCha20 core keystream block generator (RFC 7539 / 8439)
 */
function chacha20Block(key: Uint32Array, nonce: Uint32Array, counter: number, out: Uint8Array, outOffset: number): void {
  const state = new Uint32Array(16);
  // Constants: "expand 32-byte k"
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;
  // Key (256-bit = 8 words)
  for (let i = 0; i < 8; i++) state[4 + i] = key[i];
  // Counter (1 word)
  state[12] = counter >>> 0;
  // Nonce (96-bit = 3 words)
  state[13] = nonce[0];
  state[14] = nonce[1];
  state[15] = nonce[2];

  const working = new Uint32Array(16);
  working.set(state);

  for (let i = 0; i < 10; i++) {
    quarterRound(working, 0, 4, 8, 12);
    quarterRound(working, 1, 5, 9, 13);
    quarterRound(working, 2, 6, 10, 14);
    quarterRound(working, 3, 7, 11, 15);
    quarterRound(working, 0, 5, 10, 15);
    quarterRound(working, 1, 6, 11, 12);
    quarterRound(working, 2, 7, 8, 13);
    quarterRound(working, 3, 4, 9, 14);
  }

  for (let i = 0; i < 16; i++) {
    const val = (working[i] + state[i]) >>> 0;
    const base = outOffset + i * 4;
    out[base] = val & 0xff;
    out[base + 1] = (val >>> 8) & 0xff;
    out[base + 2] = (val >>> 16) & 0xff;
    out[base + 3] = (val >>> 24) & 0xff;
  }
}

/**
 * Szyfruje / Deszyfruje bufor danych algorytmem ChaCha20 (symetryczny strumień)
 */
export function chacha20Transform(keyBytes: Uint8Array, nonceBytes: Uint8Array, input: Uint8Array, counter: number = 1): Uint8Array {
  if (keyBytes.length !== 32) throw new Error('ChaCha20 key must be exactly 32 bytes');
  if (nonceBytes.length !== 12) throw new Error('ChaCha20 nonce must be exactly 12 bytes');

  const keyWords = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    const o = i * 4;
    keyWords[i] = (keyBytes[o] | (keyBytes[o + 1] << 8) | (keyBytes[o + 2] << 16) | (keyBytes[o + 3] << 24)) >>> 0;
  }

  const nonceWords = new Uint32Array(3);
  for (let i = 0; i < 3; i++) {
    const o = i * 4;
    nonceWords[i] = (nonceBytes[o] | (nonceBytes[o + 1] << 8) | (nonceBytes[o + 2] << 16) | (nonceBytes[o + 3] << 24)) >>> 0;
  }

  const output = new Uint8Array(input.length);
  const blockBuf = new Uint8Array(64);
  let curCounter = counter;

  for (let pos = 0; pos < input.length; pos += 64) {
    chacha20Block(keyWords, nonceWords, curCounter++, blockBuf, 0);
    const chunk = Math.min(64, input.length - pos);
    for (let i = 0; i < chunk; i++) {
      output[pos + i] = input[pos + i] ^ blockBuf[i];
    }
  }

  return output;
}

/**
 * Koduje Uint8Array do zwięzłego ciągu Base64
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Dekoduje ciąg Base64 do Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

