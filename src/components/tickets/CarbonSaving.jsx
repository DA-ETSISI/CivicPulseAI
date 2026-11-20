import { CAR_FACTORS, fmtKg } from '../../lib/carbon.js';
import '../../styles/carbon.css';

/**
 * CO2 que ahorra un trayecto en tren frente a hacerlo en coche particular.
 * `comparison` sale de compareWithCar (src/lib/carbon.js).
 */
export default function CarbonSaving({ comparison }) {
  if (!comparison) return null;
  const { savedKg, savedPct, carKg, trainKg, km, cars, people } = comparison;

  return (
    <div className="carbon">
      <p className="carbon-main">
        <LeafIcon />
        <span>
          Ahorras <strong>{fmtKg(savedKg)} de CO₂</strong> frente al coche
        </span>
      </p>
      <div className="carbon-bars" aria-hidden="true">
        <Bar label="Coche" kg={carKg} max={carKg} className="is-car" />
        <Bar label="Tren" kg={trainKg} max={carKg} className="is-train" />
      </div>
      <p className="carbon-meta">
        {km.toLocaleString('es-ES')} km · {savedPct} % menos emisiones
        {people > 1 && ` · ${people} viajeros en ${cars} ${cars === 1 ? 'coche' : 'coches'}`}
      </p>
    </div>
  );
}

function Bar({ label, kg, max, className }) {
  // Ancho mínimo para que la barra del tren se vea aunque sea muy pequeña.
  const width = Math.max(2, (kg / max) * 100);
  return (
    <div className={`carbon-bar ${className}`}>
      <span className="carbon-bar-label">{label}</span>
      <span className="carbon-bar-track">
        <span className="carbon-bar-fill" style={{ width: `${width}%` }} />
      </span>
      <span className="carbon-bar-kg">{fmtKg(kg)}</span>
    </div>
  );
}

/** Selector del combustible del coche con el que se compara. */
export function FuelPicker({ value, onChange }) {
  return (
    <div className="carbon-fuel" role="radiogroup" aria-label="Combustible del coche para comparar">
      <span>Comparar con coche de</span>
      {Object.entries(CAR_FACTORS).map(([id, f]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? 'is-on' : undefined} onClick={() => onChange(id)}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

/** Hojita verde (también la usa la lista de trenes). */
export function LeafIcon({ size = 18 }) {
  return (
    <svg className="carbon-leaf" viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <path d="M4 16C4 9 8 4 17 3c0 9-5 13-11 13 M4 16l6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
