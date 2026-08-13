import { useState, useEffect } from 'react';
import Icons from '../Icons';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import PythonCode from './PythonCode';
import { DEMO_CODE } from '../../utils/landingContent';

// What happens after the code is typed out, each delay counted from the step
// before it: the button presses, the judge runs, the verdict lands.
const AFTER_TYPING = [
  ['press', 520],
  ['running', 240],
  ['verdict', 1340],
];

const START_DELAY = 500; // quiet moment before the first character
const RESTART_DELAY = 6900; // how long the verdict stays up before a rerun
const TYPING_TICK = 26;

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

    // Each step schedules only the next one, so exactly one timer is pending
    // at any moment however long the page stays open.
    let timer = 0;
    let interval = 0;

    function type() {
      setN(0);
      setPhase('typing');
      let typed = 0;
      interval = setInterval(() => {
        // One or two characters a tick, so the typing does not look metronomic.
        typed += 1 + Math.floor(Math.random() * 2);
        if (typed < DEMO_CODE.length) {
          setN(typed);
          return;
        }
        clearInterval(interval);
        interval = 0;
        setN(DEMO_CODE.length);
        advance(0);
      }, TYPING_TICK);
    }

    function advance(step) {
      if (step === AFTER_TYPING.length) {
        timer = setTimeout(type, RESTART_DELAY);
        return;
      }
      const [next, delay] = AFTER_TYPING[step];
      timer = setTimeout(() => {
        setPhase(next);
        advance(step + 1);
      }, delay);
    }

    timer = setTimeout(type, START_DELAY);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [reduced]);

  // Nothing animates under reduced motion, so the demo shows its last frame.
  if (reduced) return { n: DEMO_CODE.length, phase: 'verdict' };
  return { n, phase };
}

/**
 * Editor mock used by the hero. It reproduces the editor pane of the problem
 * workspace: the toolbar with the language picker and Report, the code with its
 * gutter, and the action bar with Reset and Submit. The verdict arrives the way
 * it does in the product, as a toast floating over the workspace.
 */
export default function EditorMock() {
  const reduced = useReducedMotion();
  const { n, phase } = useSubmitCycle(reduced);
  const shown = DEMO_CODE.slice(0, n);
  const totalLines = DEMO_CODE.split('\n').length;
  const currentLine = shown.split('\n').length;

  return (
    <div className="ed-shell hero-in" translate="no">
      <div className="ed-top">
        <span className="ed-lang">
          <span className="ed-lang-ic" />
          Python 3
          <Icons.chevDown size={14} />
        </span>
        <span className="ed-report">
          <Icons.flag size={14} />
          Report
        </span>
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
        <div className="ed-toast">
          <span className="ed-toast-icon">
            <Icons.checkBold size={20} />
          </span>
          <span>
            <span className="ed-toast-big">Accepted</span>
            <span className="ed-toast-sub">38 ms</span>
          </span>
        </div>
      ) : null}

      <div className="ed-bar">
        <div className="ed-status">
          <Icons.terminal size={14} />
          {phase === 'running' ? 'Judging…' : 'Python 3 · ready'}
        </div>
        <div className="ed-actions">
          <span className="btn btn-ghost btn-sm">
            <Icons.reset size={15} />
            Reset
          </span>
          <span
            className={`btn btn-primary btn-sm${phase === 'press' ? ' pressed' : ''}`}
          >
            {phase === 'running' ? (
              <span className="spin" />
            ) : (
              <Icons.send size={15} />
            )}
            Submit
          </span>
        </div>
      </div>
    </div>
  );
}
