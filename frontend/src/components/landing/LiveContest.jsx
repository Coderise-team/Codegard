import { useState, useEffect } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const ROW_H = 58; // must match .brow height + gap in LandingPage.css

/**
 * Live contest section: a running countdown next to a standings board whose
 * rows re-sort as points come in. The board is a mock — a random participant
 * gains points on an interval; reduced motion keeps it still.
 */
export default function LiveContest({ contest }) {
  const reduced = useReducedMotion();
  const [rows, setRows] = useState(contest.board);
  const [bump, setBump] = useState(null);
  const [left, setLeft] = useState(contest.secondsLeft);

  useEffect(() => {
    const iv = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (reduced) return undefined;
    const iv = setInterval(() => {
      setRows((r) => {
        const i = Math.floor(Math.random() * r.length);
        const next = r.map((x, k) =>
          k === i
            ? {
                ...x,
                pts: x.pts + 40 + Math.floor(Math.random() * 90),
                solved: Math.min(5, x.solved + 1),
              }
            : x
        );
        setBump(next[i].handle);
        setTimeout(() => setBump(null), 1400);
        return next;
      });
    }, 3400);
    return () => clearInterval(iv);
  }, [reduced]);

  const order = [...rows].sort((a, b) => b.pts - a.pts);
  const pos = {};
  order.forEach((r, i) => {
    pos[r.handle] = i;
  });

  const pad = (v) => String(v).padStart(2, '0');
  const clock = `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;

  return (
    <section className="sec contest-sec" id="contests">
      <div className="wrap contest-grid">
        <div className="contest-copy rv">
          <span className="eyebrow">
            <i />
            Live contests
          </span>
          <h2 className="sec-t">The clock is part of the problem.</h2>
          <p className="sec-sub">
            Rounds open at a fixed time and everyone gets the same statement at
            the same second. Points decay while the timer runs, and the board
            moves the moment a submission is accepted.
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
