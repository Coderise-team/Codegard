import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { createSubmission, getSubmission, waitForVerdict } = vi.hoisted(() => ({
  createSubmission: vi.fn(),
  getSubmission: vi.fn(),
  waitForVerdict: vi.fn(),
}));
vi.mock('../api/submissions', () => ({ createSubmission, getSubmission }));
vi.mock('../api/verdict', () => ({ waitForVerdict }));

import { useSubmitFlow } from './useSubmitFlow';

beforeEach(() => {
  createSubmission.mockReset();
  getSubmission.mockReset();
  waitForVerdict.mockReset();
});

// A buildPayload that records what the flow passed it, so a test can assert the
// contest id (or its absence) reached createSubmission.
function render(buildPayload, onSettled = vi.fn()) {
  return renderHook(() => useSubmitFlow(buildPayload, onSettled));
}

describe('useSubmitFlow', () => {
  it('files the payload the caller builds, incl. the contest id', async () => {
    createSubmission.mockResolvedValue({ id: 7, status: 'queued' });
    waitForVerdict.mockResolvedValue('AC');
    getSubmission.mockResolvedValue({
      verdict: 'AC',
      verdict_display: 'Accepted',
    });

    const { result } = render((code, language) => ({
      problem: 3,
      contest: 5,
      code,
      language,
    }));
    await act(async () => {
      await result.current.submit('print(1)', 'py');
    });

    expect(createSubmission).toHaveBeenCalledWith({
      problem: 3,
      contest: 5,
      code: 'print(1)',
      language: 'py',
    });
  });

  it('shows the judged verdict and reloads twice on success', async () => {
    createSubmission.mockResolvedValue({ id: 7, status: 'queued' });
    waitForVerdict.mockResolvedValue('AC');
    getSubmission.mockResolvedValue({
      verdict: 'AC',
      verdict_display: 'Accepted',
      execution_time_ms: 12,
    });
    const onSettled = vi.fn();

    const { result } = render(
      (c, l) => ({ problem: 3, code: c, language: l }),
      onSettled
    );
    await act(async () => {
      await result.current.submit('code', 'py');
    });

    expect(result.current.toast).toEqual({
      verdict: 'AC',
      label: 'Accepted',
      detail: '12 ms',
    });
    expect(result.current.busy).toBe(null);
    // one reload for the Pending row, one after the verdict lands
    expect(onSettled).toHaveBeenCalledTimes(2);
  });

  it('reports a failed send and does not reload', async () => {
    createSubmission.mockRejectedValue(new Error('network'));
    const onSettled = vi.fn();

    const { result } = render(() => ({ problem: 3 }), onSettled);
    await act(async () => {
      await result.current.submit('code', 'py');
    });

    expect(result.current.toast.label).toBe('Submission failed');
    expect(result.current.busy).toBe(null);
    expect(onSettled).not.toHaveBeenCalled();
    expect(waitForVerdict).not.toHaveBeenCalled();
  });

  it('reports an unavailable queue and reloads once', async () => {
    createSubmission.mockResolvedValue({ id: 7, status: 'queue_error' });
    const onSettled = vi.fn();

    const { result } = render(() => ({ problem: 3 }), onSettled);
    await act(async () => {
      await result.current.submit('code', 'py');
    });

    expect(result.current.toast.label).toBe('Submission failed');
    expect(result.current.busy).toBe(null);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(waitForVerdict).not.toHaveBeenCalled();
  });

  it('falls back to a "still judging" note when the verdict never lands', async () => {
    createSubmission.mockResolvedValue({ id: 7, status: 'queued' });
    waitForVerdict.mockRejectedValue(new Error('timeout'));
    const onSettled = vi.fn();

    const { result } = render(() => ({ problem: 3 }), onSettled);
    await act(async () => {
      await result.current.submit('code', 'py');
    });

    expect(result.current.toast.label).toBe('Still judging…');
    expect(result.current.busy).toBe(null);
    expect(onSettled).toHaveBeenCalledTimes(2);
  });

  it('marks busy while a solution is in flight', async () => {
    let resolveVerdict;
    createSubmission.mockResolvedValue({ id: 7, status: 'queued' });
    waitForVerdict.mockReturnValue(
      new Promise((r) => {
        resolveVerdict = r;
      })
    );
    getSubmission.mockResolvedValue({
      verdict: 'AC',
      verdict_display: 'Accepted',
    });

    const { result } = render(() => ({ problem: 3 }));
    let pending;
    await act(async () => {
      pending = result.current.submit('code', 'py');
    });
    expect(result.current.busy).toBe('submit');

    await act(async () => {
      resolveVerdict('AC');
      await pending;
    });
    await waitFor(() => expect(result.current.busy).toBe(null));
  });
});
