import { Link } from 'react-router-dom';
import Icons from '../Icons';
import UserMenu from '../layout/UserMenu';
import { contestState } from '../../hooks/useContest';
import { indexToLetter } from '../../utils/contestLetters';
import { fmtCountdown } from '../../utils/time';
import './ContestTopbar.css';

/**
 * ContestTopbar — workspace top bar for solving inside a contest.
 *
 * Replaces the SoloTopbar chrome with contest context: a link back to the
 * round (its standings), the A/B/C problem strip for jumping between tasks,
 * and the round countdown.
 *
 * Props:
 *   contest       — the round { id, title, end_time, problems: [{ id }] }
 *   currentLetter — the letter of the problem on screen (uppercased match)
 *   now           — ticking clock in ms, kept in the page's state (the React
 *                   Compiler caches a render-time Date.now(), so live time has
 *                   to arrive as a prop)
 *   user          — { username, initials } for the user menu
 *   showLeaderboard    — whether the standings rail is open (lights the toggle)
 *   onToggleLeaderboard — show/hide the standings rail
 *   onMenuClick   — open the sidebar drawer (burger button)
 */
export default function ContestTopbar({
  contest,
  currentLetter,
  now,
  user,
  statuses = {},
  showLeaderboard,
  onToggleLeaderboard,
  onMenuClick,
}) {
  const active = (currentLetter ?? '').toUpperCase();
  const state = contestState(contest, now);
  const secondsLeft = Math.max(
    0,
    Math.floor((new Date(contest.end_time).getTime() - now) / 1000)
  );
  // Under five minutes the clock turns red — the round is closing.
  const urgent = state === 'live' && secondsLeft < 5 * 60;

  return (
    <header className="ct-topbar">
      <div className="ct-left">
        <button className="icon-btn" title="Menu" onClick={onMenuClick}>
          <Icons.menu size={18} />
        </button>
        <Link to="/" className="logo">
          <span className="mark">C</span>
          <span>
            <span className="wm-a">Code</span>
            <span className="wm-b">gard</span>
          </span>
        </Link>
        <div className="ct-div" />
        <Link
          to={`/contests/${contest.id}`}
          className="ct-back"
          title={contest.title}
        >
          <Icons.trophy size={15} />
          <span className="ct-back-title">{contest.title}</span>
        </Link>
      </div>

      <div className="ct-strip">
        {contest.problems.map((p, i) => {
          const label = indexToLetter(i);
          const st = statuses[p.id] || 'open';
          return (
            <Link
              key={p.id}
              to={`/contests/${contest.id}/problems/${label}`}
              className={`ct-pip s-${st}${label === active ? ' current' : ''}`}
              aria-current={label === active ? 'page' : undefined}
              title={p.title}
            >
              <span className="ct-pip-dot" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="ct-right">
        <div
          className={`ct-timer${urgent ? ' urgent' : ''}${
            state === 'finished' ? ' done' : ''
          }`}
        >
          {state !== 'finished' && <span className="ct-timer-pulse" />}
          <div className="ct-timer-body">
            <span className="ct-timer-lbl">
              {state === 'finished' ? 'Round' : 'Ends in'}
            </span>
            <span className="ct-timer-val">
              {state === 'finished' ? 'Finished' : fmtCountdown(secondsLeft)}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={`ct-lb-toggle${showLeaderboard ? ' is-on' : ''}`}
          onClick={onToggleLeaderboard}
          aria-pressed={showLeaderboard}
        >
          <Icons.trophy size={16} />
          {showLeaderboard ? 'Hide leaderboard' : 'Show leaderboard'}
        </button>

        <UserMenu user={user} />
      </div>
    </header>
  );
}
