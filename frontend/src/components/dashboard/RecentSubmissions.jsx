import Icons from '../Icons';
import EmptyState from './EmptyState';
import { useUserSubmissions } from '../../hooks/useUserSubmissions';
import { timeAgo } from '../../utils/time';

// Newest submissions shown on the dashboard card.
const MAX_ROWS = 6;

const formatRuntime = (ms) => (ms == null ? '—' : `${ms} ms`);

/**
 * RecentSubmissions — table of the given user's latest submissions (across all
 * problems), newest first. The caller owns "whose data".
 */
export default function RecentSubmissions({ username }) {
  const I = Icons;
  const { data, loading, error } = useUserSubmissions(username, MAX_ROWS);

  if (data && data.length === 0) {
    return (
      <EmptyState
        icon="list"
        title="No submissions yet"
        sub="Solve your first problem to see your verdict history here."
      />
    );
  }

  return (
    <section className="card">
      <div className="card-hd">
        <span className="t">
          <I.list size={16} /> Recent submissions
        </span>
      </div>
      <div className="card-bd flush">
        {loading && <div className="list-msg">Loading…</div>}
        {error && <div className="list-msg">Couldn’t load submissions.</div>}
        {data && data.length > 0 && (
          <table className="subtab">
            <thead>
              <tr>
                <th>#</th>
                <th>Problem</th>
                <th>Verdict</th>
                <th>Lang</th>
                <th>Runtime</th>
                <th style={{ textAlign: 'right' }}>When</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, MAX_ROWS).map((s) => (
                <tr key={s.id}>
                  <td className="st-id">#{s.id}</td>
                  <td className="st-title">{s.problem_title}</td>
                  <td>
                    {s.verdict ? (
                      <span className={`vd v-${s.verdict}`}>{s.verdict}</span>
                    ) : (
                      <span className="vd">…</span>
                    )}
                  </td>
                  <td className="mono">{s.language_display}</td>
                  <td className="mono">{formatRuntime(s.execution_time_ms)}</td>
                  <td className="st-when" style={{ textAlign: 'right' }}>
                    {timeAgo(s.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
