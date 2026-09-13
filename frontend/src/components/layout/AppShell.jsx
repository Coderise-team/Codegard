import { useState } from 'react';

import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useCurrentUser } from '../../hooks/useCurrentUser';

/**
 * AppShell — page frame: sidebar, top bar, and the drawer that replaces the
 * sidebar on phones. A page wraps its content: <AppShell title="Problems">…
 *
 * A wrapper, not a layout route: a contest's breadcrumb is markup and the
 * profile paints the root with its rank colours, and through an <Outlet/> a
 * page hands neither to the frame above it. The scroll container stays with the
 * page — it differs (canvas / cp-stage) and Standings needs a ref on it.
 *
 * Props: title — breadcrumb; search — the page's declaration for the top bar
 * field, absent on a page that searches nothing; className, style — on the
 * frame root; children.
 */
export default function AppShell({
  title,
  search,
  className,
  style,
  children,
}) {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div
      className={`dash${className ? ` ${className}` : ''}`}
      data-density="compact"
      style={style}
    >
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="main">
        <Navbar
          user={user}
          title={title}
          search={search}
          onMenuClick={() => setNavOpen(true)}
        />

        {children}
      </div>
    </div>
  );
}
