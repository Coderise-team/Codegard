import { useState, useMemo } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Icons from '../components/Icons';
import Toolbar, { SelectedTags } from '../components/problems/ProblemsToolbar';
import ProblemList from '../components/problems/ProblemList';
import ProblemCards from '../components/problems/ProblemCards';
import Pagination from '../components/problems/Pagination';
import ProgressCard from '../components/problems/ProgressCard';
import DailyRandomCard from '../components/problems/DailyRandomCard';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useProblems } from '../hooks/useProblems';
import { useDifficultyBreakdown } from '../hooks/useDifficultyBreakdown';
import { useDaily } from '../hooks/useDaily';
import { useTags } from '../hooks/useTags';
import './ProblemsPage.css';

const PAGE_SIZE = 20; // backend PageNumberPagination default

// UI difficulty label -> API query value
const DIFF_PARAM = { Easy: 'easy', Medium: 'medium', Hard: 'hard' };
// sort column -> API ordering field (?ordering=, '-' prefix for descending)
const ORDER_FIELD = { name: 'name', diff: 'difficulty', acc: 'acceptance' };

/**
 * ProblemsPage — the problemset catalog (filter, sort, paginate, table/cards).
 *
 * Fully server-driven: the list (useProblems), the difficulty breakdown feeding
 * the progress card and header totals (useDifficultyBreakdown), the daily
 * challenge (useDaily) and the tag filter options (useTags) each fetch from the
 * API. Filters/sort/page are mapped to query params.
 */
export default function ProblemsPage() {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  // ---- view toggle (list = row-cards, grid = thick cards) ----
  const [view, setView] = useState('list');

  // ---- filter / sort / page state ----
  const [diff, setDiff] = useState('all');
  const [status, setStatus] = useState('all');
  const [tagsSel, setTagsSel] = useState([]);
  const [sortCol, setSortCol] = useState(null); // null=newest | name | diff | acc
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

  // sort-bar click cycle: col → asc → desc → off (back to newest)
  const cycleSort = (col) => {
    if (sortCol !== col) { setSortCol(col); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
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

  // solved/total per difficulty (rail progress + header totals). The endpoint's
  // keys are lowercase; map to the { Easy, Medium, Hard } shape the cards use.
  // Zeros while loading / until the endpoint is merged.
  const { data: diffData } = useDifficultyBreakdown(user?.username);
  const byDiff = useMemo(() => ({
    Easy: diffData?.easy ?? { solved: 0, total: 0 },
    Medium: diffData?.medium ?? { solved: 0, total: 0 },
    Hard: diffData?.hard ?? { solved: 0, total: 0 },
  }), [diffData]);

  // today's daily challenge (null while loading or when none is assigned)
  const { data: daily } = useDaily();

  // all catalog tags with counts, for the filter dropdown
  const { data: tagList } = useTags();
  const tags = useMemo(() => (tagList ?? []).map((t) => t.name), [tagList]);
  const tagCounts = useMemo(
    () => Object.fromEntries((tagList ?? []).map((t) => [t.name, t.count])),
    [tagList],
  );

  // actions — navigation is wired later
  const openProblem = () => {};
  const pickRandom = () => {
    if (rows.length) openProblem(rows[Math.floor(Math.random() * rows.length)]);
  };

  const list = view === 'grid'
    ? <ProblemCards rows={rows} onOpen={openProblem} onTag={toggleTag} />
    : <ProblemList rows={rows} sortCol={sortCol} sortDir={sortDir} onSortCol={cycleSort}
        onOpen={openProblem} onTag={toggleTag} />;

  const empty = (
    <div className="ps-emptywrap"><div className="ps-empty">
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
                  tags={tags} counts={tagCounts} tagsSel={tagsSel} onToggleTag={toggleTag} />

                <SelectedTags tagsSel={tagsSel} onToggle={toggleTag} onClear={clearTags} />

                {rows.length ? list : empty}

                <Pagination page={page} pageCount={pageCount} total={total}
                  from={from} to={to} onPage={setPage} />
              </div>

              <aside className="ps-rail">
                <ProgressCard byDiff={byDiff} />
                {daily && <DailyRandomCard daily={daily} onRandom={pickRandom} />}
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
