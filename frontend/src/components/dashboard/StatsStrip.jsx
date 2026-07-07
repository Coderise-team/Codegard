import Icons from '../Icons';
import { useAuthStore } from '../../store/authStore';
import { useUserStats } from '../../hooks/useUserStats';

// Card layout is presentation, not data — labels/icons are fixed here,
// values come from the API.
const STATS = [
  {
    key: 'solved',
    label: 'Solved',
    icon: 'checkBold',
    format: (v) => String(v),
  },
  {
    key: 'contests',
    label: 'Contests',
    icon: 'trophy',
    format: (v) => String(v),
  },
  {
    key: 'acceptance',
    label: 'Acceptance',
    icon: 'target',
    format: (v) => `${v}%`,
  },
];

/**
 * StatsStrip — 3-up row of quick stat cards for a user (the signed-in user by
 * default, or the `username` given when viewing someone else's profile).
 * Shows "—" until the stats load (and on error), never fake numbers.
 */
export default function StatsStrip({ username: usernameProp }) {
  const authUsername = useAuthStore((s) => s.user?.username);
  const username = usernameProp ?? authUsername;
  const { data } = useUserStats(username);

  return (
    <div className="stats3">
      {STATS.map(({ key, label, icon, format }) => {
        const Icon = Icons[icon];
        return (
          <div className="stat" key={key}>
            <div className="si">
              <Icon size={18} />
            </div>
            <div>
              <div className="sv">{data ? format(data[key]) : '—'}</div>
              <div className="sk">{label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
