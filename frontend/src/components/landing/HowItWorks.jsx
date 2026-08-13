import { useState, useEffect, useRef } from 'react';
import Icons from '../Icons';
import PythonCode from './PythonCode';
import { StatusGlyph } from './bits';
import { DEMO_CODE } from '../../utils/landingContent';
import { cgRankFor } from '../../utils/ranks';
import { useLandingScroll } from '../../hooks/useLandingScroll';

// The editor pane shows the opening of the demo solution, not all of it.
const CODE_PREVIEW = DEMO_CODE.split('\n').slice(0, 7).join('\n');

// The rating ring, in the geometry the dashboard card draws it.
const RING_R = 86;
const RING_C = 2 * Math.PI * RING_R;

/** Rating history, drawn the way the dashboard draws it: line, fill, last point. */
function Sparkline({ history }) {
  const W = 300,
    H = 56,
    pad = 4;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / (history.length - 1);
  const y = (rating) => pad + (1 - (rating - min) / span) * (H - 2 * pad);
  const line = history
    .map(
      (rating, i) =>
        `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(rating).toFixed(1)}`
    )
    .join(' ');
  const area = `${line} L${x(history.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;

  return (
    <div className="hp-spark">
      <div className="shd">
        <span className="k">Rating · last {history.length}</span>
        <span className="v">
          {min}–{max}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lpSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gold)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="ar" d={area} />
        <path className="ln" d={line} vectorEffect="non-scaling-stroke" />
        <circle
          className="dot"
          cx={x(history.length - 1)}
          cy={y(history[history.length - 1])}
          r="3.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/**
 * Right-hand visual: one pane per step, cross-fading as the section is
 * scrubbed. Each pane is a small copy of the screen that step happens on — the
 * catalogue, the editor, the verdict, the rating ring.
 */
function StepVisual({ step, catalogue, you }) {
  const tier = cgRankFor(you.rating);
  const filled = Math.max(
    0,
    Math.min(1, (you.rating - tier.floor) / (tier.ceil - tier.floor))
  );

  return (
    <div className="how-vis rv rv-d1">
      <div className={`how-pane${step === 0 ? ' on' : ''}`}>
        <span className="hp-label">Problemset</span>
        <div className="hp-list">
          {catalogue.map((problem) => (
            <div key={problem.id} className="hp-item hp-prob">
              <StatusGlyph status={problem.status} />
              <span className="hp-prob-id">{problem.id}</span>
              <span className="hp-prob-t">{problem.title}</span>
              <span className={`df d-${problem.difficulty.toLowerCase()}`}>
                {problem.difficulty}
              </span>
              <span className="k">{problem.acceptance.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`how-pane${step === 1 ? ' on' : ''}`}>
        <span className="hp-label">Editor</span>
        <div className="hp-code">
          <PythonCode code={CODE_PREVIEW} />
        </div>
      </div>

      {/* The verdict comes back as the toast the workspace throws up, and the
          chips carry the same three colours the product gives the verdicts. */}
      <div className={`how-pane${step === 2 ? ' on' : ''}`}>
        <span className="hp-label">Judge</span>
        <div className="hp-toast">
          <span className="hp-toast-icon">
            <Icons.checkBold size={20} />
          </span>
          <span>
            <span className="hp-toast-big">Accepted</span>
            <span className="hp-toast-sub">38 ms</span>
          </span>
        </div>
        <div className="verdicts">
          <span className="lp-vd ac">AC</span>
          <span className="lp-vd wa">WA</span>
          <span className="lp-vd tle">TLE</span>
          <span className="lp-vd tle">MLE</span>
          <span className="lp-vd tle">OLE</span>
          <span className="lp-vd wa">RE</span>
          <span className="lp-vd wa">CE</span>
        </div>
      </div>

      {/* The dashboard's standing card: the ELO ring, the handle with the last
          change, the global rank and peak, the tier bar and the history. */}
      <div className={`how-pane hp-rate${step === 3 ? ' on' : ''}`}>
        <div className="hp-card-hd">
          <span className="t">
            <Icons.award size={15} />
            Your standing
          </span>
          <span className="more">
            Profile
            <Icons.chevRight size={13} />
          </span>
        </div>

        <div className="hp-card-bd">
          <div className="hp-ring">
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <defs>
                <linearGradient id="lpRingGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--gold-hi)" />
                  <stop offset="1" stopColor="var(--gold)" />
                </linearGradient>
              </defs>
              <circle
                className="track"
                cx="100"
                cy="100"
                r={RING_R}
                strokeWidth="14"
              />
              <circle
                className="meter"
                cx="100"
                cy="100"
                r={RING_R}
                strokeWidth="14"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - filled)}
              />
            </svg>
            <div className="hp-ring-c">
              <span className="elo">{you.rating}</span>
              <span className="lab">ELO Rating</span>
              <span className="rk">{tier.name}</span>
            </div>
          </div>

          <div className="hp-meta">
            <div className="hp-name">
              {you.handle}
              <span className="hp-last">
                <Icons.arrowUp size={12} />+{you.delta}
              </span>
            </div>
            <div className="hp-sub">
              Global rank <b>#{you.rank}</b> · max {you.max}
            </div>

            <div className="hp-tier">
              <div className="lbl">
                <span>{tier.floor}</span>
                <span>→ {tier.nextName}</span>
                <span>{tier.ceil}</span>
              </div>
              <div className="track">
                <div className="fill" style={{ width: `${filled * 100}%` }} />
              </div>
            </div>

            <Sparkline history={you.history} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * "How it works" — the section pins to the viewport and the four steps
 * advance with scroll progress through its tall wrapper.
 *
 * Props:
 *   steps     — the four steps; see utils/landingContent.js
 *   catalogue — problems for the problemset pane
 *   you       — the visitor's own rating row, so the rating pane agrees with
 *               the leaderboard further down the page
 */
export default function HowItWorks({ steps, catalogue, you }) {
  const scrollEl = useLandingScroll();
  const ref = useRef(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!scrollEl) return undefined;
    let raf = 0;

    // How far the section has travelled past the top of the scroll area,
    // over the distance it can travel while pinned.
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const distance = el.offsetHeight - scrollEl.clientHeight;
      if (distance <= 0) return;
      const travelled =
        scrollEl.getBoundingClientRect().top - el.getBoundingClientRect().top;
      const progress = Math.min(0.9999, Math.max(0, travelled / distance));
      setStep(Math.floor(progress * steps.length));
    };

    // Reading geometry forces layout, so it happens once per frame at most.
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure();
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      scrollEl.removeEventListener('scroll', onScroll);
    };
  }, [scrollEl, steps.length]);

  return (
    <section className="how band" id="how" ref={ref}>
      <div className="how-pin">
        <div className="wrap how-grid">
          <div className="rv">
            <span className="eyebrow">
              <i />
              How it works
            </span>
            <h2 className="sec-t">Four steps, one verdict.</h2>
            <div className="how-steps">
              {steps.map((s, i) => (
                <div key={s.t} className={`how-step${i === step ? ' on' : ''}`}>
                  <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="step-t">{s.t}</span>
                    <span className="step-d">
                      <span>{s.d}</span>
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <StepVisual step={step} catalogue={catalogue} you={you} />
        </div>
      </div>
    </section>
  );
}
