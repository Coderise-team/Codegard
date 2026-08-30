import { describe, it, expect } from 'vitest';

import tokenizePython from './pythonTokens';

const classesFor = (code, text) =>
  tokenizePython(code)
    .filter((token) => token.text === text)
    .map((token) => token.cls);

describe('tokenizePython', () => {
  it('gives back exactly the source it was handed', () => {
    const code = [
      'class Solution:  # entry point',
      '    def solve(self, nums: List[int]) -> int:',
      '        total = 0  # running sum',
      '        for i, x in enumerate(nums):',
      '            total += x * 2',
      '        return total',
      '',
      "    name = 'codegard'",
    ].join('\n');

    expect(
      tokenizePython(code)
        .map((token) => token.text)
        .join('')
    ).toBe(code);
  });

  it('marks the pieces the editor colours', () => {
    const code = "def solve(self, n):\n    return len('ok')  # done\n";

    expect(classesFor(code, 'def')).toEqual(['tk-keyword']);
    expect(classesFor(code, 'self')).toEqual(['tk-keyword']);
    expect(classesFor(code, 'len')).toEqual(['tk-builtin']);
    expect(classesFor(code, "'ok'")).toEqual(['tk-string']);
    expect(classesFor(code, '# done')).toEqual(['tk-comment']);
  });

  it('colours the name being defined, not every use of it', () => {
    const code = 'def solve(n):\n    return solve(n - 1)\n';
    expect(classesFor(code, 'solve')).toEqual(['tk-func']);
  });

  it('keeps a keyword hidden inside a longer name plain', () => {
    expect(classesFor('definition = 1', 'def')).toEqual([]);
  });

  it('leaves a partial line alone, as typing hands it over', () => {
    const half = "x = 'unfinis";
    expect(
      tokenizePython(half)
        .map((token) => token.text)
        .join('')
    ).toBe(half);
  });

  it('has nothing to say about an empty source', () => {
    expect(tokenizePython('')).toEqual([]);
  });
});
