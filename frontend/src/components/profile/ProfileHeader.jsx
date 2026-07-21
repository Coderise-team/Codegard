import { useState } from 'react';
import Icons from '../Icons';
import AvatarUpload from './AvatarUpload';
import SettingsModal from './SettingsModal';
import { cgRankFor } from '../../utils/ranks';

/**
 * ProfileHeader — top banner of the viewed profile: avatar, handle, rank,
 * meta row, rating/peak readout and a copy-link (share) action.
 *
 * Full name and bio are optional: both are left out entirely when empty rather
 * than shown as blank slots.
 *
 * Props:
 *   user    — public user object (username, first_name, last_name, bio,
 *             elo_rating, rank, maxRating, globalRank, joined)
 *   delta   — rating change on the latest contest, or null when unknown
 *   isOwner — viewer owns this profile: adds the editing controls
 *   onSaved — the owner saved an edit, so the profile should be reloaded
 */
export default function ProfileHeader({ user, delta, isOwner = false, onSaved }) {
  const I = Icons;
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const initials = user.username.slice(0, 2).toUpperCase();
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const joined = new Date(user.joined).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
  const maxRank = cgRankFor(user.maxRating ?? user.elo_rating).name;
  const up = (delta ?? 0) >= 0;

  const onShare = () => {
    setCopied(true);
    try {
      navigator.clipboard?.writeText(
        `${window.location.origin}/users/${user.username}`
      );
    } catch {
      /* clipboard unavailable */
    }
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="phead">
      <div className="phead-main">
        <div className="pavatar">
          {initials}
          {isOwner && <AvatarUpload />}
        </div>

        <div className="phead-id">
          <div className="top">
            <span className="handle">{user.username}</span>
            <span className="rank-chip">
              <span className="rdot"></span> {user.rank}
            </span>
          </div>
          {fullName && <div className="pname">{fullName}</div>}
          <div className="sub">
            <span className="s">
              <I.trophy size={14} /> Global rank{' '}
              <b>#{user.globalRank.toLocaleString('en-US')}</b>
            </span>
            <span className="sep"></span>
            <span className="s">
              <I.calendar size={14} /> Joined <b>{joined}</b>
            </span>
          </div>
        </div>

        <div className="phead-rate">
          <div className="rblock">
            <div className="k">Rating</div>
            <div className="v cur">{user.elo_rating}</div>
            {delta != null && (
              <div className={`pdelta ${up ? 'up' : 'down'}`}>
                {up ? <I.arrowUp size={11} /> : <I.arrowDown size={11} />}
                {up ? '+' : ''}
                {delta} last
              </div>
            )}
          </div>
          <div className="rblock">
            <div className="k">Peak</div>
            <div className="v" style={{ color: 'var(--fg)' }}>
              {user.maxRating ?? '—'}
            </div>
            <div className="pdelta" style={{ color: 'var(--fg2)' }}>
              {maxRank}
            </div>
          </div>
        </div>

        <div className="phead-act">
          {isOwner && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSettingsOpen(true)}
            >
              <I.edit size={14} /> Edit profile
            </button>
          )}
          <button
            className="icon-act"
            title="Copy profile link"
            onClick={onShare}
          >
            <I.link size={17} />
            {copied && <span className="copied-pop">Link copied</span>}
          </button>
        </div>
      </div>

      {user.bio && <p className="pbio">{user.bio}</p>}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={onSaved}
      />
    </section>
  );
}
