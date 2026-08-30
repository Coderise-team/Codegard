import Icons from '../Icons';

/**
 * StatusGlyph — solved / attempted / untouched mark the catalogue puts in front
 * of a problem, as the product draws it (see problems/bits.jsx).
 */
export function StatusGlyph({ status }) {
  return (
    <span className={`lp-st ${status}`}>
      <span className="ic">
        {status === 'solved' ? <Icons.checkBold size={14} /> : null}
        {status === 'attempted' ? <Icons.bolt size={13} /> : null}
      </span>
    </span>
  );
}
