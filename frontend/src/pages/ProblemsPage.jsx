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
import { useProblems } from '../hooks/useProblems';
import './ProblemsPage.css';

const PAGE_SIZE = 20; // backend PageNumberPagination default

// UI difficulty label -> API query value
const DIFF_PARAM = { Easy: 'easy', Medium: 'medium', Hard: 'hard' };
// sort column -> API ordering field (?ordering=, '-' prefix for descending)
const ORDER_FIELD = { id: 'id', diff: 'difficulty', acc: 'acceptance' };

// STUB: right rail + tag counts come from their own endpoints in later steps.
const STUB_BYDIFF = {
  Easy: { solved: 0, total: 0 },
  Medium: { solved: 0, total: 0 },
  Hard: { solved: 0, total: 0 },
}; // step 7 — GET /api/users/{username}/difficulty/
const STUB_TAGS = []; // step 9 — GET /api/problems/tags/
const STUB_TAG_COUNTS = {}; // step 9
const STUB_DAILY = {
  title: 'Two Sum',
  difficulty: 'Easy',
  tags: ['Arrays', 'Hashing'],
  acceptance: 71.4,
}; // step 8 — useDailyChallenge

/**
 * ProblemsPage — the problemset catalog (filter, sort, paginate, table/cards).
 *
 * The list is server-driven: filters/sort/page are mapped to query params and
 * fetched via useProblems. The right rail (progress, daily) and tag counts are
 * still STUB — wired in steps 7–9.
 */
export default function ProblemsPage() {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  // ---- view toggle ----
  const [view, setView] = useState('table');

  // ---- filter / sort / page state ----
  const [diff, setDiff] = useState('all');
  const [status, setStatus] = useState('all');
  const [tagsSel, setTagsSel] = useState([]);
  const [sortCol, setSortCol] = useState(null); // null=newest | id | diff | acc
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  // Any change to the filtered/sorted set resets to page 1 (inline in each
  // handler, not in an effect, to avoid a cascading re-render).
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

  // UI state -> API query params (memoised so the hook only refetches on change)
  const params = useMemo(() => {
    const p = { page };
    if (diff !== 'all') p.difficulty = DIFF_PARAM[diff];
    if (status !== 'all') p.status = status;
    if (tagsSel.length) p.tag = tagsSel;
    if (sortCol) p.ordering = (sortDir === 'desc' ? '-' : '') + ORDER_FIELD[sortCol];
    return p;
  }, [diff, status, tagsSel, sortCol, sortDir, page]);

  const { data } = useProblems(params);
  const rows = data?.results ?? [];
  const total = data?.count ?? 0;

  // pagination math from the server response
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = (page - 1) * PAGE_SIZE + rows.length;

  // STUB right-rail data (steps 7–9)
  const byDiff = STUB_BYDIFF;

  // actions — navigation is wired later
  const openProblem = () => {};
  const pickRandom = () => {
    if (rows.length) openProblem(rows[Math.floor(Math.random() * rows.length)]);
  };

  const list = view === 'cards'
    ? <ProblemCards rows={rows} onOpen={openProblem} onTag={toggleTag} />
    : <ProblemTable rows={rows} sortCol={sortCol} sortDir={sortDir} onSortCol={cycleSort}
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
              <span className="ps-count"><b>{total}</b> problems</span>
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
                  tags={STUB_TAGS} counts={STUB_TAG_COUNTS} tagsSel={tagsSel} onToggleTag={toggleTag} />

                <SelectedTags tagsSel={tagsSel} onToggle={toggleTag} onClear={clearTags} />

                {rows.length ? list : empty}

                <Pagination page={page} pageCount={pageCount} total={total}
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
