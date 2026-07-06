import { useState } from 'react';
import Icons from '../Icons';

/**
 * ProfileHeader — top banner of the viewed profile: avatar, handle, rank,
 * meta row, rating/peak readout, and follow / share actions.
 *
 * Props:
 *   data — profile object ({ user: { handle, initials, rating, maxRating, … } })
 */
export default function ProfileHeader({ data }) {
  const I = Icons;
  const u = data.user;
  const up = u.delta >= 0;

  const [following, setFollowing] = useState(false);
  const [copied, setCopied] = useState(false);

  const onShare = () => {
    setCopied(true);
    try {
      navigator.clipboard &&
        navigator.clipboard.writeText(`https://codegard.io/u/${u.handle}`);
    } catch {
      /* clipboard unavailable */
    }
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="phead">
      <div className="phead-main">
        <div className="pavatar">
          {u.initials}
          {u.online && <span className="dot" title="Online now"></span>}
        </div>

        <div className="phead-id">
          <div className="top">
            <span className="handle">{u.handle}</span>
            <span className="rank-chip">
              <span className="rdot"></span> {u.rank.name}
            </span>
          </div>
          <div className="sub">
            <span className="s">
              <I.trophy size={14} /> Global rank{' '}
              <b>#{u.globalRank.toLocaleString('en-US')}</b>
            </span>
            <span className="sep"></span>
            <span className="s">
              <I.calendar size={14} /> Joined <b>{u.joined}</b>
            </span>
            <span className="sep"></span>
            <span className="s">
              {u.online ? (
                <span style={{ color: 'var(--ac)', fontWeight: 700 }}>
                  ● online now
                </span>
              ) : (
                <>
                  Active <b>{u.lastActive}</b>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="phead-rate">
          <div className="rblock">
            <div className="k">Rating</div>
            <div className="v cur">{u.rating}</div>
            <div className={`pdelta ${up ? 'up' : 'down'}`}>
              {up ? <I.arrowUp size={11} /> : <I.arrowDown size={11} />}
              {up ? '+' : ''}
              {u.delta} last
            </div>
          </div>
          <div className="rblock">
            <div className="k">Peak</div>
            <div className="v" style={{ color: 'var(--fg)' }}>
              {u.maxRating}
            </div>
            <div className="pdelta" style={{ color: 'var(--fg2)' }}>
              {u.maxRank.name}
            </div>
          </div>
        </div>

        <div className="phead-act">
          <button
            className={`follow-btn${following ? ' following' : ''}`}
            onClick={() => setFollowing((v) => !v)}
          >
            {following ? (
              <>
                <I.checkBold size={15} className="lbl-base" />
                <span className="lbl-base">Following</span>
                <span className="lbl-hover">Unfollow</span>
              </>
            ) : (
              <>
                <I.plus size={15} /> Follow
              </>
            )}
          </button>
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
    </section>
  );
}
