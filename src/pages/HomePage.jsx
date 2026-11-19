import { useEffect, useRef } from 'react';
import TicketsPage from './TicketsPage.jsx';
import { animateScrollTo, scrollToSection } from '../lib/navigation.js';

/** Página principal: la sección «Mapa» (vacía de momento) y la de billetes debajo. */
export default function HomePage({ route, nonce, onSectionChange }) {
  const firstRender = useRef(true);

  // Al pulsar «Mapa» o «Billetes» en el menú, desplazarse con animación.
  useEffect(() => {
    const isFirst = firstRender.current;
    firstRender.current = false;
    if (route === 'billetes') {
      requestAnimationFrame(() => scrollToSection('billetes'));
    } else if (!isFirst) {
      animateScrollTo(0);
    }
  }, [route, nonce]);

  // Resalta en el menú la sección que se está viendo.
  useEffect(() => {
    const onScroll = () => {
      const el = document.getElementById('billetes');
      if (!el) return;
      onSectionChange(el.getBoundingClientRect().top < window.innerHeight * 0.45 ? 'billetes' : 'mapa');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onSectionChange]);

  return (
    <>
      {/* Sección «Mapa»: vacía de momento (el mapa de la red está en «Rutas»). */}
      <section className="page map-empty" id="mapa" aria-label="Mapa" />
      <TicketsPage />
    </>
  );
}
