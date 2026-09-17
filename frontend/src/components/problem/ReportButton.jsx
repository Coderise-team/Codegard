import { useState } from 'react';
import Icons from '../Icons';
import ReportDialog from './ReportDialog';

/**
 * ReportButton — the Report link in the editor toolbar and the dialog it opens.
 *
 * Props:
 *   problemId — catalog id of the problem on screen
 *   contestId — the round the page is opened from; absent in the catalog
 */
export default function ReportButton({ problemId, contestId }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="pp-tool-link"
        onClick={() => setOpen(true)}
      >
        <Icons.flag size={14} /> Report
      </button>
      {open && (
        <ReportDialog
          problemId={problemId}
          contestId={contestId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
