import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ReportButton from './ReportButton';

// The form itself is covered in ReportDialog.test.jsx; here only whether the
// button opens and closes it for the right problem and round.
vi.mock('./ReportDialog', () => ({
  default: ({ problemId, contestId, onClose }) => (
    <div>
      report form for {problemId} in {contestId ?? 'the catalog'}
      <button onClick={onClose}>close form</button>
    </div>
  ),
}));

describe('ReportButton', () => {
  it.each([
    ['in a round', { problemId: 42, contestId: 7 }, 'report form for 42 in 7'],
    ['in the catalog', { problemId: 42 }, 'report form for 42 in the catalog'],
  ])('opens the report form %s and closes it again', (_where, props, shown) => {
    render(<ReportButton {...props} />);
    expect(screen.queryByText(/report form/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    expect(screen.getByText(shown)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'close form' }));
    expect(screen.queryByText(/report form/)).not.toBeInTheDocument();
  });
});
