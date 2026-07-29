import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
 * The whole row opens the contest (like the other dashboard list cards). A live
 * round can't be left, so it carries no action; upcoming rows show a register
 * toggle that flips in place — a left contest only disappears on the next page
 * load, when the hook refetches, so a mis-click is easy to undo.
 */
export default function MyContests() {
  const I = Icons;
  const navigate = useNavigate();
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
              <div
                className="up-row"
                key={c.id}
                onClick={() => navigate(`/contests/${c.id}`)}
              >
                <div className="up-cal">
                  <span className="d">{dl.d}</span>
                  <span className="mo">{dl.mo}</span>
                </div>
                <div className="um">
                  <div className="nm">{c.title}</div>
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
                {!live && (
                  <div className="ua">
                    {isRegistered(c) ? (
                      <button
                        className="reg-pill done"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(c);
                        }}
                      >
                        <I.checkBold size={13} /> Registered
                      </button>
                    ) : (
                      <button
                        className="reg-pill go"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(c);
                        }}
                      >
                        <I.flag size={13} /> Register
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}
