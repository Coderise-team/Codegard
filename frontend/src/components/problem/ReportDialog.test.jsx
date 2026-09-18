import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ReportDialog from './ReportDialog';

const { reportProblem, useReportReasons } = vi.hoisted(() => ({
  reportProblem: vi.fn(),
  useReportReasons: vi.fn(),
}));

vi.mock('../../api/problems', () => ({ reportProblem }));
vi.mock('../../hooks/useReportReasons', () => ({ useReportReasons }));

const REASONS = [
  { id: 'statement', name: 'Mistake in the statement' },
  { id: 'wrong_test', name: 'Wrong test' },
];

const onClose = vi.fn();

const renderDialog = (props) =>
  render(<ReportDialog problemId={42} onClose={onClose} {...props} />);

const pick = (name) => fireEvent.click(screen.getByRole('radio', { name }));

const type = (text) =>
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

const sendButton = () => screen.getByRole('button', { name: 'Send report' });

const fillAndSend = () => {
  pick('Wrong test');
  type('Sample 3 expects 5, not 4.');
  fireEvent.click(sendButton());
};

beforeEach(() => {
  vi.clearAllMocks();
  useReportReasons.mockReturnValue({
    data: REASONS,
    loading: false,
    error: null,
  });
});

describe('ReportDialog', () => {
  it('offers the reasons the backend accepts', () => {
    renderDialog();

    expect(
      screen.getByRole('radio', { name: 'Mistake in the statement' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Wrong test' })
    ).toBeInTheDocument();
  });

  it('waits for the reasons before letting the report go', () => {
    useReportReasons.mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    renderDialog();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    // Pressing now could only answer "choose a reason" with nothing to choose.
    expect(sendButton()).toBeDisabled();
  });

  it('says the form is unavailable when the reasons could not be loaded', () => {
    useReportReasons.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('boom'),
    });
    renderDialog();

    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Send report' })
    ).not.toBeInTheDocument();
  });

  it('names what is missing instead of sending, and drops each note once fixed', () => {
    const noReason = 'Choose a reason.';
    const tooShort = 'Describe the issue in at least 10 characters.';
    renderDialog();
    expect(screen.queryByText(noReason)).not.toBeInTheDocument();

    fireEvent.click(sendButton());
    expect(reportProblem).not.toHaveBeenCalled();
    expect(screen.getByText(noReason)).toBeInTheDocument();
    expect(screen.getByText(tooShort)).toBeInTheDocument();

    pick('Wrong test');
    expect(screen.queryByText(noReason)).not.toBeInTheDocument();

    // The backend measures the text without surrounding whitespace, so padding
    // must not count towards the minimum either.
    type('    123456789    ');
    expect(screen.getByText(tooShort)).toBeInTheDocument();

    type('1234567890');
    expect(screen.queryByText(tooShort)).not.toBeInTheDocument();
  });

  it('sends the report and thanks the user', async () => {
    reportProblem.mockResolvedValue({ detail: 'Report submitted.' });
    renderDialog();
    fillAndSend();

    expect(
      await screen.findByText(/thanks for the report/i)
    ).toBeInTheDocument();
    expect(reportProblem).toHaveBeenCalledWith(42, {
      reason: 'wrong_test',
      message: 'Sample 3 expects 5, not 4.',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back to problem' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('files the report against the round it was opened from', async () => {
    reportProblem.mockResolvedValue({ detail: 'Report submitted.' });
    renderDialog({ contestId: 7 });
    fillAndSend();

    expect(
      await screen.findByText(/thanks for the report/i)
    ).toBeInTheDocument();
    expect(reportProblem).toHaveBeenCalledWith(42, {
      reason: 'wrong_test',
      message: 'Sample 3 expects 5, not 4.',
      contest: 7,
    });
  });

  describe.each([
    [
      'too many unresolved reports',
      400,
      'You already have 5 unresolved reports on this problem.',
    ],
    [
      'too many attempts an hour',
      429,
      'Request was throttled. Expected available in 3540 seconds.',
    ],
  ])('when the backend refuses: %s', (_case, status, detail) => {
    it('shows its reason and keeps the form', async () => {
      reportProblem.mockRejectedValue({
        response: { status, data: { detail } },
      });
      renderDialog();
      fillAndSend();

      expect(await screen.findByText(detail)).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue(
        'Sample 3 expects 5, not 4.'
      );
    });
  });

  it('shows a rejected description under its own field', async () => {
    reportProblem.mockRejectedValue({
      response: {
        status: 400,
        data: {
          message: ['Please describe the issue in at least 10 characters.'],
        },
      },
    });
    renderDialog();
    fillAndSend();

    expect(
      await screen.findByText(
        'Please describe the issue in at least 10 characters.'
      )
    ).toBeInTheDocument();
  });

  it('says the report was not sent when the request never got an answer', async () => {
    reportProblem.mockRejectedValue(new Error('Network Error'));
    renderDialog();
    fillAndSend();

    expect(
      await screen.findByText('Could not send the report. Please try again.')
    ).toBeInTheDocument();
  });
});
