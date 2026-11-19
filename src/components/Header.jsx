import ThemeToggle from './ThemeToggle.jsx';
import { navigate } from '../lib/navigation.js';

const LINKS = [
  { id: 'mapa', label: 'Mapa' },
  { id: 'billetes', label: 'Billetes' },
  { id: 'incidencias', label: 'Incidencias' },
  { id: 'rutas', label: 'Rutas' },
];

export default function Header({ current, theme, onToggleTheme }) {
  const go = (id) => (event) => {
    event.preventDefault();
    navigate(id);
  };

  return (
    <header className="header">
      <div className="header-inner">
        <a className="brand" href="#/mapa" onClick={go('mapa')} aria-label="VíaClara, inicio">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <rect width="32" height="32" rx="8" fill="currentColor" />
              <path d="M8 22 L24 10" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" />
              <circle cx="8" cy="22" r="3" fill="var(--on-accent)" />
              <circle cx="24" cy="10" r="3" fill="var(--on-accent)" />
            </svg>
          </span>
          <span className="brand-name">VíaClara</span>
        </a>

        <nav className="nav" aria-label="Principal">
          {LINKS.map((link) => (
            <a
              key={link.id}
              href={`#/${link.id}`}
              onClick={go(link.id)}
              className={`nav-link${current === link.id ? ' is-active' : ''}`}
              aria-current={current === link.id ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
