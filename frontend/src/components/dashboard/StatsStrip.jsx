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
 * StatsStrip — row of quick stat cards for the given user. The caller owns
 * "whose data" (Dashboard passes the signed-in user, the profile the viewed
 * one). `extraStats` appends pre-formatted cards ({ key, label, icon, value })
 * after the three core stats — the profile uses it for Max streak.
 * Shows "—" until the stats load (and on error).
 */
export default function StatsStrip({ username, extraStats = [] }) {
  const { data } = useUserStats(username);

  const stats = [
    ...STATS.map(({ key, label, icon, format }) => ({
      key,
      label,
      icon,
      value: data ? format(data[key]) : '—',
    })),
    ...extraStats,
  ];

  return (
    <div className="stats3">
      {stats.map(({ key, label, icon, value }) => {
        const Icon = Icons[icon];
        return (
          <div className="stat" key={key}>
            <div className="si">
              <Icon size={18} />
            </div>
            <div>
              <div className="sv">{value}</div>
              <div className="sk">{label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
