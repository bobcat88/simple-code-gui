import { describe, expect, it } from 'vitest';
import { LRUCache, beadsStatusCache, clearProjectCaches, gsdStatusCache, tasksCache } from './lruCache';

describe('LRUCache', () => {
  it('throws on maxSize < 1', () => {
    expect(() => new LRUCache(0)).toThrow('at least 1');
  });

  it('stores and retrieves values', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<string, number>(5);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('has() reflects presence without changing order', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('x', 10);
    expect(cache.has('x')).toBe(true);
    expect(cache.has('y')).toBe(false);
  });

  it('evicts LRU entry when full', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // 'a' is LRU — evicted
    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('get() promotes entry to MRU, protecting from eviction', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // promote 'a'
    cache.set('c', 3); // 'b' is now LRU — evicted
    expect(cache.has('b')).toBe(false);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('set() on existing key updates value and position', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 99); // refresh 'a'
    cache.set('c', 3);  // 'b' is LRU
    expect(cache.get('a')).toBe(99);
    expect(cache.has('b')).toBe(false);
  });

  it('delete() removes a key', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('k', 42);
    expect(cache.delete('k')).toBe(true);
    expect(cache.has('k')).toBe(false);
    expect(cache.delete('k')).toBe(false);
  });

  it('clear() empties the cache', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.has('a')).toBe(false);
  });

  it('size reflects current entry count', () => {
    const cache = new LRUCache<string, number>(10);
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
  });

  it('keys() iterates in LRU order (least recent first)', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // promote 'a' — order: b, c, a
    const keys = [...cache.keys()];
    expect(keys[0]).toBe('b');
    expect(keys[keys.length - 1]).toBe('a');
  });

  it('handles maxSize=1 correctly', () => {
    const cache = new LRUCache<string, number>(1);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe(2);
  });
});

describe('shared cache instances', () => {
  it('tasksCache and beadsStatusCache are independent LRUCache instances', () => {
    tasksCache.set('/proj', [{ id: 1 }]);
    beadsStatusCache.set('/proj', { installed: true, initialized: false });
    expect(tasksCache.get('/proj')).toEqual([{ id: 1 }]);
    expect(beadsStatusCache.get('/proj')).toEqual({ installed: true, initialized: false });
  });

  it('clearProjectCaches removes from all three caches', () => {
    tasksCache.set('/p', []);
    beadsStatusCache.set('/p', { installed: false, initialized: false });
    gsdStatusCache.set('/p', { ready: true });

    clearProjectCaches('/p');

    expect(tasksCache.has('/p')).toBe(false);
    expect(beadsStatusCache.has('/p')).toBe(false);
    expect(gsdStatusCache.has('/p')).toBe(false);
  });
});
