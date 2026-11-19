import { navigate } from '../lib/navigation.js';

/** Página provisional para las secciones que aún no están construidas. */
export default function ComingSoonPage({ title, text }) {
  return (
    <section className="page">
      <div className="page-head">
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="card placeholder">
        <h2>Próximamente</h2>
        <p>Estamos trabajando en esta sección.</p>
        <button type="button" className="btn" onClick={() => navigate('mapa')}>
          Volver al mapa
        </button>
      </div>
    </section>
  );
}
