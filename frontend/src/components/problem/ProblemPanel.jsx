import Icons from '../Icons';
import { Example } from './bits';
import { timeAgo } from '../../utils/time';

// Statement fields are plain TextFields on the backend: every non-empty
// line is a paragraph (or a list item for constraints).
const lines = (text) => (text ?? '').split('\n').filter((s) => s.trim());

function StatementTab({ problem }) {
  const p = problem;
  return (
    <div className="pp-pane-body scroll">
      <div className="pp-prob-head">
        <h1 className="pp-prob-title">
          <span className="pp-prob-id">{p.id}.</span> {p.title}
        </h1>
        <div className="pp-prob-meta">
          <span className={`chip diff-${p.difficulty}`}>{p.difficulty}</span>
          <span className="chip">
            <span className="k">Acc.</span>{' '}
            <span className="v">{p.acceptance}%</span>
          </span>
          <span className="chip">
            <Icons.clock size={12} />{' '}
            <span className="v">{p.time_limit} ms</span>
          </span>
          <span className="chip">
            <Icons.cpu size={12} />{' '}
            <span className="v">{p.memory_limit} MB</span>
          </span>
          {p.tags.map((t) => (
            <span key={t} className="chip">
              <span className="v">{t}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="pp-stmt">
        {lines(p.description).map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        {p.input_format && (
          <>
            <h3>Input</h3>
            {lines(p.input_format).map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </>
        )}
        {p.output_format && (
          <>
            <h3>Output</h3>
            {lines(p.output_format).map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </>
        )}
        {p.test_cases.length > 0 && (
          <>
            <h3>Examples</h3>
            {p.test_cases.map((tc, i) => (
              <Example key={tc.id} example={tc} index={i} />
            ))}
          </>
        )}
        {p.constraints && (
          <>
            <h3>Constraints</h3>
            <ul>
              {lines(p.constraints).map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

const fmtMetric = (value, unit) => (value == null ? '—' : `${value} ${unit}`);

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
                {s.verdict ? (
                  <span
                    className={`pp-v-pill v-${s.verdict}`}
                    title={s.verdict_display}
                  >
                    <span className="pp-vd" />
                    {s.verdict}
                  </span>
                ) : (
                  <span className="pp-v-pill v-pending">
                    <span className="pp-vd" />
                    Pending
                  </span>
                )}
              </td>
              <td>{s.language_display}</td>
              <td className="mono pp-fg2">
                {fmtMetric(s.execution_time_ms, 'ms')}
              </td>
              <td className="mono pp-fg2">
                {fmtMetric(s.memory_used_mb, 'MB')}
              </td>
              <td className="pp-fg2">{timeAgo(s.created_at)}</td>
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
