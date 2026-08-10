import { useState } from 'react';
import Icons from '../Icons';
import { LandingLogo } from './LandingHeader';

/** Four one-line facts about how a submission is decided. */
export function JudgeSection({ items }) {
  return (
    <section className="sec-tight" id="judge">
      <div className="wrap">
        <div className="rv">
          <span className="eyebrow">
            <i />
            Under the hood
          </span>
          <h2 className="sec-t">How a submission is decided.</h2>
        </div>
        <div className="judge">
          {items.map((j, i) => {
            const Icon = Icons[j.icon];
            return (
              <div key={j.t} className={`jc rv rv-d${i + 1}`}>
                <span className="ic">
                  <Icon size={19} />
                </span>
                <span className="tx">{j.t}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Accordion; the first item is open by default. */
export function FaqSection({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <section className="sec-tight" id="faq">
      <div className="wrap" style={{ width: 860 }}>
        <div className="rv">
          <span className="eyebrow">
            <i />
            FAQ
          </span>
          <h2 className="sec-t">Questions before the first submission.</h2>
        </div>
        <div className="faq rv rv-d1">
          {items.map((f, i) => (
            <div key={f.q} className={`faq-i${open === i ? ' open' : ''}`}>
              <button
                type="button"
                className="faq-q"
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                {f.q}
                <span className="ch">
                  <Icons.chevDown size={18} />
                </span>
              </button>
              <div className="faq-a">
                <p>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="final">
      <div className="wrap rv">
        <span className="eyebrow">
          <i />
          Start now
        </span>
        <h2>
          Your rating starts at <span className="g">the next submission.</span>
        </h2>
        <p className="sec-sub">
          Create an account, open a problem, send it to the judge.
        </p>
        <div className="hero-cta">
          <a className="btn btn-lg btn-primary" href="/register">
            Create account
            <Icons.send size={17} />
          </a>
          <a className="btn btn-lg" href="/contests">
            See upcoming contests
          </a>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-foot">
      <div className="wrap">
        <div className="foot-in">
          <div>
            <LandingLogo />
            <p className="foot-tag">
              Problems, live contests and a rating that keeps score.
            </p>
          </div>
          <div className="foot-cols">
            <div className="foot-col">
              <span className="h">Platform</span>
              <a href="/problems">Problems</a>
              <a href="/contests">Contests</a>
              <a href="/standings">Standings</a>
              <a href="/profile">Profile</a>
            </div>
            <div className="foot-col">
              <span className="h">Account</span>
              <a href="/login">Sign in</a>
              <a href="/register">Create account</a>
            </div>
            <div className="foot-col">
              <span className="h">Legal</span>
              <a href="/privacy">Privacy policy</a>
              <a href="/privacy#terms">Terms of use</a>
            </div>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 Codegard</span>
          <span className="sp">
            <a href="/privacy">Privacy policy</a>
            <a href="mailto:hi@codegard.io">hi@codegard.io</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
