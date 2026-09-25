import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import './TermsPage.css';

// Public, auth-free page, for the same reason the privacy policy is one: terms
// count as shown only if they can be read before an account exists, so this
// renders standalone (no Sidebar/Navbar app shell).

const CONTACT_EMAIL = 'codegard.team@gmail.com';
const LAST_UPDATED = 'September 25, 2026';

// Section id → table-of-contents label. The order here is the order on the page.
const SECTIONS = [
  ['who-we-are', 'Who we are'],
  ['acceptance', 'Accepting these terms'],
  ['eligibility', 'Who can use Codegard'],
  ['account', 'Your account'],
  ['fair-play', 'Fair play'],
  ['prohibited', 'What you must not do'],
  ['your-code', 'Your code'],
  ['verdicts', 'Verdicts, results and ratings'],
  ['availability', 'Availability of the service'],
  ['suspension', 'Suspension and closing an account'],
  ['changes', 'Changes to these terms'],
  ['contact', 'Contact us'],
];

export default function TermsPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Terms of Service — Codegard';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="terms scroll">
      <header className="terms-top">
        <Link to="/" className="logo">
          <BrandMark className="mark" />
          <span>
            <span className="wm-a">Code</span>
            <span className="wm-b">gard</span>
          </span>
        </Link>
      </header>

      <main className="terms-doc">
        <h1>Terms of Service</h1>
        <p className="terms-updated">Last updated: {LAST_UPDATED}</p>

        <p>
          These terms govern your use of Codegard. They describe what you can
          expect from the platform, what we expect from you, and what happens
          when those expectations are not met.
        </p>
        <p>
          If anything here is unclear, write to us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <nav className="terms-toc" aria-label="Table of contents">
          <ol>
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <h2 id="who-we-are">Who we are</h2>
        <p>
          Codegard is an online competitive programming platform: you solve
          algorithmic problems, your code is run and graded automatically, and
          you can take part in timed contests that feed a rating.
        </p>
        <p>
          Codegard is a non-commercial project built and run by the Coderise
          team. Writing to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> reaches the
          people who operate the service.
        </p>

        <h2 id="acceptance">Accepting these terms</h2>
        <p>
          By creating an account or using Codegard you accept these terms. If
          you do not accept them, do not use the platform.
        </p>
        <p>
          These terms cover the service itself. What personal data we collect
          and what we do with it is a separate matter, described in our{' '}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <h2 id="eligibility">Who can use Codegard</h2>
        <p>
          Codegard is intended for people aged <strong>13 and older</strong>,
          the same threshold our Privacy Policy sets. Where local law sets a
          higher age of digital consent, use Codegard below that age only with
          the consent of a parent or guardian.
        </p>

        <h2 id="account">Your account</h2>
        <ul>
          <li>
            <strong>One account per person.</strong> Ratings and contest
            standings are built on the assumption that one account is one
            competitor; extra accounts distort them for everyone.
          </li>
          <li>
            <strong>Your account is yours to look after.</strong> You are
            responsible for what happens under it. Do not share your password
            and do not let anyone else submit in your name.
          </li>
          <li>
            <strong>Your username is fixed once chosen.</strong> Profiles,
            contest standings and submission history are all addressed by it.
          </li>
          <li>
            <strong>Your email address must be your own</strong> and must work —
            it is the only way we can reach you.
          </li>
        </ul>

        <h2 id="fair-play">Fair play</h2>
        <p>
          Contests are rated, and a rating is only worth something if the
          results behind it are.
        </p>
        <ul>
          <li>
            Solve problems yourself. Submitting someone else&apos;s solution as
            your own is the one thing that empties a rating of meaning.
          </li>
          <li>
            During a live contest, do not share problems, solutions or hints
            with anyone, and do not seek them from anyone.
          </li>
          <li>
            Do not compete from more than one account, and do not let anyone
            else compete as you.
          </li>
          <li>Do not arrange results between participants.</li>
        </ul>

        <h2 id="prohibited">What you must not do</h2>
        <p>
          Your code runs on our machines, so this section is not decorative.
        </p>
        <ul>
          <li>
            Do not try to break out of the sandbox your submission runs in,
            reach the network from it, or read anything on the host.
          </li>
          <li>
            Do not attack or overload the platform, and do not scan it for
            weaknesses. This includes working around the request limits we set,
            and sending automated traffic the interface does not itself produce.
            If you do find a security problem, write to us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> instead of
            using it.
          </li>
          <li>
            Do not try to reach other people&apos;s accounts, submissions or
            data.
          </li>
          <li>
            Do not put anything in your profile — display name, bio, avatar —
            that is unlawful, abusive, or not yours to publish.
          </li>
          <li>
            Do not use the problem-report form for anything other than reporting
            a problem.
          </li>
        </ul>

        <h2 id="your-code">Your code</h2>
        <p>
          The solutions you submit stay yours. By submitting them you give us
          permission to store them and to run them in our sandbox in order to
          grade them, to show you your own submission history, and to keep the
          record that contest results and ratings were calculated from.
        </p>
        <p>
          We do not show the source code of your solutions to other users. Our
          staff can see it through the administration interface, where it is
          looked at to review reports and investigate abuse.
        </p>
        <p>
          The problems, their tests, and the site itself are ours. Do not
          republish them as your own.
        </p>

        <h2 id="verdicts">Verdicts, results and ratings</h2>
        <p>
          Verdicts are produced automatically: your program is run against the
          tests and its output is compared with the expected answer, with no
          human judgement involved. After a rated contest your rating is
          recalculated automatically from your placing and the ratings of the
          people you competed against.
        </p>
        <p>
          We may correct results and recalculate ratings — for example after a
          faulty test, a problem that had to be fixed, or a breach of the fair
          play rules above. Your rating is a number we maintain, not property
          you own.
        </p>
        <p>
          If you believe a problem or a verdict is wrong, report it from the
          problem page. That is the channel we read.
        </p>

        <h2 id="availability">Availability of the service</h2>
        <p>
          Codegard is provided free of charge and as it is. We do not promise it
          will be available without interruption or free of faults: it can be
          down for maintenance or for reasons outside our control, and features
          can change or be removed.
        </p>
        <p>
          Contests can be postponed, shortened, cancelled or rerun, including
          rounds that have already been announced.
        </p>
        <p>
          Nothing in these terms excludes liability that the law does not allow
          us to exclude.
        </p>

        <h2 id="suspension">Suspension and closing an account</h2>
        <p>
          We may limit or close access to an account that breaks these terms, or
          where doing so is needed to protect the platform and the people using
          it. Depending on what happened, that can also mean removing
          submissions or correcting contest results and ratings.
        </p>
        <p>
          You can stop using Codegard whenever you like. There is no delete
          button yet — write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will
          handle the request by hand.
        </p>

        <h2 id="changes">Changes to these terms</h2>
        <p>
          We may update these terms. The new version goes on this page and the
          &quot;Last updated&quot; date above changes with it. Continuing to use
          Codegard after a change means you accept the updated terms.
        </p>

        <h2 id="contact">Contact us</h2>
        <p>
          For anything about these terms, email us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </main>
    </div>
  );
}
