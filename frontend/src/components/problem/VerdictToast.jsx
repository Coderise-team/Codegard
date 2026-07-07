import Icons from '../Icons';

const VLABEL = {
  AC: 'Accepted',
  WA: 'Wrong Answer',
  TLE: 'Time Limit Exceeded',
};
const VICON = {
  AC: Icons.checkBold,
  WA: Icons.xBold,
  TLE: Icons.clock,
};

/**
 * VerdictToast — floating verdict banner shown after a submission is judged.
 *
 * Props:
 *   verdict — verdict code ('AC' | 'WA' | 'TLE')
 *   sub     — secondary line under the verdict label
 *   onClose
 */
export default function VerdictToast({ verdict, sub, onClose }) {
  const Icon = VICON[verdict];
  return (
    <div className="pp-toast-wrap">
      <div className={`pp-toast t-${verdict}`}>
        <div className="pp-toast-icon">
          <Icon size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="pp-toast-big">{VLABEL[verdict]}</div>
          <div className="pp-toast-sub">{sub}</div>
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
