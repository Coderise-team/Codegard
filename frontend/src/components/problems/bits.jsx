import Icons from '../Icons';

/**
 * StatusIcon — solved / attempted / todo glyph used in the table and cards.
 */
export function StatusIcon({ status, size = 14 }) {
  const I = Icons;
  if (status === 'solved') return <span className="ic"><I.checkBold size={size} /></span>;
  if (status === 'attempted') return <span className="ic"><I.bolt size={size - 1} /></span>;
  return <span className="ic"></span>;
}

/**
 * FreqMeter — 1..5 popularity bars.
 */
export function FreqMeter({ n }) {
  return (
    <span className="p-freq" title={`Frequency ${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : ''}></i>)}
    </span>
  );
}
