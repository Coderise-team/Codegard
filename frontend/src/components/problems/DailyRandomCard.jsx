import { Link } from 'react-router-dom';
import Icons from '../Icons';

/**
 * DailyRandomCard — daily challenge summary + "Pick random" CTA (right rail).
 *
 * Props:
 *   daily       — { title, difficulty, tags, acceptance }
 *   onRandom()  — open a random problem from the current filter set
 */
export default function DailyRandomCard({ daily, onRandom }) {
  const I = Icons;
  return (
    <section className="card ps-daily">
      <div className="card-hd">
        <span className="t"><I.flame size={16} style={{ color: 'var(--tle)' }} /> Daily challenge</span>
      </div>
      <div className="card-bd">
        <div className="dt-title">{daily.title}</div>
        <div className="dt-sub">
          <span className={`df d-${daily.difficulty.toLowerCase()}`}>{daily.difficulty}</span>
          {daily.tags.map((t) => (
            <Link key={t} className="tag" to={`/problems?tag=${encodeURIComponent(t)}`}>{t}</Link>
          ))}
        </div>
        <div className="dt-acc"><b>{daily.acceptance}%</b> acceptance</div>
        <div className="ps-random" style={{ marginTop: 16 }}>
          <a className="btn btn-primary btn-block" href="#">
            <I.bolt size={15} /> Solve daily</a>
          <button className="btn btn-accent btn-block" onClick={onRandom}>
            <I.sparkle size={15} /> Pick random</button>
        </div>
      </div>
    </section>
  );
}
