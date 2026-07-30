import { Link } from 'react-router-dom';
import Icons from '../Icons';
import EmptyState from './EmptyState';
import { useContestHistory } from '../../hooks/useContestHistory';
import { formatDate } from '../../utils/time';

// Finished contests shown on the dashboard card.
const MAX_ROWS = 5;

/**
 * PastContests — the given user's finished contests, newest first. The caller
 * owns "whose data". rank / rating_delta can be null until ELO is applied.
 */
export default function PastContests({ username }) {
  const I = Icons;
  const { data, loading, error } = useContestHistory(username);

  if (data && data.length === 0) {
    return (
      <EmptyState
        icon="trophy"
        title="No contests played"
        sub="Register for an upcoming round to start building your rating."
        cta="See upcoming"
      />
    );
  }

  return (
    <section className="card">
      <div className="card-hd">
        <span className="t">
          <I.trophy size={16} /> Contest history
        </span>
      </div>
      <div className="card-bd flush">
        {loading && <div className="list-msg">Loading…</div>}
        {error && (
          <div className="list-msg">Couldn’t load contest history.</div>
        )}
        {data && data.length > 0 && (
          <div className="rowlist">
            {data.slice(0, MAX_ROWS).map((c) => {
              const hasDelta = c.rating_delta != null;
              const up = c.rating_delta >= 0;
              return (
                <Link
                  key={c.id}
                  className="lrow crow"
                  to={`/contests/${c.id}`}
                >
                  <div className="lr-main">
                    <div className="lr-title">{c.title}</div>
                    <div className="lr-sub">
                      <span className="lr-num">{formatDate(c.end_time)}</span>
                      {c.subtitle && <span className="tag">{c.subtitle}</span>}
                      <span className="lr-num">Solved {c.solved}</span>
                    </div>
                  </div>
                  <div className="lr-right">
                    <span className="cc-rank">
                      {c.rank != null ? `#${c.rank}` : '—'}
                    </span>
                    {hasDelta && (
                      <span className={`cc-delta ${up ? 'up' : 'down'}`}>
                        {up ? '+' : ''}
                        {c.rating_delta}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
