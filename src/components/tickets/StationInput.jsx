import { useEffect, useId, useMemo, useState } from 'react';
import { filterOptions } from '../../lib/timetable.js';

/** Campo con autocompletado de estaciones (como el buscador de Renfe). */
export default function StationInput({ label, placeholder, options, value, onChange, invalid }) {
  const id = useId();
  const [text, setText] = useState(value?.label ?? '');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  useEffect(() => setText(value?.label ?? ''), [value]);

  const typing = !value || text !== value.label;
  const matches = useMemo(() => filterOptions(options, typing ? text : ''), [options, text, typing]);

  const choose = (option) => {
    onChange(option);
    setText(option.label);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setCursor((c) => (c + step + matches.length) % Math.max(1, matches.length));
    } else if (e.key === 'Enter' && open && matches[cursor]) {
      e.preventDefault();
      choose(matches[cursor]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const onBlur = () => {
    setOpen(false);
    if (!text.trim()) onChange(null);
    else if (typing && matches[0]) choose(matches[0]);
    else if (typing) setText(value?.label ?? '');
  };

  return (
    <div className={`field station-field${invalid ? ' is-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCursor(0);
          setOpen(true);
        }}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 && (
        <ul className="suggestions" id={`${id}-list`} role="listbox">
          {!typing || !text.trim() ? <li className="suggestions-title">Estaciones más frecuentes</li> : null}
          {matches.map((o, i) => (
            <li
              key={o.key}
              role="option"
              aria-selected={i === cursor}
              className={i === cursor ? 'is-cursor' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setCursor(i)}
            >
              <span>{o.label}</span>
              <small>{o.sub}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
