import { Link } from 'react-router-dom';
import './PrivacyPage.css';

// Public, auth-free page: a Google verification reviewer must be able to read it
// while signed out, so it renders standalone (no Sidebar/Navbar app shell).

const CONTACT_EMAIL = 'codegard.team@gmail.com';
const LAST_UPDATED = 'August 6, 2026';

export default function PrivacyPage() {
  return (
    <div className="privacy">
      <header className="privacy-top">
        <Link to="/" className="privacy-brand">
          Codegard
        </Link>
      </header>

      <main className="privacy-doc">
        <h1>Privacy Policy</h1>
        <p className="privacy-updated">Last updated: {LAST_UPDATED}</p>

        <p>
          Codegard (&quot;Codegard&quot;, &quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;) is a competitive programming platform operated by the
          Coderise team. This Privacy Policy explains what personal data we
          collect, why we collect it, how we use and store it, and the rights
          you have over your data.
        </p>
        <p>
          If you have any questions about this policy or your data, contact us
          at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>1. Who we are</h2>
        <p>
          Codegard is an online platform where users solve programming problems,
          take part in contests, and track their rating. The service is
          developed and operated by the Coderise team. We are the party
          responsible for the personal data described in this policy (the
          &quot;data controller&quot;).
        </p>

        <h2>2. What data we collect</h2>
        <p>
          <strong>Account data (when you register directly):</strong>
        </p>
        <ul>
          <li>Email address</li>
          <li>Username</li>
          <li>Avatar image (optional, if you upload one)</li>
        </ul>
        <p>
          <strong>Data from Google Sign-In</strong> (scopes: <code>openid</code>
          , <code>email</code>, <code>profile</code>):
        </p>
        <ul>
          <li>Your Google email address</li>
          <li>Your name</li>
          <li>Your Google profile picture</li>
        </ul>
        <p>
          <strong>Data from GitHub Sign-In</strong> (scopes:{' '}
          <code>read:user</code>, <code>user:email</code>):
        </p>
        <ul>
          <li>Your GitHub public profile information</li>
          <li>Your GitHub email address</li>
        </ul>
        <p>
          We use this information only to create and sign you into your Codegard
          account and to show your profile. We do not request any other data
          from Google or GitHub.
        </p>
        <p>
          <strong>Data created while you use Codegard:</strong>
        </p>
        <ul>
          <li>Your problem submissions and their results</li>
          <li>Your rating and rating history</li>
          <li>Your contest participation and history</li>
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
          We do not collect phone numbers, postal addresses, payment
          information, or any other data not listed above.
        </p>

        <h2>3. How we use your data</h2>
        <p>We use your data only to run the service:</p>
        <ul>
          <li>create and manage your account</li>
          <li>sign you in (including via Google or GitHub)</li>
          <li>display your public profile, rating, and history</li>
          <li>run and grade your problem submissions</li>
          <li>calculate contest results and ratings</li>
          <li>keep the service secure and diagnose technical problems</li>
        </ul>
        <p>
          We do <strong>not</strong> use your data for advertising, and we do{' '}
          <strong>not</strong> sell it.
        </p>

        <h2>4. Google user data and Limited Use</h2>
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
            We use Google user data (email, name, profile picture){' '}
            <strong>only</strong> to create your account, sign you in, and
            display your profile.
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

        <h2>5. Who we share data with</h2>
        <p>
          We do <strong>not</strong> sell your data and we do{' '}
          <strong>not</strong> share it with anyone for advertising. Your data
          passes through the following service providers, only to run the
          service:
        </p>
        <ul>
          <li>
            <strong>Google</strong> and <strong>GitHub</strong> — used solely
            for sign-in, when you choose them.
          </li>
          <li>
            <strong>Cloudflare</strong> — delivers our website and protects it
            from abuse.
          </li>
          <li>
            <strong>Cloudflare R2</strong> — stores your avatar image.
          </li>
        </ul>
        <p>
          We may also disclose data if required by law, or to protect the
          rights, safety, and integrity of Codegard and its users.
        </p>

        <h2>6. Public information</h2>
        <p>
          Some information is visible to other users by design: your username,
          avatar, rating, and contest results appear on public profiles and
          leaderboards. Do not put private information in fields that are shown
          publicly.
        </p>

        <h2>7. How long we keep data and how to delete your account</h2>
        <p>
          We keep your personal data for as long as your account exists. If you
          delete your account, we delete your personal data (including your
          avatar) from our systems, except where we must keep certain data to
          comply with the law or to resolve disputes. Residual copies may remain
          in encrypted backups for a limited time before they are overwritten.
        </p>
        <p>
          To delete your account or your data, use your account settings or
          contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>8. Cookies and local storage</h2>
        <p>
          We use cookies and browser local storage only to keep you signed in —
          they store your authentication tokens. We do <strong>not</strong> use
          advertising or third-party tracking cookies. If you clear this data or
          block it in your browser, you will be signed out.
        </p>

        <h2>9. Your rights</h2>
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
          comply with applicable data protection laws, including the GDPR for
          users in the European Economic Area.
        </p>

        <h2>10. Data storage and international transfers</h2>
        <p>
          Your data may be stored and processed on servers operated by our
          infrastructure providers (such as Cloudflare), which may be located
          outside your country. Where required by law, we ensure appropriate
          safeguards are in place for such transfers.
        </p>

        <h2>11. Security</h2>
        <p>
          We take reasonable measures to protect your data. However, no method
          of transmission or storage over the Internet is completely secure, so
          we cannot guarantee absolute security.
        </p>

        <h2>12. Children</h2>
        <p>
          Codegard is intended for users aged <strong>13 and older</strong>. We
          do not knowingly collect personal data from children under 13. Where
          local law sets a higher age of digital consent, users below that age
          should use Codegard only with the consent of a parent or guardian. If
          you believe a child under 13 has provided us data, contact us and we
          will remove it.
        </p>

        <h2>13. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the
          new version on this page and update the &quot;Last updated&quot; date
          above. Significant changes will be announced within the service.
          Continued use of Codegard after a change means you accept the updated
          policy.
        </p>

        <h2>14. Contact us</h2>
        <p>
          For any questions or requests about this Privacy Policy or your data,
          email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </main>
    </div>
  );
}
