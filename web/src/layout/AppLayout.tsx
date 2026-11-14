import { useEffect, useRef, type MouseEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useMotion } from '../motion/MotionProvider';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/', label: 'Raw data', end: true },
  { to: '/reports', label: 'Reports', end: false },
  { to: '/ledger', label: 'Prompt ledger', end: false },
  { to: '/personalize', label: 'Personalize', end: false },
] as const;

const navIndex = (pathname: string) =>
  NAV.findIndex((item) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)));

export function AppLayout() {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { enabled: motion, slide } = useMotion();
  const lastPath = useRef(pathname);

  // On navigation, move focus to the new page so keyboard and screen reader users start at its top
  // instead of staying on the nav link. Not on first load (path unchanged), so the skip link stays the first Tab stop.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  /** Slide towards the tab's side of the nav: tabs to the right push the page left, and vice versa. */
  const onNavClick = (e: MouseEvent<HTMLAnchorElement>, index: number, to: string) => {
    // Leave new-tab / new-window clicks and same-page clicks to the browser and router.
    if (!motion || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const from = navIndex(pathname);
    if (from === index) return;
    e.preventDefault();
    slide(() => navigate(to), from === -1 || index > from ? 'forward' : 'back');
  };

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
          {NAV.map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={(e) => onNavClick(e, index, item.to)}
              className={({ isActive }) => [styles.link, isActive && styles.active].filter(Boolean).join(' ')}
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive && <span className={styles.indicator} aria-hidden="true" />}
                </>
              )}
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
