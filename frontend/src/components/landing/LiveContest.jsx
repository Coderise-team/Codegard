import { useState, useEffect } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const ROW_H = 58; // must match .brow height + gap in LandingPage.css

const POINTS_PER_PROBLEM = 100;
const PROBLEM_COUNT = 5;
const SOLVE_EVERY = 3400;
const BUMP_FOR = 1400;

const pad = (value) => String(value).padStart(2, '0');
const asHoursMinutes = (seconds) =>
  `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}`;

/**
 * Live contest section: a running countdown next to a standings board whose
 * rows re-sort as solutions come in. The board is a sample, not live data —
 * somebody who still has problems left solves one every few seconds, worth a
 * flat 100 points as in a real round, until the whole board is finished.
 * Reduced motion keeps it still.
 */
export default function LiveContest({ contest }) {
  const reduced = useReducedMotion();
  const [rows, setRows] = useState(contest.board);
  const [bump, setBump] = useState(null);
  const [left, setLeft] = useState(contest.secondsLeft);

  // How far the round had already run when the page opened.
  const elapsedOnOpen = contest.lengthSeconds - contest.secondsLeft;

  useEffect(() => {
    const iv = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (reduced) return undefined;
    const openedAt = Date.now();
    let fade = 0;
    const iv = setInterval(() => {
      // Where the round stands right now, so an accepted solution lands at a
      // believable minute instead of leaving the row's own clock behind.
      const intoRound =
        elapsedOnOpen + Math.floor((Date.now() - openedAt) / 1000);

      setRows((current) => {
        const unfinished = current.filter((r) => r.solved < PROBLEM_COUNT);
        if (!unfinished.length) return current;

        const solver =
          unfinished[Math.floor(Math.random() * unfinished.length)].handle;
        setBump(solver);
        clearTimeout(fade);
        fade = setTimeout(() => setBump(null), BUMP_FOR);

        return current.map((row) =>
          row.handle === solver
            ? {
                ...row,
                solved: row.solved + 1,
                pts: row.pts + POINTS_PER_PROBLEM,
                // Penalty carries the minutes spent reaching this solution.
                pen: row.pen + Math.floor(intoRound / 60),
                last: asHoursMinutes(intoRound),
              }
            : row
        );
      });
    }, SOLVE_EVERY);
    return () => {
      clearInterval(iv);
      clearTimeout(fade);
    };
  }, [reduced, elapsedOnOpen]);

  // The real leaderboard orders by score, then by the smaller penalty, then by
  // whoever got there first (see contests/services.py).
  const order = [...rows].sort(
    (a, b) => b.pts - a.pts || a.pen - b.pen || a.last.localeCompare(b.last)
  );
  const pos = {};
  order.forEach((r, i) => {
    pos[r.handle] = i;
  });

  const clock = `${asHoursMinutes(left)}:${pad(left % 60)}`;

  return (
    <section className="sec contest-sec" id="contests">
      <div className="wrap contest-grid">
        <div className="contest-copy rv">
          <span className="eyebrow">
            <i />
            Live contests
          </span>
          <h2 className="sec-t">Every second you spend goes on the record.</h2>
          <p className="sec-sub">
            Each round runs to a fixed clock. The longer a problem takes you,
            the worse it counts, so solve early if you want to finish above the
            rest.
          </p>

          <div className="round-card">
            <div className="rc-top">
              <span className="rc-live">
                <i />
                Round in progress
              </span>
              <span className="rc-name">{contest.name}</span>
            </div>
            <div className="rc-timer">
              <span className="t">{clock}</span>
              <span className="lbl">Time left</span>
            </div>
            <div className="rc-probs">
              {contest.problems.map((p) => (
                <span key={p.id} className={`rc-prob ${p.state}`}>
                  {p.id}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="board rv rv-d1">
          <div className="board-top">
            <span className="ttl">
              Standings · {contest.name.split('·').pop().trim()}
            </span>
            <span className="upd">
              <i />
              live
            </span>
          </div>
          <div className="board-head">
            <span>#</span>
            <span>Participant</span>
            <span className="n">Solved</span>
            <span className="n">Pen.</span>
            <span className="n">Last AC</span>
            <span className="n">Points</span>
          </div>
          <div className="board-rows">
            {rows.map((r) => (
              <div
                key={r.handle}
                className={`brow${r.you ? ' you' : ''}${bump === r.handle ? ' bump' : ''}`}
                style={{ transform: `translateY(${pos[r.handle] * ROW_H}px)` }}
              >
                <span className="rk">{pos[r.handle] + 1}</span>
                <span className="bu">
                  <span className="bav">{r.initials}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="bh">
                      {r.handle}
                      {r.you ? (
                        <span className="lp-you-tag" style={{ marginLeft: 8 }}>
                          YOU
                        </span>
                      ) : null}
                    </span>
                    <span className="bt">last AC {r.last}</span>
                  </span>
                </span>
                <span className="n ac">{r.solved}</span>
                <span className={`n${r.pen ? ' pen' : ''}`}>
                  {r.pen ? `+${r.pen}` : '—'}
                </span>
                <span className="n">{r.last}</span>
                <span className="pts">{r.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
