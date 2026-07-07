import Icons from '../Icons';
import { Example } from './bits';

function StatementTab({ problem }) {
  const p = problem;
  return (
    <div className="pp-pane-body scroll">
      <div className="pp-prob-head">
        <h1 className="pp-prob-title">
          <span className="pp-prob-id">{p.id}.</span> {p.title}
        </h1>
        <div className="pp-prob-meta">
          <span className={`chip diff-${p.difficulty.toLowerCase()}`}>
            {p.difficulty}
          </span>
          <span className="chip">
            <span className="k">Acc.</span>{' '}
            <span className="v">{p.acceptance}%</span>
          </span>
          <span className="chip">
            <Icons.clock size={12} /> <span className="v">{p.timeLimit}</span>
          </span>
          <span className="chip">
            <Icons.cpu size={12} /> <span className="v">{p.memoryLimit}</span>
          </span>
          {p.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="pp-stmt">
        {p.statement.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        <h3>Input</h3>
        {p.inputFormat.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        <h3>Output</h3>
        {p.outputFormat.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        <h3>Examples</h3>
        {p.examples.map((ex, i) => (
          <Example key={i} example={ex} index={i} />
        ))}
        <h3>Constraints</h3>
        <ul>
          {p.constraints.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SubmissionsTab({ submissions }) {
  if (!submissions.length) {
    return (
      <div className="pp-pane-body">
        <div className="pp-empty">No submissions yet.</div>
      </div>
    );
  }
  return (
    <div className="pp-pane-body scroll">
      <table className="pp-subs-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Verdict</th>
            <th>Language</th>
            <th>Time</th>
            <th>Memory</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id}>
              <td className="pp-sid">#{s.id}</td>
              <td>
                <span className={`pp-v-pill v-${s.verdict}`}>
                  <span className="pp-vd" />
                  {s.verdict}
                </span>
              </td>
              <td>{s.lang}</td>
              <td className="mono pp-fg2">{s.runtime}</td>
              <td className="mono pp-fg2">{s.memory}</td>
              <td className="pp-fg2">{s.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ProblemPanel — left pane of the workspace: Statement / Submissions tabs.
 *
 * Props:
 *   problem     — statement object (title, meta chips, texts, examples)
 *   submissions — rows for the Submissions tab
 *   tab, onTab  — active tab id ('statement' | 'submissions') + setter
 *   style       — layout style from the splitter (flexBasis %)
 */
export default function ProblemPanel({
  problem,
  submissions,
  tab,
  onTab,
  style,
}) {
  return (
    <section className="pp-pane pp-problem-pane" style={style}>
      <div className="pp-tabbar">
        <button
          className={`pp-tab${tab === 'statement' ? ' is-active' : ''}`}
          onClick={() => onTab('statement')}
        >
          <Icons.doc size={15} /> Statement
        </button>
        <button
          className={`pp-tab${tab === 'submissions' ? ' is-active' : ''}`}
          onClick={() => onTab('submissions')}
        >
          <Icons.list size={15} /> Submissions
          <span className="pp-tab-badge">{submissions.length}</span>
        </button>
      </div>
      {tab === 'statement' ? (
        <StatementTab problem={problem} />
      ) : (
        <SubmissionsTab submissions={submissions} />
      )}
    </section>
  );
}
