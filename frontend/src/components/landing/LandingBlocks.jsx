import { useState } from 'react';
import Icons from '../Icons';
import { LandingLogo } from './LandingHeader';

/** Four one-line facts about how a submission is decided. */
export function JudgeSection({ items }) {
  return (
    <section className="sec-tight band" id="judge">
      <div className="wrap">
        <div className="rv">
          <span className="eyebrow">
            <i />
            Under the hood
          </span>
          <h2 className="sec-t">What happens after you press Submit.</h2>
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
    <section className="sec-tight band" id="faq">
      <div className="wrap" style={{ width: 860 }}>
        <div className="rv">
          <span className="eyebrow">
            <i />
            FAQ
          </span>
          <h2 className="sec-t">Questions before the first submission.</h2>
        </div>
        <div className="faq rv">
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
    <section className="final band">
      <div className="wrap rv">
        <span className="eyebrow">
          <i />
          Start now
        </span>
        <h2>
          Your rating starts at <span className="g">your first contest.</span>
        </h2>
        <p className="sec-sub">
          Solve problems, join live contests, watch your rating move.
        </p>
        <div className="hero-cta">
          <a className="btn btn-lg btn-primary" href="/register">
            Create account
            <Icons.send size={17} />
          </a>
        </div>
        <p className="hero-note">Free. No card, no limits.</p>
      </div>
    </section>
  );
}

// Same address the privacy policy gives, so a reader gets one contact.
const CONTACT_EMAIL = 'codegard.team@gmail.com';

export function LandingFooter() {
  return (
    <footer className="lp-foot">
      <div className="wrap">
        <div className="foot-in">
          <div>
            <LandingLogo />
            <p className="foot-tag">
              Problems to solve, contests to enter, a rating to climb.
            </p>
          </div>
          <div className="foot-cols">
            {/* Everything inside the product needs an account, so the footer
                points at this page's own sections instead of dead ends. */}
            <div className="foot-col">
              <span className="h">This page</span>
              <a href="#top">Home</a>
              <a href="#contests">Contests</a>
              <a href="#how">How it works</a>
              <a href="#solo">Solo</a>
              <a href="#rating">Rating</a>
              <a href="#judge">Under the hood</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="foot-col">
              <span className="h">Account</span>
              <a href="/login">Sign in</a>
              <a href="/register">Create account</a>
            </div>
            <div className="foot-col">
              <span className="h">Legal</span>
              <a href="/privacy">Privacy policy</a>
            </div>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 Codegard</span>
          <span className="sp">
            <a href="/privacy">Privacy policy</a>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
