import { useEffect, useRef } from 'react';
import MapPage from './MapPage.jsx';
import TicketsPage from './TicketsPage.jsx';
import { animateScrollTo, scrollToSection } from '../lib/navigation.js';
import { loadNetwork } from '../lib/useNetworkData.js';

/** Página principal: el mapa arriba y la sección de billetes debajo. */
export default function HomePage({ route, nonce, theme, onSectionChange }) {
  const firstRender = useRef(true);

  // Al pulsar «Mapa» o «Billetes» en el menú, desplazarse con animación.
  useEffect(() => {
    const isFirst = firstRender.current;
    firstRender.current = false;
    if (route === 'billetes') {
      // Esperar a que el mapa esté dibujado para saber dónde empieza la sección.
      loadNetwork()
        .catch(() => {})
        .then(() => requestAnimationFrame(() => scrollToSection('billetes')));
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
      <MapPage theme={theme} />
      <TicketsPage />
    </>
  );
}
