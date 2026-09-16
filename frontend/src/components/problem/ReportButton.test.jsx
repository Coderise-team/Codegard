import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import ReportButton from './ReportButton';

// The form itself is covered in ReportDialog.test.jsx; here only whether the
// button opens and closes it for the right problem.
vi.mock('./ReportDialog', () => ({
  default: ({ problemId, onClose }) => (
    <div>
      report form for {problemId}
      <button onClick={onClose}>close form</button>
    </div>
  ),
}));

describe('ReportButton', () => {
  it('opens the report form for its problem and closes it again', () => {
    render(<ReportButton problemId={42} />);
    expect(screen.queryByText(/report form/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    expect(screen.getByText('report form for 42')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'close form' }));
    expect(screen.queryByText(/report form/)).not.toBeInTheDocument();
  });
});
