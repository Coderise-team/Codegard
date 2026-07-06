import { Link } from 'react-router-dom';
import Icons from '../Icons';
import EmptyState from './EmptyState';
import { useAuthStore } from '../../store/authStore';
import { useDailyChallenge } from '../../hooks/useDailyChallenge';

// Maps a streak-history cell status to its grid class.
const CELL_CLASS = { solved: 'on', today: 'today', missed: 'miss' };

/**
 * DailyChallenge — today's shared daily problem plus the user's streak grid.
 */
export default function DailyChallenge() {
  const I = Icons;
  const username = useAuthStore((s) => s.user?.username);
  const { data, loading, error } = useDailyChallenge(username);

  // No problem assigned for today yet.
  if (data && data.daily === null) {
    return (
      <EmptyState
        icon="flame"
        title="No daily challenge yet"
        sub="Today's problem hasn't been posted — check back soon."
      />
    );
  }

  return (
    <section className="card">
      <div className="card-hd">
        <span className="t">
          <I.flame size={16} style={{ color: 'var(--tle)' }} /> Daily challenge
        </span>
        <button className="more">
          All <I.chevRight size={13} />
        </button>
      </div>
      <div className="card-bd">
        {loading && <div className="list-msg">Loading…</div>}
        {error && (
          <div className="list-msg">Couldn’t load the daily challenge.</div>
        )}
        {data && data.daily && (
          <>
            <div className="daily-top">
              <div className="dt-main">
                <div className="dt-title">{data.daily.title}</div>
                <div className="dt-sub">
                  <span
                    className={`df d-${data.daily.difficulty.toLowerCase()}`}
                  >
                    {data.daily.difficulty}
                  </span>
                  {data.daily.tags.map((t) => (
                    <Link
                      key={t}
                      className="tag"
                      to={`/problems?tag=${encodeURIComponent(t)}`}
                    >
                      {t}
                    </Link>
                  ))}
                </div>
                <div className="dt-acc">{data.daily.acceptance}% AC</div>
              </div>
              <div className="daily-flame">
                <I.flame size={22} />
                <span className="n">{data.streak.current_streak}</span>
                <span className="u">streak</span>
              </div>
            </div>

            <div className="streak-grid">
              {data.streak.history.map((cell) => (
                <div
                  key={cell.date}
                  className={`sd ${CELL_CLASS[cell.status]}`}
                  title={`${cell.date}: ${cell.status}`}
                />
              ))}
            </div>

            <button className="btn btn-primary btn-block">
              <I.bolt size={15} />{' '}
              {data.daily.solved_today ? 'Solved today ✓' : 'Solve today'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
