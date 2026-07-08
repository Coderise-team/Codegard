import { describe, it, expect } from 'vitest';

import { toastFor } from './submissionToast';

describe('toastFor', () => {
  it('shows time and memory for a normal verdict', () => {
    expect(
      toastFor({
        verdict: 'AC',
        verdict_display: 'Accepted',
        execution_time_ms: 104,
        memory_used_mb: 18,
      })
    ).toEqual({ verdict: 'AC', label: 'Accepted', detail: '104 ms · 18 MB' });
  });

  it('omits memory when the judge did not measure it', () => {
    expect(
      toastFor({
        verdict: 'WA',
        verdict_display: 'Wrong Answer',
        execution_time_ms: 61,
        memory_used_mb: null,
      }).detail
    ).toBe('61 ms');
  });

  it('leaves the detail empty without metrics', () => {
    expect(
      toastFor({
        verdict: 'TLE',
        verdict_display: 'Time Limit Exceeded',
        execution_time_ms: null,
      }).detail
    ).toBe('');
  });

  it('uses the first non-empty stderr line for RE', () => {
    const stderr =
      '  File "/tmp/solution.py", line 3\nIndentationError: unexpected indent';
    expect(
      toastFor({ verdict: 'RE', verdict_display: 'Runtime Error', stderr })
        .detail
    ).toBe('  File "/tmp/solution.py", line 3');
  });

  it('falls back to error_message for CE and truncates long lines', () => {
    const long = 'x'.repeat(200);
    const toast = toastFor({
      verdict: 'CE',
      verdict_display: 'Compilation Error',
      stderr: '',
      error_message: long,
    });
    expect(toast.detail).toHaveLength(141); // 140 chars + ellipsis
    expect(toast.detail.endsWith('…')).toBe(true);
  });
});
