import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Navbar from '../components/layout/Navbar';
import Icons from '../components/Icons';
import ContestBanner from '../components/contests/ContestBanner';
import ContestAside from '../components/contests/ContestAside';
import { useCurrentUser } from '../hooks/useCurrentUser';
import contestData from '../data/contestData';
import './ContestPage.css';

/**
 * ContestPage — a single-contest event page (compact density, violet accent).
 *
 * The main stage is one full-bleed violet gradient banner: badge, title,
 * meta, live/soon/finished countdown, a primary CTA, and the A–E problem
 * strip. A collapsible right aside shows registrants (upcoming) or the
 * standings (live / finished).
 *
 * 1:1 port of the mock on baked-in data (src/data/contestData.js); the API
 * wiring comes in a later step. Until then the state is picked with a
 * temporary ?state=soon|live|finished query switch.
 */
export default function ContestPage() {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const state = searchParams.get('state') || 'soon';

  const data = contestData;
  const [showPanel, setShowPanel] = useState(true);
  const [remaining, setRemaining] = useState(data.contest.remaining);
  const [startsIn, setStartsIn] = useState(data.contest.startsIn);
  const [registered, setRegistered] = useState(false);

  // 1s tick — drives the banner countdown
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((s) => (s > 0 ? s - 1 : 0));
      setStartsIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = state === 'live' ? remaining : startsIn;

  const crumb = (
    <span className="cp-crumb">
      <Icons.trophy size={16} />
      <span className="dim">Contests&nbsp;/</span> {data.contest.name}
    </span>
  );

  return (
    <div className="dash" data-density="compact">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <Navbar
          user={user}
          title={crumb}
          onMenuClick={() => setNavOpen(true)}
        />

        <div className="cp-stage">
          <ContestBanner
            D={data}
            state={state}
            seconds={seconds}
            registered={registered}
            onRegister={() => setRegistered(true)}
          />
          <ContestAside
            D={data}
            state={state}
            open={showPanel}
            onToggle={() => setShowPanel((v) => !v)}
          />
        </div>
      </div>
    </div>
  );
}
