import Icons from '../Icons';
import { StatusGlyph } from './bits';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];

/**
 * Catalogue sample, following ProblemsPage: the difficulty filter and the tag
 * dropdown on top, then the sort bar whose labels stand over the columns, then
 * a problem per row-card — status, id, title with its tags, difficulty and the
 * share of attempts that pass.
 *
 * Rows are ordered by acceptance, hardest to pass on top, so the Acceptance
 * column carries the sort marker.
 */
function CatalogueMock({ rows }) {
  return (
    <div className="solo-cat rv rv-d1">
      <div className="solo-cat-top">
        <span className="solo-seg">
          {DIFFICULTIES.map((level) => (
            <span
              key={level}
              className={`${level === 'All' ? 'on' : ''} d-${level.toLowerCase()}`}
            >
              {level === 'All' ? null : <span className="sdot" />}
              {level}
            </span>
          ))}
        </span>
        <span className="solo-tags-btn">
          <Icons.grid size={14} />
          Tags
          <Icons.chevDown size={13} />
        </span>
      </div>

      <div className="solo-list">
        <div className="solo-sort">
          <span className="solo-sort-lbl">Sort by</span>
          <span className="col-id">#</span>
          <span className="col-name">Problem</span>
          <span className="col-diff">Difficulty</span>
          <span className="col-acc on">
            Acceptance
            <i>
              <Icons.arrowUp size={12} />
            </i>
          </span>
        </div>

        {rows.map((problem) => (
          <div key={problem.id} className="solo-row">
            <StatusGlyph status={problem.status} />
            <span className="solo-id">{problem.id}</span>
            <span className="solo-main">
              <span className="solo-title">{problem.title}</span>
              <span className="solo-tags">
                {problem.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </span>
            </span>
            <span className={`df d-${problem.difficulty.toLowerCase()}`}>
              {problem.difficulty}
            </span>
            <span className="solo-acc">
              {problem.acceptance.toFixed(1)}
              <span className="pct">%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Solo practice section — the counterweight to the contest sections: the same
 * problems, without a clock, a rating or anybody watching.
 *
 * Props:
 *   solo — copy and the catalogue sample; see utils/landingContent.js
 */
export default function SoloPractice({ solo }) {
  return (
    <section className="sec band solo-sec" id="solo">
      <div className="wrap solo-grid">
        <CatalogueMock rows={solo.catalogue} />

        <div className="solo-copy rv">
          <span className="eyebrow">
            <i />
            {solo.eyebrow}
          </span>
          <h2 className="sec-t">{solo.title}</h2>
          <p className="sec-sub">{solo.body}</p>
          <p className="solo-note">{solo.note}</p>
        </div>
      </div>
    </section>
  );
}
