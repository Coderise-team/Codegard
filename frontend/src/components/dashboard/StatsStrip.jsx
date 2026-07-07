import Icons from '../Icons';
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
 * StatsStrip — 3-up row of quick stat cards for the given user. The caller
 * owns "whose data" (Dashboard passes the signed-in user, the profile passes
 * the viewed one). Shows "—" until the stats load (and on error).
 */
export default function StatsStrip({ username }) {
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
