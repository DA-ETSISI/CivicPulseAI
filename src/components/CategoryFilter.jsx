import { CATEGORIES } from '../lib/categories.js';

/** Botones tipo "chip" para mostrar u ocultar cada tipo de tren de alta velocidad. */
export default function CategoryFilter({ visible, counts, onToggle }) {
  return (
    <div className="chips" role="group" aria-label="Tipos de tren">
      {CATEGORIES.map((c) => {
        const on = visible.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`chip${on ? ' is-on' : ''}`}
            aria-pressed={on}
            title={c.hint}
            onClick={() => onToggle(c.id)}
          >
            <span className="chip-dot" aria-hidden="true" />
            {c.label}
            <span className="chip-count">{counts[c.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
