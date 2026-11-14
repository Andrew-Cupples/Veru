import { NavLink, Outlet } from 'react-router';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/', label: 'Raw data', end: true },
  { to: '/ledger', label: 'Prompt ledger', end: false },
  { to: '/personalize', label: 'Personalize', end: false },
] as const;

export function AppLayout() {
  return (
    <div className={styles.shell}>
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
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
