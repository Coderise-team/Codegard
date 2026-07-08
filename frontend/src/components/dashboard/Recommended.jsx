import { Link } from 'react-router-dom';
import Icons from '../Icons';
import EmptyState from './EmptyState';
import { useRecommended } from '../../hooks/useRecommended';

// Suggestions shown on the dashboard card.
const MAX_ROWS = 6;

/**
 * Recommended — personalised problem suggestions: unsolved problems for the
 * authenticated user, ordered easy -> hard.
 */
export default function Recommended() {
  const I = Icons;
  const { data, loading, error } = useRecommended();

  if (data && data.length === 0) {
    return (
      <EmptyState
        icon="sparkle"
        title="Nothing to recommend"
        sub="You've solved everything available — check back as new problems land."
      />
    );
  }

  return (
    <section className="card">
      <div className="card-hd">
        <span className="t">
          <I.sparkle size={16} /> Recommended for you
        </span>
        <button className="more">
          Problemset <I.chevRight size={13} />
        </button>
      </div>
      <div className="card-bd flush">
        {loading && <div className="list-msg">Loading…</div>}
        {error && (
          <div className="list-msg">Couldn’t load recommendations.</div>
        )}
        {data && data.length > 0 && (
          <div className="rowlist">
            {data.slice(0, MAX_ROWS).map((p) => (
              <Link key={p.id} className="lrow" to={`/problems/${p.id}`}>
                <span className="lr-id">#{p.id}</span>
                <div className="lr-main">
                  <div className="lr-title">{p.title}</div>
                  <div className="lr-sub">
                    <span className={`df d-${p.difficulty.toLowerCase()}`}>
                      {p.difficulty}
                    </span>
                    {p.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="lr-right">
                  <span className="lr-num">{p.acceptance}%</span>
                  <I.chevRight size={16} className="chev" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
