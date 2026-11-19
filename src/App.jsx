import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import HomePage from './pages/HomePage.jsx';
import ComingSoonPage from './pages/ComingSoonPage.jsx';
import { useRoute } from './lib/navigation.js';
import { useTheme } from './lib/theme.js';

const OTHER_PAGES = {
  incidencias: {
    title: 'Incidencias',
    text: 'Aquí podrás consultar retrasos, obras y cortes de vía que afecten a tu viaje.',
  },
  rutas: {
    title: 'Rutas',
    text: 'Aquí podrás descubrir rutas y escapadas en tren por toda España.',
  },
};

export default function App() {
  const { route, nonce } = useRoute();
  const [theme, toggleTheme] = useTheme();
  const [section, setSection] = useState('mapa');

  const page = OTHER_PAGES[route];
  const current = page ? route : section;

  // Al entrar en otra página, empezar arriba del todo.
  useEffect(() => {
    if (page) window.scrollTo(0, 0);
  }, [page, nonce]);

  return (
    <div className="app">
      <Header current={current} theme={theme} onToggleTheme={toggleTheme} />
      <main className="main">
        {page ? (
          <ComingSoonPage {...page} />
        ) : (
          <HomePage route={route} nonce={nonce} theme={theme} onSectionChange={setSection} />
        )}
      </main>
    </div>
  );
}
