import Icons from '../Icons';

/**
 * ProgressCard — solved-by-difficulty progress (right rail).
 *
 * Props:
 *   byDiff — { Easy:{solved,total}, Medium:{...}, Hard:{...} }
 */
export default function ProgressCard({ byDiff }) {
  const I = Icons;
  const order = [['Easy', 'd-easy'], ['Medium', 'd-medium'], ['Hard', 'd-hard']];
  const totalSolved = order.reduce((s, [d]) => s + byDiff[d].solved, 0);
  const totalAll = order.reduce((s, [d]) => s + byDiff[d].total, 0);
  return (
    <section className="card ps-prog">
      <div className="card-hd">
        <span className="t"><I.target size={16} /> Your progress</span>
        <span className="act-sum"><b>{totalSolved}</b>/{totalAll} solved</span>
      </div>
      <div className="card-bd">
        {order.map(([d, cls]) => {
          const { solved, total } = byDiff[d];
          const pct = total ? (solved / total) * 100 : 0;
          return (
            <div className="pp-row" key={d}>
              <span className={`pp-k ${cls}`}>{d}</span>
              <span className="pp-bar"><span className={`pp-fill ${cls}`} style={{ width: pct + '%' }}></span></span>
              <span className="pp-num">{solved}/{total}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
