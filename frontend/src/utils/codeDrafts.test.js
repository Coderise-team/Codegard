import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  draftSlot,
  readDraft,
  writeDraft,
  clearDraft,
  readLanguage,
  writeLanguage,
} from './codeDrafts';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('codeDrafts', () => {
  it('keeps the catalogue, each round and each user apart', () => {
    const solo = draftSlot('alice', 5);
    const round = draftSlot('alice', 5, 3);
    const otherRound = draftSlot('alice', 5, 4);
    const bob = draftSlot('bob', 5);

    writeDraft(solo, 'python', 'solo code');
    writeDraft(round, 'python', 'round code');

    expect(readDraft(solo, 'python')).toBe('solo code');
    expect(readDraft(round, 'python')).toBe('round code');
    expect(readDraft(otherRound, 'python')).toBeNull();
    expect(readDraft(bob, 'python')).toBeNull();
  });

  it('keeps a draft per language and clears only the one asked', () => {
    const slot = draftSlot('alice', 5);
    writeDraft(slot, 'python', 'py');
    writeDraft(slot, 'javascript', 'js');

    clearDraft(slot, 'python');

    expect(readDraft(slot, 'python')).toBeNull();
    expect(readDraft(slot, 'javascript')).toBe('js');
  });

  it('remembers the last language of a slot', () => {
    const slot = draftSlot('alice', 5);
    expect(readLanguage(slot)).toBeNull();

    writeLanguage(slot, 'javascript');

    expect(readLanguage(slot)).toBe('javascript');
  });

  it('reads nothing and writes nothing when storage is unavailable', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    const slot = draftSlot('alice', 5);

    expect(() => writeDraft(slot, 'python', 'code')).not.toThrow();
    expect(() => writeLanguage(slot, 'python')).not.toThrow();
    expect(() => clearDraft(slot, 'python')).not.toThrow();
    expect(readDraft(slot, 'python')).toBeNull();
    expect(readLanguage(slot)).toBeNull();
  });
});
