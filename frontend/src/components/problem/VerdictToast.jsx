import Icons from '../Icons';

const CLOCKISH = ['TLE', 'MLE', 'OLE'];

/**
 * VerdictToast — floating banner shown after a submission is judged (or when
 * submitting failed).
 *
 * Props:
 *   verdict — verdict code ('AC' | 'WA' | 'TLE' | 'MLE' | 'OLE' | 'RE' | 'CE');
 *             falsy for a generic error banner
 *   label   — headline (verdict_display from the API, or an error message)
 *   detail  — secondary line (metrics, stderr excerpt); hidden when empty
 *   onClose
 */
export default function VerdictToast({ verdict, label, detail, onClose }) {
  const Icon =
    verdict === 'AC'
      ? Icons.checkBold
      : CLOCKISH.includes(verdict)
        ? Icons.clock
        : Icons.xBold;
  return (
    <div className="pp-toast-wrap">
      <div className={`pp-toast t-${verdict || 'ERR'}`}>
        <div className="pp-toast-icon">
          <Icon size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="pp-toast-big">{label}</div>
          {detail && <div className="pp-toast-sub">{detail}</div>}
        </div>
        <button
          className="icon-btn"
          onClick={onClose}
          style={{ width: 28, height: 28 }}
        >
          <Icons.x size={14} />
        </button>
      </div>
    </div>
  );
}
