import Icons from '../Icons';
import EmptyState from './EmptyState';
import { useAuthStore } from '../../store/authStore';
import { useContestHistory } from '../../hooks/useContestHistory';
import { formatDate } from '../../utils/time';

// Finished contests shown on the dashboard card.
const MAX_ROWS = 5;

/**
 * PastContests — a user's finished contests, newest first (the signed-in user
 * by default, or the `username` given when viewing another profile).
 * rank / rating_delta can be null until ELO is applied; handled gracefully.
 */
export default function PastContests({ username: usernameProp }) {
  const I = Icons;
  const authUsername = useAuthStore((s) => s.user?.username);
  const username = usernameProp ?? authUsername;
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
        <button className="more">
          All <I.chevRight size={13} />
        </button>
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
                <a key={c.id} className="lrow crow" href="#">
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
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
