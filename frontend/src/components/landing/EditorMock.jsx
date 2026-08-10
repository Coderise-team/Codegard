import { useState, useEffect } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import PythonCode from './PythonCode';
import { DEMO_CODE } from '../../utils/landingContent';

/**
 * The hero submission demo, on a loop:
 *   typing → press → running → verdict → (pause) → typing…
 * Reduced motion pins it to the finished "verdict" frame.
 */
function useSubmitCycle(reduced) {
  const [n, setN] = useState(0);
  const [phase, setPhase] = useState('typing');

  useEffect(() => {
    if (reduced) return undefined;
    const timers = [];
    let stopped = false;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));

    const run = () => {
      if (stopped) return;
      setN(0);
      setPhase('typing');
      let i = 0;
      const iv = setInterval(() => {
        i += 1 + Math.floor(Math.random() * 2);
        if (i >= DEMO_CODE.length) {
          clearInterval(iv);
          setN(DEMO_CODE.length);
          at(520, () => setPhase('press'));
          at(760, () => setPhase('running'));
          at(2100, () => setPhase('verdict'));
          at(9000, run);
        } else setN(i);
      }, 26);
      timers.push({ clear: () => clearInterval(iv) });
    };

    at(500, run);
    return () => {
      stopped = true;
      timers.forEach((t) => (t.clear ? t.clear() : clearTimeout(t)));
    };
  }, [reduced]);

  // Nothing animates under reduced motion, so the demo shows its last frame.
  if (reduced) return { n: DEMO_CODE.length, phase: 'verdict' };
  return { n, phase };
}

/** Editor mock used by the hero: gutter, highlighted code, action bar, verdict. */
export default function EditorMock() {
  const reduced = useReducedMotion();
  const { n, phase } = useSubmitCycle(reduced);
  const shown = DEMO_CODE.slice(0, n);
  const totalLines = DEMO_CODE.split('\n').length;
  const currentLine = shown.split('\n').length;

  return (
    <div className="ed-shell">
      <div className="ed-top">
        <div className="ed-dots">
          <i />
          <i />
          <i />
        </div>
        <div className="ed-title">
          <b>A · Two Sum</b> &nbsp;·&nbsp; 1s / 256 MB
        </div>
        <div className="ed-lang">Python 3</div>
      </div>

      <div className="ed-body">
        <div className="ed-gutter">
          {Array.from({ length: totalLines }, (_, i) => (
            <div key={i} className={i + 1 === currentLine ? 'cur' : ''}>
              {i + 1}
            </div>
          ))}
        </div>
        <div className="ed-code">
          <PythonCode code={shown} />
          {phase === 'typing' && !reduced ? (
            <span className="ed-caret" />
          ) : null}
        </div>
      </div>

      {phase === 'verdict' ? (
        <div className="verdict">
          <span className="pill">
            <i />
            Accepted
          </span>
          <span className="m">
            <span>
              <b>38</b> ms
            </span>
            <span>
              <b>17.4</b> MB
            </span>
          </span>
        </div>
      ) : null}

      <div className="ed-bar">
        <div className="ed-status">
          {phase === 'running' ? (
            <>
              <span className="sp" />
              Running on judge…
            </>
          ) : null}
          {phase === 'verdict' ? 'Submission #4 · 09:12:44' : null}
          {phase === 'typing' || phase === 'press' ? 'Draft saved' : null}
        </div>
        <div className="ed-actions">
          <span className="btn btn-sm btn-ghost">Run</span>
          <span className={phase === 'press' ? 'ed-sub pressed' : 'ed-sub'}>
            Submit
          </span>
        </div>
      </div>
    </div>
  );
}
