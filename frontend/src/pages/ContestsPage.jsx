import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { ContestHeroView } from '../components/dashboard/ContestHero';
import ContestRow from '../components/contests/ContestRow';
import PastRow from '../components/contests/PastRow';
import { useSearchTerm } from '../hooks/useSearchTerm';
import { useContestHero } from '../hooks/useContestHero';
import { useContests } from '../hooks/useContests';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { joinContest, leaveContest } from '../api/contests';
import './ContestsPage.css';

/**
 * ContestsPage — the contests hub (compact density, violet accent).
 *
 * Featured contest hero on top + Upcoming / Past tabs, inside AppShell.
 */
export default function ContestsPage() {
  const [tab, setTab] = useState('upcoming'); // upcoming | past
  const [term, setTerm] = useSearchTerm();
  const searching = Boolean(term);

  // Each tab is a status slice of the same endpoint. Past keeps the server's
  // default -start_time order (freshest first); Upcoming asks for ascending
  // start_time (nearest first). The term goes into the query together with the
  // status, so switching tabs re-queries the new slice with the same term
  // instead of keeping the old matches.
  //
  // A search sends no ordering of ours: the server sorts matches by how well
  // the title matches, and any ?ordering= overrides that. A question about a
  // name is answered with the closest name, not with the nearest date.
  const params = useMemo(() => {
    if (tab === 'past') {
      return term
        ? { status: 'finished', search: term }
        : { status: 'finished' };
    }
    return term
      ? { status: 'pending', search: term }
      : { status: 'pending', ordering: 'start_time' };
  }, [tab, term]);
  const { items, total, hasMore, loading, error, loadMore } =
    useContests(params);
  const sentinelRef = useInfiniteScroll(loadMore, hasMore);

  // The featured hero (when "soon") is the nearest pending contest — the same
  // one that would head the Upcoming list. Lift the hook here so we can render
  // the hero AND drop that contest from the list to avoid the duplicate.
  // A search asks for matches, not for the contest the page picks on its own:
  // ContestHero is not rendered, and its contest stays in the list like any
  // other instead of being removed from it as a duplicate.
  const hero = useContestHero();
  const featuredId =
    !searching && hero.state === 'soon'
      ? (hero.data?.contest?.id ?? null)
      : null;
  const upcoming =
    featuredId == null ? items : items.filter((c) => c.id !== featuredId);
  const upcomingCount = Math.max(0, total - (featuredId == null ? 0 : 1));

  // A ticking clock kept in state and passed down to the rows. The React
  // Compiler memoises rows by their props, so a row reading Date.now() itself
  // would be cached forever — the countdown has to depend on a prop that
  // actually changes each second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (tab !== 'upcoming') return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [tab]);

  const navigate = useNavigate();
  const openContest = (c) => navigate(`/contests/${c.id}`);

  // Optimistic registration: flip locally, call the API, revert on failure.
  const [regOverride, setRegOverride] = useState({}); // contest id -> joined
  const isRegistered = (c) => regOverride[c.id] ?? c.is_joined;
  const toggleReg = async (c) => {
    const joined = isRegistered(c);
    setRegOverride((m) => ({ ...m, [c.id]: !joined }));
    try {
      await (joined ? leaveContest(c.id) : joinContest(c.id));
    } catch {
      setRegOverride((m) => ({ ...m, [c.id]: joined }));
    }
  };

  // Shown in both sections, so it is built once. The term is never printed
  // back: it comes from the address, so a crafted link could put any text on a
  // page that looks like ours.
  const nothingFound = (
    <div className="ct-empty">
      <div className="et">Nothing found for that search</div>
      <div className="es">
        Check the spelling, or look in the other section.
      </div>
      <button className="btn" onClick={() => setTerm('')}>
        Clear search
      </button>
    </div>
  );

  // A request that failed must not be read as "nothing is scheduled": telling
  // someone to check their spelling when the server is down blames them for it.
  const failed = (
    <div className="ct-empty">
      <div className="et">Contests unavailable</div>
      <div className="es">The list could not be loaded. Try again later.</div>
    </div>
  );

  return (
    <AppShell
      title="Contests"
      search={{
        placeholder: 'Search contests…',
        value: term,
        onChange: setTerm,
      }}
    >
      <div className="canvas scroll">
        <div className="ct-hub">
          <div className="ct-head">
            <h1>Contests</h1>
            <span className="sub">
              Compete in rated rounds · climb the rating
            </span>
          </div>

          {!searching && <ContestHeroView {...hero} />}

          <div className="ct-bar">
            <div className="ct-tabs">
              <button
                className={`ct-tab${tab === 'upcoming' ? ' is-active' : ''}`}
                onClick={() => setTab('upcoming')}
              >
                Upcoming
                {tab === 'upcoming' && (
                  <span className="cnt">{upcomingCount}</span>
                )}
              </button>
              <button
                className={`ct-tab${tab === 'past' ? ' is-active' : ''}`}
                onClick={() => setTab('past')}
              >
                Past
                {tab === 'past' && <span className="cnt">{total}</span>}
              </button>
            </div>
          </div>

          {tab === 'upcoming' &&
            (upcoming.length ? (
              <>
                <div className="ct-list">
                  {upcoming.map((c, i) => (
                    <ContestRow
                      key={c.id}
                      c={c}
                      now={now}
                      registered={isRegistered(c)}
                      onToggle={toggleReg}
                      onOpen={openContest}
                      // Top of a search is the closest name, not the next
                      // round, and the glow says "this one is coming up".
                      soon={!searching && featuredId == null && i === 0}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div
                    ref={sentinelRef}
                    className="ct-sentinel"
                    aria-hidden="true"
                  />
                )}
              </>
            ) : loading ? null : error ? (
              failed
            ) : searching ? (
              nothingFound
            ) : (
              <div className="ct-empty">
                <div className="et">No upcoming contests</div>
                <div className="es">
                  New rounds will show up here once scheduled.
                </div>
              </div>
            ))}

          {tab === 'past' &&
            (items.length ? (
              <>
                <div className="ct-list">
                  {items.map((c) => (
                    <PastRow key={c.id} c={c} onOpen={openContest} />
                  ))}
                </div>
                {hasMore && (
                  <div
                    ref={sentinelRef}
                    className="ct-sentinel"
                    aria-hidden="true"
                  />
                )}
              </>
            ) : loading ? null : error ? (
              failed
            ) : searching ? (
              nothingFound
            ) : (
              <div className="ct-empty">
                <div className="et">No past contests yet</div>
                <div className="es">Finished rounds will show up here.</div>
              </div>
            ))}
        </div>
      </div>
    </AppShell>
  );
}
