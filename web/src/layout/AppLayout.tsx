import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/', label: 'Raw data', end: true },
  { to: '/ledger', label: 'Prompt ledger', end: false },
  { to: '/personalize', label: 'Personalize', end: false },
] as const;

export function AppLayout() {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const lastPath = useRef(pathname);

  // On navigation, move focus to the new page so keyboard and screen reader users start at its top
  // instead of staying on the nav link. Not on first load (path unchanged), so the skip link stays the first Tab stop.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <span className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          Veru
        </span>
        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => [styles.link, isActive && styles.active].filter(Boolean).join(' ')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
