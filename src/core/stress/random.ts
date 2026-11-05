/**
 * Deterministic randomness, so a stress test produces the same text every time
 * for the same page and seed. Not suitable for anything security related.
 */

/** Returns numbers in [0, 1). */
export type Random = () => number;

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** 32-bit FNV-1a hash of a string, optionally chained from an earlier hash. */
export function hashString(text: string, seed = FNV_OFFSET): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** Mulberry32: tiny, fast, and well distributed for generating test data. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in [0, count). */
export function randomIndex(random: Random, count: number): number {
  return Math.floor(random() * count);
}

/** One item from a non-empty list. */
export function pick<T>(random: Random, items: readonly [T, ...T[]]): T {
  return items[randomIndex(random, items.length)] ?? items[0];
}
