import { useId, useMemo, useState } from 'react';
import { CITIES, PROVINCE_ALIASES, normalize } from '../../lib/trainFilters.js';

const MAX_RESULTS = 7;

/** Todas las opciones buscables: provincias del mapa + ciudades principales. */
function buildOptions(provinces) {
  const provs = provinces.features
    .filter((f) => !['51', '52'].includes(f.properties.code)) // Ceuta y Melilla no tienen tren
    .map((f) => ({
      kind: 'province',
      code: f.properties.code,
      name: f.properties.name,
      terms: [f.properties.name, ...(PROVINCE_ALIASES[f.properties.code] ?? [])].map(normalize),
    }));
  const cities = CITIES.map((c) => ({ kind: 'city', ...c, terms: [c.name, ...(c.aliases ?? [])].map(normalize) }));
  return [...cities, ...provs];
}

/** Buscador con sugerencias para elegir una provincia o una ciudad. */
export default function PlaceSearch({ provinces, onPick }) {
  const listId = useId();
  const options = useMemo(() => buildOptions(provinces), [provinces]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    // Primero las que empiezan por el texto; después las que lo contienen.
    const starts = options.filter((o) => o.terms.some((t) => t.startsWith(q)));
    const contains = options.filter((o) => !starts.includes(o) && o.terms.some((t) => t.includes(q)));
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [options, query]);

  const pick = (option) => {
    onPick(option);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && results.length > 0;

  return (
    <div className="place-search">
      <svg className="place-search-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M13.5 13.5 L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        className="place-search-input"
        placeholder="Busca una provincia o ciudad"
        value={query}
        role="combobox"
        aria-label="Provincia o ciudad"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="place-results" id={listId} role="listbox">
          {results.map((o, i) => (
            <li
              key={`${o.kind}:${o.code ?? o.name}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : undefined}
              onPointerDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onPointerEnter={() => setActive(i)}
            >
              <span>{o.name}</span>
              <span className="place-kind">{o.kind === 'city' ? 'Ciudad' : 'Provincia'}</span>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && !results.length && <div className="place-empty">No encontramos «{query.trim()}»</div>}
    </div>
  );
}
