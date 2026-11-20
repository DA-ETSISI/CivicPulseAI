import { scrollToSection } from '../../lib/navigation.js';
import { useInView } from '../../lib/useInView.js';

/**
 * Portada: nombre de la web sobre una foto de un AVE a pantalla completa.
 * Muestra cuántos trenes circulan ahora mismo (dato en directo del servidor).
 */
export default function Hero({ live }) {
  const total = live.data?.total;
  // Se desvanece al bajar al mapa y vuelve a aparecer al subir.
  const [ref, visible] = useInView();

  return (
    <section ref={ref} className={`hero reveal${visible ? ' is-visible' : ''}`} id="inicio" aria-label="Portada">
      <img
        className="hero-img"
        src="/images/hero-train.jpg"
        alt="Un AVE Serie 103 cruza un campo de trigo bajo un cielo de tormenta"
        fetchPriority="high"
      />
      <div className="hero-shade" aria-hidden="true" />

      <div className="hero-content">
        <p className="hero-live" aria-live="polite">
          <span className="live-pulse" aria-hidden="true" />
          {total ? `${total} trenes circulando ahora mismo` : 'Red ferroviaria en tiempo real'}
        </p>
        <h1 className="hero-title">VíaClara</h1>
        <p className="hero-sub">Toda la red ferroviaria de España, en directo y en un solo mapa.</p>
        <button type="button" className="hero-cta" onClick={() => scrollToSection('mapa', 0)}>
          Ver el mapa en directo
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M10 4 V16 M4.5 10.5 L10 16 L15.5 10.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <p className="hero-credit">
        Foto:{' '}
        <a
          href="https://commons.wikimedia.org/wiki/File:AVE_s103_passant_per_Pont%C3%B3s_(31101647843).jpg"
          target="_blank"
          rel="noreferrer"
        >
          Jordi Verdugo
        </a>{' '}
        ·{' '}
        <a href="https://creativecommons.org/licenses/by/2.0/deed.es" target="_blank" rel="noreferrer">
          CC BY 2.0
        </a>
      </p>
    </section>
  );
}
