import React, { useState, useEffect, useRef } from 'react';
import highlightPython from '../../utils/highlightPython';
import { DEMO_CODE } from './content';

/** Right-hand visual: one pane per step, cross-fading as the section is scrubbed. */
function StepVisual({ step }) {
  return (
    <div className="how-vis rv rv-d1">
      <div className={`how-pane${step === 0 ? ' on' : ''}`}>
        <span className="hp-label">Problemset</span>
        <div className="hp-list">
          <div className="hp-item">
            <span className="dot ac" />
            Two Sum<span className="k">800</span>
          </div>
          <div className="hp-item">
            <span className="dot gd" />
            Segment Sum Queries<span className="k">1500</span>
          </div>
          <div className="hp-item">
            <span className="dot" />
            Minimum Spanning Forest<span className="k">2100</span>
          </div>
          <div className="hp-item">
            <span className="dot" />
            Palindromic Partitions<span className="k">1700</span>
          </div>
        </div>
      </div>

      <div className={`how-pane${step === 1 ? ' on' : ''}`}>
        <span className="hp-label">Editor</span>
        <div
          className="hp-code"
          dangerouslySetInnerHTML={{
            __html: highlightPython(
              DEMO_CODE.split('\n').slice(0, 7).join('\n')
            ),
          }}
        />
      </div>

      <div className={`how-pane${step === 2 ? ' on' : ''}`}>
        <span className="hp-label">Judge</span>
        <div className="hp-list">
          <div className="hp-item">
            <span className="dot ac" />
            Accepted<span className="k">38 ms · 17.4 MB</span>
          </div>
          <div className="hp-item">
            <span className="dot" />
            Isolated sandbox<span className="k">1s / 256 MB</span>
          </div>
        </div>
        <div className="verdicts">
          <span className="vd ac">AC</span>
          <span className="vd wa">WA</span>
          <span className="vd tle">TLE</span>
          <span className="vd tle">MLE</span>
          <span className="vd ne">OLE</span>
          <span className="vd wa">RE</span>
          <span className="vd ne">CE</span>
        </div>
      </div>

      <div className={`how-pane${step === 3 ? ' on' : ''}`}>
        <span className="hp-label">Rating after Round 418</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span className="hp-big">2147</span>
          <span className="hp-delta">+35</span>
        </div>
        <div className="hp-bar">
          <span style={{ width: '62%' }} />
        </div>
        <div className="hp-label">Master · 153 points to Grandmaster</div>
      </div>
    </div>
  );
}

/**
 * "How it works" — the section pins to the viewport and the four steps
 * advance with scroll progress through its tall wrapper.
 */
export default function HowItWorks({ steps }) {
  const ref = useRef(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const on = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = Math.min(
        0.9999,
        Math.max(0, -r.top / (el.offsetHeight - window.innerHeight))
      );
      setStep(Math.floor(p * steps.length));
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [steps.length]);

  return (
    <section className="how" id="how" ref={ref}>
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
                    <span className="st-t" style={{ display: 'block' }}>
                      {s.t}
                    </span>
                    <span className="st-d" style={{ display: 'block' }}>
                      {s.d}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <StepVisual step={step} />
        </div>
      </div>
    </section>
  );
}
