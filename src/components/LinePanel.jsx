import { useMemo, useState } from 'react';
import { CATEGORIES } from '../lib/categories.js';
import LineDetails from './LineDetails.jsx';

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Panel lateral: buscador + listado de líneas agrupadas por tipo, o el detalle de la seleccionada. */
export default function LinePanel({ lines, selected, hoveredId, onHover, onSelect }) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = normalize(query.trim());
    const match = (l) => !q || normalize(`${l.name} ${l.stops.join(' ')} ${l.types.join(' ')}`).includes(q);
    return [...CATEGORIES]
      .reverse()
      .map((c) => ({ ...c, lines: lines.filter((l) => l.category === c.id && match(l)) }))
      .filter((g) => g.lines.length);
  }, [lines, query]);

  if (selected) return <LineDetails line={selected} onClose={() => onSelect(null)} />;

  return (
    <aside className="panel" aria-label="Listado de líneas">
      <label className="search">
        <span className="visually-hidden">Buscar ciudad o línea</span>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          placeholder="Busca una ciudad o estación"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="panel-scroll">
        {groups.length === 0 && <p className="empty">No hay líneas que coincidan con «{query}».</p>}
        {groups.map((g) => (
          <section key={g.id} className="group">
            <h3 className="group-title">
              {g.label} <span>{g.lines.length}</span>
            </h3>
            <ul>
              {g.lines.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`line-item${hoveredId === l.id ? ' is-hover' : ''}`}
                    onPointerEnter={() => onHover(l.id)}
                    onPointerLeave={() => onHover(null)}
                    onFocus={() => onHover(l.id)}
                    onBlur={() => onHover(null)}
                    onClick={() => onSelect(l.id)}
                  >
                    <span className="swatch" style={{ background: l.color }} />
                    <span className="line-name">{l.name}</span>
                    <span className="line-type">{l.types[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
