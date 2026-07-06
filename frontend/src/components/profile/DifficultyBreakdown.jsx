import Icons from '../Icons';

/**
 * DifficultyBreakdown — solved-by-difficulty card with progress bars.
 *
 * Props:
 *   data — profile object ({ difficulty: { easy:{s,t}, medium:{s,t}, hard:{s,t} } })
 */
export default function DifficultyBreakdown({ data }) {
  const I = Icons;
  const d = data.difficulty;
  const order = [
    ['easy', 'Easy'],
    ['medium', 'Medium'],
    ['hard', 'Hard'],
  ];
  const total = d.easy.s + d.medium.s + d.hard.s;

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
            const pct = Math.round((v.s / v.t) * 100);
            return (
              <div className={`diff-row diff-${key}`} key={key}>
                <div className="top">
                  <span className="lab">{label}</span>
                  <span className="cnt">
                    <b>{v.s}</b> / {v.t} · {pct}%
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
