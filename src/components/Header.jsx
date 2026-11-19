const LINKS = [
  { id: 'mapa', label: 'Mapa' },
  { id: 'billetes', label: 'Billetes' },
];

export default function Header({ current }) {
  return (
    <header className="header">
      <div className="header-inner">
        <a className="brand" href="#/mapa" aria-label="VíaClara, inicio">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <rect width="32" height="32" rx="8" fill="currentColor" />
              <path d="M8 22 L24 10" stroke="var(--surface)" strokeWidth="3" strokeLinecap="round" />
              <circle cx="8" cy="22" r="3" fill="var(--surface)" />
              <circle cx="24" cy="10" r="3" fill="var(--surface)" />
            </svg>
          </span>
          <span className="brand-name">VíaClara</span>
        </a>
        <nav className="nav" aria-label="Principal">
          {LINKS.map((link) => (
            <a
              key={link.id}
              href={`#/${link.id}`}
              className={`nav-link${current === link.id ? ' is-active' : ''}`}
              aria-current={current === link.id ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
