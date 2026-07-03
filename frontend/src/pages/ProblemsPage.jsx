import { useState, useMemo } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Icons from '../components/Icons';
import Toolbar, { SelectedTags } from '../components/problems/ProblemsToolbar';
import ProblemTable from '../components/problems/ProblemTable';
import ProblemCards from '../components/problems/ProblemCards';
import Pagination from '../components/problems/Pagination';
import ProgressCard from '../components/problems/ProgressCard';
import DailyRandomCard from '../components/problems/DailyRandomCard';
import { useCurrentUser } from '../hooks/useCurrentUser';
import problemsData from '../data/problemsData'; // STUB — replaced by useProblems (step 6)
import './ProblemsPage.css';

const DIFF_RANK = { Easy: 0, Medium: 1, Hard: 2 };
const PAGE_SIZE = 12;

// STUB daily — replaced by useDailyChallenge (step 8)
const STUB_DAILY = {
  title: 'Two Sum',
  difficulty: 'Easy',
  tags: ['Arrays', 'Hashing'],
  acceptance: 71.4,
};

/**
 * ProblemsPage — the problemset catalog (filter, sort, paginate, table/cards).
 *
 * STUB: the filter/sort/paginate logic below runs client-side on mock data.
 * Steps 6–9 replace it with server-driven hooks (useProblems / difficulty
 * breakdown / daily challenge); the shell (Sidebar/Navbar/user) is already real.
 */
export default function ProblemsPage() {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  // ---- STUB data source (mock) ----
  const ALL = problemsData.problems;
  const TAGS = problemsData.tags;

  // ---- view toggle ----
  const [view, setView] = useState('table');

  // ---- filter / sort / page state ----
  const [diff, setDiff] = useState('all');
  const [status, setStatus] = useState('all');
  const [tagsSel, setTagsSel] = useState([]);
  const [sortCol, setSortCol] = useState(null); // null=newest | id | diff | acc
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  // Any change to the filtered/sorted set resets to page 1. We do this inline in
  // each handler (not in an effect) to avoid a cascading re-render.
  const changeDiff = (v) => { setDiff(v); setPage(1); };
  const changeStatus = (v) => { setStatus(v); setPage(1); };
  const changeView = (v) => { setView(v); setPage(1); };
  const clearTags = () => { setTagsSel([]); setPage(1); };
  const resetFilters = () => { setDiff('all'); setStatus('all'); setTagsSel([]); setPage(1); };
  const toggleTag = (tg) => {
    setTagsSel((s) => s.includes(tg) ? s.filter((x) => x !== tg) : [...s, tg]);
    setPage(1);
  };

  // header-click sort cycle: col → desc → asc → off (back to newest)
  const cycleSort = (col) => {
    if (sortCol !== col) { setSortCol(col); setSortDir('desc'); }
    else if (sortDir === 'desc') setSortDir('asc');
    else { setSortCol(null); setSortDir('desc'); }
    setPage(1);
  };

  // tag counts over the full catalog (for chip badges)
  const tagCounts = useMemo(() => {
    const c = {};
    for (const p of ALL) for (const tg of p.tags) c[tg] = (c[tg] || 0) + 1;
    return c;
  }, [ALL]);

  // solved-by-difficulty (rail progress)
  const byDiff = useMemo(() => {
    const m = { Easy: { solved: 0, total: 0 }, Medium: { solved: 0, total: 0 }, Hard: { solved: 0, total: 0 } };
    for (const p of ALL) { m[p.difficulty].total++; if (p.status === 'solved') m[p.difficulty].solved++; }
    return m;
  }, [ALL]);

  // apply filters + sort
  const filtered = useMemo(() => {
    const rows = ALL.filter((p) => {
      if (diff !== 'all' && p.difficulty !== diff) return false;
      if (status !== 'all' && p.status !== status) return false;
      if (tagsSel.length && !tagsSel.every((tg) => p.tags.includes(tg))) return false;
      return true;
    });
    const key = {
      id: (p) => p.id,
      diff: (p) => DIFF_RANK[p.difficulty],
      acc: (p) => p.acc,
    }[sortCol];
    if (!key) return [...rows].sort((a, b) => b.added - a.added); // newest
    return [...rows].sort((a, b) => {
      const d = (key(a) - key(b)) || (a.added - b.added);
      return sortDir === 'desc' ? -d : d;
    });
  }, [ALL, diff, status, tagsSel, sortCol, sortDir]);

  // pagination
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const from = filtered.length ? start + 1 : 0;
  const to = start + pageRows.length;

  // actions — navigation is wired later (see step 6+)
  const openProblem = () => {};
  const pickRandom = () => {
    const pool = filtered.length ? filtered : ALL;
    openProblem(pool[Math.floor(Math.random() * pool.length)]);
  };

  const list = view === 'cards'
    ? <ProblemCards rows={pageRows} onOpen={openProblem} onTag={toggleTag} />
    : <ProblemTable rows={pageRows} sortCol={sortCol} sortDir={sortDir} onSortCol={cycleSort}
        onOpen={openProblem} onTag={toggleTag} />;

  const empty = (
    <div className="ptable-wrap"><div className="ps-empty">
      <div className="ei"><Icons.search size={22} /></div>
      <div className="et">No problems match these filters</div>
      <div className="es">Try clearing the difficulty, status or tags.</div>
      <button className="btn" onClick={resetFilters}>
        Reset filters</button>
    </div></div>
  );

  return (
    <div className="dash" data-density="compact">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <Navbar user={user} title="Problems" onMenuClick={() => setNavOpen(true)} />

        <div className="canvas scroll">
          <div className="ps-canvas">
            <div className="ps-head">
              <h1>Problemset</h1>
              <span className="ps-count"><b>{filtered.length}</b> of {ALL.length} problems</span>
              <div className="ps-diffsum">
                {[['Easy', 'd-easy'], ['Medium', 'd-medium'], ['Hard', 'd-hard']].map(([d, c]) => (
                  <div key={d} className={`ds ${c}`}>
                    <span className="n">{byDiff[d].total}</span><span className="k">{d}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ps-body">
              <div className="ps-main">
                <Toolbar
                  diff={diff} onDiff={changeDiff}
                  status={status} onStatus={changeStatus}
                  view={view} onView={changeView}
                  tags={TAGS} counts={tagCounts} tagsSel={tagsSel} onToggleTag={toggleTag} />

                <SelectedTags tagsSel={tagsSel} onToggle={toggleTag} onClear={clearTags} />

                {filtered.length ? list : empty}

                <Pagination page={safePage} pageCount={pageCount} total={filtered.length}
                  from={from} to={to} onPage={setPage} />
              </div>

              <aside className="ps-rail">
                <ProgressCard byDiff={byDiff} />
                <DailyRandomCard daily={STUB_DAILY} onRandom={pickRandom} />
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
