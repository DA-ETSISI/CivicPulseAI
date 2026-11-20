import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Pestañas tipo «píldora» con un fondo que se desliza hasta la opción elegida.
 * `tabs`: [{ id, label }]. Los botones llevan id `tab-<id>` y controlan `panel-<id>`.
 */
export default function SlideTabs({ tabs, value, onChange, label }) {
  const listRef = useRef(null);
  const [pill, setPill] = useState(null);

  // Mide el botón activo para colocar la píldora (también si cambia el ancho de la ventana).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const measure = () => {
      const btn = list.querySelector('[aria-selected="true"]');
      if (btn) setPill({ x: btn.offsetLeft, w: btn.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div ref={listRef} className="subtabs" role="tablist" aria-label={label}>
      {pill && (
        <span className="subtabs-pill" aria-hidden="true" style={{ width: pill.w, transform: `translateX(${pill.x}px)` }} />
      )}
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          className={`subtab${value === t.id ? ' is-on' : ''}${pill ? ' has-pill' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
