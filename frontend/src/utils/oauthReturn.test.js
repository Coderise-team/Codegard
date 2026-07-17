import { describe, it, expect, beforeEach } from 'vitest';

import { stashOAuthFrom, popOAuthFrom } from './oauthReturn';

beforeEach(() => {
  sessionStorage.clear();
});

describe('oauthReturn', () => {
  it('pop returns the stashed path and clears it', () => {
    stashOAuthFrom('/problems/5');

    expect(popOAuthFrom()).toBe('/problems/5');
    expect(popOAuthFrom()).toBe('/');
  });

  it('pop falls back to home when nothing is stashed', () => {
    expect(popOAuthFrom()).toBe('/');
  });
});
