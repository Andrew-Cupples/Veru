import { useEffect, useRef, type MouseEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useMotion } from '../motion/MotionProvider';
import { usePageTracking } from '../analytics/autoTrack';
import { pageLabel } from '../analytics/rows';
import { HeaderSearch } from './HeaderSearch';
import { LanguagePicker } from './LanguagePicker';
import { useT } from '../i18n/I18nProvider';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/', label: 'start', end: true },
  { to: '/reports', label: 'reports', end: false },
  { to: '/raw-data', label: 'rawData', end: false },
  { to: '/compare', label: 'compare', end: false },
  { to: '/analytics', label: 'analytics', end: false },
  { to: '/ledger', label: 'ledger', end: false },
  { to: '/personalize', label: 'personalize', end: false },
] as const;

const navIndex = (pathname: string) =>
  NAV.findIndex((item) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)));

export function AppLayout() {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { enabled: motion, slide } = useMotion();
  const lastPath = useRef(pathname);
  const t = useT();
  usePageTracking(pathname);

  // On navigation, move focus to the new page so keyboard and screen reader users start at its top
  // instead of staying on the nav link. Not on first load (path unchanged), so the skip link stays the first Tab stop.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    // When zoomed in, the whole document scrolls (see the reflow rules in AppLayout.module.css): start the new page at its top.
    if (document.scrollingElement && document.scrollingElement.scrollTop > 0) window.scrollTo({ top: 0 });
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
        {t.nav.skip}
      </a>
      <header className={styles.header}>
        <span className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.brandName}>Veru</span>
        </span>
        <nav className={styles.nav} aria-label={t.nav.label}>
          {NAV.map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              // Analytics keeps the English page name, so usage reads the same whatever the language.
              data-track={pageLabel(item.to)}
              onClick={(e) => onNavClick(e, index, item.to)}
              className={({ isActive }) => [styles.link, isActive && styles.active].filter(Boolean).join(' ')}
            >
              {({ isActive }) => (
                <>
                  {t.nav[item.label]}
                  {isActive && <span className={styles.indicator} aria-hidden="true" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <HeaderSearch />
        <LanguagePicker />
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
