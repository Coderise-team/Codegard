import Icons from '../Icons';
import { useDifficultyBreakdown } from '../../hooks/useDifficultyBreakdown';

const ZERO = { solved: 0, total: 0 };

/**
 * DifficultyBreakdown — solved-by-difficulty card with progress bars.
 *
 * Props:
 *   username — whose breakdown to load (users/{username}/difficulty/)
 */
export default function DifficultyBreakdown({ username }) {
  const I = Icons;
  const { data } = useDifficultyBreakdown(username);
  const d = {
    easy: data?.easy ?? ZERO,
    medium: data?.medium ?? ZERO,
    hard: data?.hard ?? ZERO,
  };
  const order = [
    ['easy', 'Easy'],
    ['medium', 'Medium'],
    ['hard', 'Hard'],
  ];
  const total = d.easy.solved + d.medium.solved + d.hard.solved;

  return (
    <section className="card">
      <div className="card-hd">
        <span className="t">
          <I.checkBold size={16} /> Solved by difficulty
        </span>
      </div>
      <div className="card-bd">
        <div className="diff-total">
          <span className="n">{total.toLocaleString('en-US')}</span>
          <span className="l">problems solved</span>
        </div>
        <div className="diff-rows">
          {order.map(([key, label]) => {
            const v = d[key];
            const pct = v.total ? Math.round((v.solved / v.total) * 100) : 0;
            return (
              <div className={`diff-row diff-${key}`} key={key}>
                <div className="top">
                  <span className="lab">{label}</span>
                  <span className="cnt">
                    <b>{v.solved}</b> / {v.total} · {pct}%
                  </span>
                </div>
                <div className="bar">
                  <div className="fill" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
