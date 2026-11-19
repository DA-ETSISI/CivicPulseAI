import { useLayoutEffect, useRef, useState } from 'react';
import ThemeToggle from './ThemeToggle.jsx';
import { navigate } from '../lib/navigation.js';

const LINKS = [
  { id: 'mapa', label: 'Mapa' },
  { id: 'billetes', label: 'Billetes' },
  { id: 'incidencias', label: 'Incidencias' },
  { id: 'rutas', label: 'Rutas' },
  { id: 'mi-billete', label: 'Mi billete' },
];

/**
 * Subrayado único que se desliza hasta la pestaña activa (translateX + width).
 * La primera vez se coloca sin animación; luego, al cambiar de pestaña o de tamaño, se anima.
 */
function useNavIndicator(navRef, current) {
  const [box, setBox] = useState(null);
  const ready = useRef(false);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const measure = () => {
      const link = nav.querySelector('.nav-link.is-active');
      setBox(link ? { x: link.offsetLeft + 12, w: link.offsetWidth - 24, top: link.offsetTop + link.offsetHeight - 4 } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    nav.querySelectorAll('.nav-link').forEach((l) => ro.observe(l));
    const id = requestAnimationFrame(() => (ready.current = true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(id);
    };
  }, [navRef, current]);
  return { box, animate: ready.current };
}

export default function Header({ current, theme, onToggleTheme }) {
  const navRef = useRef(null);
  const indicator = useNavIndicator(navRef, current);
  const go = (id) => (event) => {
    event.preventDefault();
    navigate(id);
  };

  return (
    <header className="header">
      <div className="header-inner">
        <a className="brand" href="#/inicio" onClick={go('inicio')} aria-label="VíaClara, inicio">
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

        <nav className="nav" aria-label="Principal" ref={navRef}>
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
          <span
            className={`nav-indicator${indicator.animate ? ' is-animated' : ''}`}
            aria-hidden="true"
            style={indicator.box ? { top: indicator.box.top, width: indicator.box.w, transform: `translateX(${indicator.box.x}px)` } : { opacity: 0 }}
          />
        </nav>

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
