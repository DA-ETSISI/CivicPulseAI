import { useCallback, useEffect, useRef, useState } from 'react';
import Hero from '../components/home/Hero.jsx';
import LiveMapSection from './LiveMapSection.jsx';
import TicketsPage from './TicketsPage.jsx';
import { animateScrollTo, scrollToSection } from '../lib/navigation.js';
import { useTrainMap } from '../lib/useTrainMap.js';
import '../styles/home.css';

/** Secciones de la portada, en orden de arriba a abajo. */
const SECTIONS = ['inicio', 'mapa', 'billetes'];

/** Página principal: portada con foto → mapa de trenes en directo → billetes. */
export default function HomePage({ route, nonce, onSectionChange }) {
  const firstRender = useRef(true);
  // Un solo origen de datos en directo para la portada y el mapa.
  const live = useTrainMap();
  // Trayecto elegido en el mapa (doble clic en una línea o en un tren) para rellenar los billetes.
  const [trip, setTrip] = useState(null);
  const bookTrip = useCallback(({ from, to }) => setTrip({ from, to, nonce: Date.now() }), []);

  // Al pulsar «Mapa» o «Billetes» en el menú (o el logo), desplazarse con animación.
  useEffect(() => {
    const isFirst = firstRender.current;
    firstRender.current = false;
    if (route === 'mapa' || route === 'billetes') {
      // El mapa se pega a la cabecera para que no asome la foto de la portada.
      requestAnimationFrame(() => scrollToSection(route, route === 'mapa' ? 0 : 16));
    } else if (!isFirst) {
      animateScrollTo(0);
    }
  }, [route, nonce]);

  // Resalta en el menú la sección que se está viendo.
  useEffect(() => {
    const onScroll = () => {
      let current = 'inicio';
      for (const id of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.45) current = id;
      }
      onSectionChange(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onSectionChange]);

  return (
    <>
      <Hero live={live} />
      <LiveMapSection live={live} onBook={bookTrip} />
      <TicketsPage trip={trip} />
    </>
  );
}
