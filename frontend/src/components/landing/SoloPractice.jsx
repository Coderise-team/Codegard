import Icons from '../Icons';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];

/**
 * Catalogue sample: the filter bar and a handful of problem rows, in the shape
 * the real problem set uses — status, id, title, tags, difficulty, acceptance.
 * Rows are ordered by acceptance so the hardest to pass sits on top.
 */
function CatalogueMock({ rows }) {
  return (
    <div className="solo-cat rv rv-d1">
      <div className="solo-cat-top">
        <span className="solo-seg">
          {DIFFICULTIES.map((level) => (
            <span key={level} className={level === 'All' ? 'on' : undefined}>
              {level}
            </span>
          ))}
        </span>
        <span className="solo-sort">
          Acceptance
          <Icons.arrowUp size={12} />
        </span>
      </div>

      <div className="solo-rows">
        {rows.map((problem) => (
          <div key={problem.id} className="solo-row">
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
    <section className="sec solo-sec" id="solo">
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
