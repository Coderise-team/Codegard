import { describe, it, expect } from 'vitest';

import { isNotFound } from './errors';

describe('isNotFound', () => {
  it('is true for a 404 answer from the backend', () => {
    expect(isNotFound({ response: { status: 404 } })).toBe(true);
  });

  it('is false for other server errors', () => {
    expect(isNotFound({ response: { status: 500 } })).toBe(false);
    expect(isNotFound({ response: { status: 403 } })).toBe(false);
  });

  it('is false when the request never got an answer', () => {
    // A dropped connection / timeout: axios rejects with no `response` at all.
    expect(isNotFound({ message: 'Network Error' })).toBe(false);
    expect(isNotFound(null)).toBe(false);
    expect(isNotFound(undefined)).toBe(false);
  });
});
