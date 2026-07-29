import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icons from '../Icons';
import EmptyState from './EmptyState';
import { useMyContests } from '../../hooks/useMyContests';
import { joinContest, leaveContest } from '../../api/contests';
import { formatDuration } from '../../utils/time';

const MAX_ROWS = 4;

const dayCell = (iso) => {
  const d = new Date(iso);
  return { d: d.getDate(), mo: d.toLocaleString('en', { month: 'short' }) };
};

const isLive = (c) => {
  const now = Date.now();
  return (
    new Date(c.start_time).getTime() <= now &&
    now < new Date(c.end_time).getTime()
  );
};

/**
 * MyContests — rail list of the rounds the current user is registered for that
 * haven't finished yet (live + upcoming), soonest first. Finished rounds live
 * in the Contest History block.
 *
 * Leaving flips the pill in place (Registered <-> Register) rather than dropping
 * the row, so a mis-click is easy to undo; a left contest only disappears on the
 * next page load, when the hook refetches.
 */
export default function MyContests() {
  const I = Icons;
  const { data, loading, error } = useMyContests();

  // Optimistic registration override: id -> registered? Rows are joined by
  // definition, so a missing entry means "still registered".
  const [reg, setReg] = useState({});
  const isRegistered = (c) => reg[c.id] ?? true;
  const toggle = async (c) => {
    const joined = isRegistered(c);
    setReg((m) => ({ ...m, [c.id]: !joined }));
    try {
      await (joined ? leaveContest(c.id) : joinContest(c.id));
    } catch {
      setReg((m) => ({ ...m, [c.id]: joined })); // revert on failure
    }
  };

  if (data && data.length === 0) {
    return (
      <EmptyState
        icon="flag"
        title="No registered contests"
        sub="Register for a round and it will show up here."
      />
    );
  }

  return (
    <section className="card">
      <div className="card-hd">
        <span className="t">
          <I.flag size={16} /> My contests
        </span>
      </div>
      <div className="card-bd flush">
        {loading && <div className="list-msg">Loading…</div>}
        {error && <div className="list-msg">Couldn’t load your contests.</div>}
        {data &&
          data.slice(0, MAX_ROWS).map((c) => {
            const dl = dayCell(c.start_time);
            const live = isLive(c);
            return (
              <div className="up-row" key={c.id}>
                <div className="up-cal">
                  <span className="d">{dl.d}</span>
                  <span className="mo">{dl.mo}</span>
                </div>
                <div className="um">
                  <Link className="nm" to={`/contests/${c.id}`}>
                    {c.title}
                  </Link>
                  <div className="mt">
                    {live ? (
                      <span className="hbadge live">
                        <span className="d" /> Live
                      </span>
                    ) : (
                      <span>{c.subtitle}</span>
                    )}
                    <span>· {formatDuration(c.start_time, c.end_time)}</span>
                  </div>
                </div>
                <div className="ua">
                  {live ? (
                    // A live round can't be left — offer entry instead of a
                    // no-op toggle. Points to the contest page (its workspace
                    // once contest mode exists).
                    <Link className="reg-pill go" to={`/contests/${c.id}`}>
                      <I.play size={13} /> Enter round
                    </Link>
                  ) : isRegistered(c) ? (
                    <button
                      className="reg-pill done"
                      onClick={() => toggle(c)}
                    >
                      <I.checkBold size={13} /> Registered
                    </button>
                  ) : (
                    <button className="reg-pill go" onClick={() => toggle(c)}>
                      <I.flag size={13} /> Register
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
