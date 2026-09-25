import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import './PrivacyPage.css';

// Public, auth-free page: a Google verification reviewer must be able to read it
// while signed out, so it renders standalone (no Sidebar/Navbar app shell).

const CONTACT_EMAIL = 'codegard.team@gmail.com';
const LAST_UPDATED = 'September 25, 2026';

// Section id → table-of-contents label. The order here is the order on the page.
const SECTIONS = [
  ['who-we-are', 'Who we are'],
  ['data-we-collect', 'What data we collect'],
  ['how-we-use', 'How we use your data'],
  ['legal-basis', 'Legal basis for processing'],
  ['google-user-data', 'Google user data and Limited Use'],
  ['sharing', 'Who we share data with'],
  ['visibility', 'What other people can see'],
  ['retention', 'How long we keep data'],
  ['deletion', 'Deleting your account'],
  ['cookies', 'Cookies and local storage'],
  ['automated', 'Automated grading and rating'],
  ['your-rights', 'Your rights'],
  ['transfers', 'Where your data is stored'],
  ['security', 'Security'],
  ['children', 'Children'],
  ['changes', 'Changes to this policy'],
  ['contact', 'Contact us'],
];

export default function PrivacyPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Privacy Policy — Codegard';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="privacy scroll">
      <header className="privacy-top">
        <Link to="/" className="logo">
          <BrandMark className="mark" />
          <span>
            <span className="wm-a">Code</span>
            <span className="wm-b">gard</span>
          </span>
        </Link>
      </header>

      <main className="privacy-doc">
        <h1>Privacy Policy</h1>
        <p className="privacy-updated">Last updated: {LAST_UPDATED}</p>

        <p>
          Codegard (&quot;Codegard&quot;, &quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;) is a competitive programming platform. This Privacy
          Policy explains what personal data we collect, why we collect it, how
          long we keep it, who can see it, and the rights you have over it.
        </p>
        <p>
          If you have any questions about this policy or your data, contact us
          at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <nav className="privacy-toc" aria-label="Table of contents">
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
          Codegard is an online competitive programming platform. Users solve
          algorithmic problems and take part in timed contests; each submission
          is run and graded automatically, and results feed into a rating that
          reflects a user&apos;s performance over time. Profiles, ratings, and
          contest standings are shown to other users.
        </p>
        <p>
          Codegard is a non-commercial project built and run by the Coderise
          team, which is responsible for the personal data described in this
          policy. Writing to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> reaches the
          people who operate the service.
        </p>

        <h2 id="data-we-collect">What data we collect</h2>
        <p>
          <strong>Account data (when you register directly):</strong>
        </p>
        <ul>
          <li>Email address</li>
          <li>Username</li>
          <li>
            Password — stored only as a cryptographic hash, never in readable
            form
          </li>
        </ul>
        <p>
          <strong>Profile details you add yourself</strong> (all optional):
        </p>
        <ul>
          <li>Display name (first and last name)</li>
          <li>A short bio</li>
          <li>An avatar image</li>
        </ul>
        <p>
          <strong>Data from Google Sign-In</strong> (scopes: <code>openid</code>
          , <code>email</code>):
        </p>
        <ul>
          <li>Your Google account identifier</li>
          <li>Your Google email address</li>
        </ul>
        <p>
          We do not ask Google for your name or your profile picture, and we do
          not store them. Your Codegard username is generated from the part of
          your email address before the &quot;@&quot;.
        </p>
        <p>
          <strong>Data from GitHub Sign-In</strong> (scopes:{' '}
          <code>read:user</code>, <code>user:email</code>):
        </p>
        <ul>
          <li>Your GitHub account identifier</li>
          <li>Your verified GitHub email address</li>
        </ul>
        <p>
          Your GitHub login is used once, as a suggestion for your Codegard
          username, and is not stored separately. Nothing else from your GitHub
          profile is kept.
        </p>
        <p>
          <strong>Data created while you use Codegard:</strong>
        </p>
        <ul>
          <li>
            The source code of every solution you submit, together with its
            verdict, run time, and any error output
          </li>
          <li>Your rating and every change to it over time</li>
          <li>The contests you register for and your results in them</li>
          <li>Your daily-challenge streak</li>
          <li>Problem reports you file (the reason and your message)</li>
          <li>Notifications addressed to you</li>
        </ul>
        <p>
          <strong>Technical data (collected automatically):</strong>
        </p>
        <ul>
          <li>IP address</li>
          <li>
            Server logs (access times, requested pages, basic diagnostic data)
          </li>
        </ul>
        <p>
          We do not collect phone numbers, postal addresses, or payment
          information. We run no analytics, no advertising, and no third-party
          tracking of any kind. The one request this site makes to another
          company as you read it is for its fonts — see{' '}
          <a href="#sharing">Who we share data with</a>.
        </p>

        <h2 id="how-we-use">How we use your data</h2>
        <p>We use your data only to run the service:</p>
        <ul>
          <li>create and manage your account</li>
          <li>sign you in (including via Google or GitHub)</li>
          <li>display your profile, rating, and history</li>
          <li>run your submitted code in an isolated sandbox and grade it</li>
          <li>calculate contest results and ratings</li>
          <li>
            send you notifications about contests, new problems, rating and rank
            changes, and the problem reports you filed
          </li>
          <li>
            limit how often certain requests can be made — counted per account
            when you are signed in, and per address when you are not — to
            prevent abuse
          </li>
          <li>keep the service secure and diagnose technical problems</li>
        </ul>
        <p>
          We do <strong>not</strong> use your data for advertising, and we do{' '}
          <strong>not</strong> sell it.
        </p>

        <h2 id="legal-basis">Legal basis for processing</h2>
        <p>
          Where data protection law (such as the GDPR) applies, we rely on the
          following legal bases:
        </p>
        <ul>
          <li>
            <strong>Performance of a service</strong> — to create your account,
            sign you in, run submissions, and provide the platform&apos;s core
            features.
          </li>
          <li>
            <strong>Legitimate interests</strong> — to keep the service secure,
            prevent abuse, and diagnose technical problems.
          </li>
          <li>
            <strong>Consent</strong> — where we ask for it, for example when you
            choose to upload an optional avatar. You can withdraw consent at any
            time.
          </li>
        </ul>

        <h2 id="google-user-data">Google user data and Limited Use</h2>
        <p>
          Our use of information received from Google APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Specifically:
        </p>
        <ul>
          <li>
            We use Google user data (your account identifier and email address){' '}
            <strong>only</strong> to create your account, sign you in, and
            recognise you when you return.
          </li>
          <li>
            We do <strong>not</strong> transfer or sell Google user data to
            third parties, and we do <strong>not</strong> use it for
            advertising.
          </li>
          <li>
            Humans do not read your Google user data, except where necessary for
            security (e.g. investigating abuse) or to comply with applicable
            law.
          </li>
        </ul>
        <p>The same principles apply to information we receive from GitHub.</p>

        <h2 id="sharing">Who we share data with</h2>
        <p>
          We do <strong>not</strong> sell your data and we do{' '}
          <strong>not</strong> share it with anyone for advertising. Your data
          passes through the following service providers, only to run the
          service:
        </p>
        <ul>
          <li>
            <strong>Google</strong> and <strong>GitHub</strong> — used solely
            for sign-in, when you choose them. See the{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Google Privacy Policy
            </a>{' '}
            and the{' '}
            <a
              href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
              target="_blank"
              rel="noreferrer"
            >
              GitHub Privacy Statement
            </a>
            .
          </li>
          <li>
            <strong>Cloudflare</strong> — delivers our website and protects it
            from abuse; all traffic to the site passes through it. See the{' '}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noreferrer"
            >
              Cloudflare Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Cloudflare R2</strong> — stores your avatar files and our
            encrypted database backups.
          </li>
          <li>
            <strong>Our hosting provider</strong> — runs the server that holds
            the application, the database, and the server logs.
          </li>
          <li>
            <strong>Google Fonts</strong> — this site loads its fonts from
            Google servers, so your browser contacts Google and Google can see
            your IP address, even if you never sign in.
          </li>
        </ul>
        <p>
          We may also disclose data if required by law, or to protect the
          rights, safety, and integrity of Codegard and its users.
        </p>

        <h2 id="visibility">What other people can see</h2>
        <p>
          Codegard is a competitive platform, so some information is shown to
          others by design. This is exactly who sees what.
        </p>
        <p>
          <strong>Visible to anyone, without a Codegard account:</strong>
        </p>
        <ul>
          <li>the problem catalog and the contests</li>
          <li>
            contest standings and the list of people registered for a contest —
            username and rating
          </li>
          <li>
            avatar images: they are served from a public address, so anyone who
            has the link can open the file
          </li>
        </ul>
        <p>
          <strong>Visible to any signed-in user:</strong>
        </p>
        <ul>
          <li>
            your profile — username, display name, bio, avatar, current and peak
            rating, your place in the global standings, and the date you joined
          </li>
          <li>the global standings</li>
          <li>
            your rating history, your daily-challenge streak, your overall
            acceptance rate, and how many contests you have entered
          </li>
          <li>
            your solved-by-difficulty breakdown, your activity calendar, and
            your contest history
          </li>
          <li>
            the list of your submissions, with the problem, the verdict, the run
            time, and when you sent it
          </li>
        </ul>
        <p>
          <strong>Never shown to other users:</strong>
        </p>
        <ul>
          <li>the source code of your solutions</li>
          <li>your email address</li>
          <li>the problem reports you file</li>
        </ul>
        <p>
          <strong>Visible to our staff,</strong> through the administration
          interface: accounts, submissions including their source code, the
          problem reports people file together with the username of whoever
          filed them, and the notifications that were sent. We look at this to
          review reports and to investigate abuse.
        </p>
        <p>
          Do not put private information in fields that are shown to other
          users.
        </p>

        <h2 id="retention">How long we keep data</h2>
        <ul>
          <li>
            <strong>Your account and profile</strong> — for as long as the
            account exists.
          </li>
          <li>
            <strong>
              Submissions and their source code, rating history, contest results
            </strong>{' '}
            — kept indefinitely. They are the record the platform is built on,
            and other people&apos;s standings were calculated against them. If
            you ask us to delete your account, the source code goes and the
            records stay without your name — see{' '}
            <a href="#deletion">Deleting your account</a>.
          </li>
          <li>
            <strong>Notifications</strong> — 30 days after you have seen one, 90
            days if you never do.
          </li>
          <li>
            <strong>Sign-in tokens</strong> — a refresh token lasts 7 days;
            expired ones are purged nightly.
          </li>
          <li>
            <strong>Server logs</strong> — rotated by size rather than on a
            schedule, so there is no fixed period after which an IP address
            disappears from them.
          </li>
          <li>
            <strong>Backups</strong> — encrypted snapshots of the database: a
            full one every week and an incremental one every day. We keep seven
            daily and two weekly copies, so the oldest of them is about two
            weeks old.
          </li>
        </ul>

        <h2 id="deletion">Deleting your account</h2>
        <p>
          There is no delete button in Codegard yet. Write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will
          handle the request by hand.
        </p>
        <p>
          <strong>What we remove:</strong> your email address, display name,
          bio, avatar files, the link between your account and your Google or
          GitHub identity, and the source code of your submissions.
        </p>
        <p>
          <strong>What stays, with your personal details detached:</strong> your
          participation itself. Contest results and submission records remain,
          because other people&apos;s standings and ratings were calculated
          against them, and removing them would rewrite the history of rounds
          other people took part in. Problem reports you filed also remain,
          without your name, because they document something that was wrong with
          a problem.
        </p>
        <p>
          Two things outlive the request by their nature: your data stays in our
          backups for up to about two weeks, until those copies age out, and in
          the server logs until they rotate.
        </p>

        <h2 id="cookies">Cookies and local storage</h2>
        <p>
          We do not use advertising or third-party tracking cookies, and we run
          no analytics.
        </p>
        <p>
          To keep you signed in, your browser&apos;s local storage holds two
          tokens: a short-lived access token (about 15 minutes) and a refresh
          token (7 days). The refresh token is replaced every time it is used,
          and the previous one immediately stops working. These are not cookies.
          Your browser&apos;s session storage briefly holds the page you were on
          before a Google or GitHub sign-in, so that you return to it.
        </p>
        <p>
          Cloudflare may set technical cookies (not used for tracking) needed to
          deliver the site and protect it from abuse. Our administration
          interface, which only staff can reach, uses session cookies.
        </p>
        <p>
          If you clear this data or block it in your browser, you will be signed
          out.
        </p>

        <h2 id="automated">Automated grading and rating</h2>
        <p>
          Your submission is run automatically and its output is compared with
          the expected answer, ignoring whitespace at the ends of lines; no
          human judgement goes into the verdict. After a rated contest, your
          rating is recalculated automatically from your placing and the ratings
          of the people you competed against.
        </p>
        <p>
          These automated steps decide your verdict and your place on the
          platform and nothing else — they have no legal or similarly
          significant effect on you. If you believe a verdict or a problem is
          wrong, you can report it from the problem page.
        </p>

        <h2 id="your-rights">Your rights</h2>
        <p>Depending on where you live, you may have the right to:</p>
        <ul>
          <li>access the personal data we hold about you</li>
          <li>correct inaccurate data</li>
          <li>delete your data</li>
          <li>object to or restrict certain processing</li>
          <li>receive a copy of your data</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We aim to
          respond within one month. We aim to comply with applicable data
          protection laws, including the GDPR for users in the European Economic
          Area. If you are in the EEA or the UK, you also have the right to
          lodge a complaint with your local data protection supervisory
          authority.
        </p>

        <h2 id="transfers">Where your data is stored</h2>
        <p>
          The server that runs Codegard — the application, the database, and the
          server logs — is in a datacenter in Austria, in the European Union.
        </p>
        <p>
          Avatar files and encrypted database backups are stored in Cloudflare
          R2. Its bucket region is set to automatic, which means Cloudflare
          chooses where those files sit, and they may be stored outside the
          European Economic Area. Cloudflare also delivers the site from
          locations worldwide by design.
        </p>
        <p>
          Where data leaves the EEA, we rely on the safeguards those providers
          put in place, such as the European Commission&apos;s standard
          contractual clauses.
        </p>

        <h2 id="security">Security</h2>
        <p>
          We take reasonable measures to protect your data: it is transmitted
          over encrypted HTTPS connections, and passwords are stored only in
          hashed form. In addition:
        </p>
        <ul>
          <li>
            Submitted code runs in a container with no network access, a
            read-only file system, and as an unprivileged user; the container is
            destroyed after every run.
          </li>
          <li>
            Avatar images are re-encoded when you upload them, which strips the
            metadata a camera embeds — including any GPS location.
          </li>
          <li>Database backups are encrypted.</li>
          <li>
            The source code of your solutions is never shown to other users.
          </li>
        </ul>
        <p>
          However, no method of transmission or storage over the Internet is
          completely secure, so we cannot guarantee absolute security.
        </p>

        <h2 id="children">Children</h2>
        <p>
          Codegard is intended for users aged <strong>13 and older</strong>. We
          do not knowingly collect personal data from children under 13. Where
          local law sets a higher age of digital consent, users below that age
          should use Codegard only with the consent of a parent or guardian. If
          you believe a child under 13 has provided us data, contact us and we
          will remove it.
        </p>

        <h2 id="changes">Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the
          new version on this page and update the &quot;Last updated&quot; date
          above. Continued use of Codegard after a change means you accept the
          updated policy.
        </p>

        <h2 id="contact">Contact us</h2>
        <p>
          For any questions or requests about this Privacy Policy or your data,
          email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </main>
    </div>
  );
}
