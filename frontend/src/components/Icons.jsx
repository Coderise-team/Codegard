// Codegard — all project icons
// Usage: import Icons from '../Icons'
//   <Icons.clock size={16} />
//   const { clock: ClockIcon } = Icons

const Ic = ({ d, size = 16, sw = 1.75, fill = 'none', style, ...p }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', ...style }}
    {...p}
  >
    {d}
  </svg>
);

const Icons = {
  // ── General ──────────────────────────────────────────────────
  clock: (p) => (
    <Ic
      {...p}
      d={
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      }
    />
  ),
  copy: (p) => (
    <Ic
      {...p}
      d={
        <>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h8" />
        </>
      }
    />
  ),
  check: (p) => <Ic {...p} d={<path d="M20 6 9 17l-5-5" />} />,
  checkBold: (p) => <Ic {...p} sw={2.4} d={<path d="M20 6 9 17l-5-5" />} />,
  x: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </>
      }
    />
  ),
  xBold: (p) => (
    <Ic
      {...p}
      sw={2.4}
      d={
        <>
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </>
      }
    />
  ),
  play: (p) => (
    <Ic {...p} fill="currentColor" sw={0} d={<path d="M7 5.5v13l11-6.5z" />} />
  ),
  send: (p) => <Ic {...p} d={<path d="M5 12h14M13 6l6 6-6 6" />} />,
  bolt: (p) => (
    <Ic
      {...p}
      fill="currentColor"
      sw={0}
      d={<path d="M13 2 4 14h6l-1 8 9-12h-6z" />}
    />
  ),
  trophy: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
          <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
          <path d="M10 14h4M9 20h6M12 14v6" />
        </>
      }
    />
  ),
  list: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M8 6h12M8 12h12M8 18h12" />
          <circle cx="4" cy="6" r="1" />
          <circle cx="4" cy="12" r="1" />
          <circle cx="4" cy="18" r="1" />
        </>
      }
    />
  ),
  menu: (p) => <Ic {...p} d={<path d="M4 6h16M4 12h16M4 18h16" />} />,
  doc: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </>
      }
    />
  ),
  terminal: (p) => (
    <Ic
      {...p}
      d={
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 9l3 3-3 3M13 15h4" />
        </>
      }
    />
  ),
  settings: (p) => (
    <Ic
      {...p}
      d={
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </>
      }
    />
  ),
  reset: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </>
      }
    />
  ),
  maximize: (p) => (
    <Ic
      {...p}
      d={
        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
      }
    />
  ),
  panel: (p) => (
    <Ic
      {...p}
      d={
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 14h18" />
        </>
      }
    />
  ),
  chevDown: (p) => <Ic {...p} d={<path d="M6 9l6 6 6-6" />} />,
  chevRight: (p) => <Ic {...p} d={<path d="M9 6l6 6-6 6" />} />,
  bell: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </>
      }
    />
  ),
  flag: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <path d="M4 22V4" />
        </>
      }
    />
  ),
  cpu: (p) => (
    <Ic
      {...p}
      d={
        <>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
        </>
      }
    />
  ),
  lock: (p) => (
    <Ic
      {...p}
      d={
        <>
          <rect x="4.5" y="11" width="15" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      }
    />
  ),

  // ── Dashboard ──────────────────────────────────────────────
  search: (p) => (
    <Ic
      {...p}
      d={
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </>
      }
    />
  ),
  home: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </>
      }
    />
  ),
  grid: (p) => (
    <Ic
      {...p}
      d={
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      }
    />
  ),
  flame: (p) => (
    <Ic
      {...p}
      d={
        <path d="M12 3c1 3-1 4-2 6-1 1.7-.4 4 2 4 2.2 0 3-1.6 3-3 1.4 1 2 2.6 2 4a5 5 0 0 1-10 0c0-3 2-4.5 2-7 0-2 1.5-3.2 3-4z" />
      }
    />
  ),
  calendar: (p) => (
    <Ic
      {...p}
      d={
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" />
        </>
      }
    />
  ),
  users: (p) => (
    <Ic
      {...p}
      d={
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17 20a5.5 5.5 0 0 0-2.5-4.6" />
        </>
      }
    />
  ),
  user: (p) => (
    <Ic
      {...p}
      d={
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </>
      }
    />
  ),
  edit: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </>
      }
    />
  ),
  camera: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.3-2h7l1.3 2h2.2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
          <circle cx="12" cy="13" r="3.2" />
        </>
      }
    />
  ),
  logout: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </>
      }
    />
  ),
  arrowUp: (p) => <Ic {...p} sw={2.2} d={<path d="M12 19V6M6 12l6-6 6 6" />} />,
  arrowDown: (p) => (
    <Ic {...p} sw={2.2} d={<path d="M12 5v13M6 12l6 6 6-6" />} />
  ),
  target: (p) => (
    <Ic
      {...p}
      d={
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="0.6" fill="currentColor" />
        </>
      }
    />
  ),
  star: (p) => (
    <Ic
      {...p}
      d={
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z" />
      }
    />
  ),
  plus: (p) => <Ic {...p} d={<path d="M12 5v14M5 12h14" />} />,
  chart: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 16l3.5-4 3 2.5L20 8" />
        </>
      }
    />
  ),
  sparkle: (p) => (
    <Ic
      {...p}
      d={<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />}
    />
  ),
  award: (p) => (
    <Ic
      {...p}
      d={
        <>
          <circle cx="12" cy="9" r="5" />
          <path d="M9 13.5L8 21l4-2 4 2-1-7.5" />
        </>
      }
    />
  ),
  link: (p) => (
    <Ic
      {...p}
      d={
        <>
          <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
        </>
      }
    />
  ),
};

export default Icons;
