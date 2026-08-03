import { useState } from 'react';

// Fallback badge: first two letters of the username.
const initialsOf = (username) => (username ?? '').slice(0, 2).toUpperCase();

/**
 * Avatar — the user's picture, with initials as the fallback.
 *
 * The initials are always drawn underneath and the picture is laid over them,
 * so a slow load shows the badge instead of an empty square, and a missing or
 * broken file simply leaves the badge visible.
 *
 * The box class stays with the caller: size, radius and colour belong to the
 * place the avatar is used (topbar, leaderboard row, profile banner), not here.
 *
 * Props:
 *   src       — thumbnail URL from the API, or null when there is no avatar
 *   username  — source of the initials
 *   className — the caller's avatar box class (.avatar, .pavatar, .st-av, ...)
 *   children  — extras drawn on top of the box (the owner's camera button)
 */
export default function Avatar({
  src,
  username,
  className = 'avatar',
  children,
}) {
  // Remember WHICH url failed rather than just that one did: uploading a new
  // avatar yields a new url, and that one deserves its own attempt instead of
  // inheriting the previous failure.
  const [failedSrc, setFailedSrc] = useState(null);
  const showPicture = Boolean(src) && failedSrc !== src;

  return (
    <div className={`${className} avatar-box`}>
      {/* Hidden from screen readers: every place that draws an avatar prints
          the username right next to it, so the badge is decoration. */}
      <span aria-hidden="true">{initialsOf(username)}</span>
      {showPicture && (
        <img
          className="avatar-img"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
        />
      )}
      {children}
    </div>
  );
}
