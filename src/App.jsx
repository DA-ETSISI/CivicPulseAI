import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import HomePage from './pages/HomePage.jsx';
import ComingSoonPage from './pages/ComingSoonPage.jsx';
import RoutesPage from './pages/RoutesPage.jsx';
import { useRoute } from './lib/navigation.js';
import { useTheme } from './lib/theme.js';

const OTHER_PAGES = {
  incidencias: {
    title: 'Incidencias',
    text: 'Aquí podrás consultar retrasos, obras y cortes de vía que afecten a tu viaje.',
  },
};

export default function App() {
  const { route, nonce } = useRoute();
  const [theme, toggleTheme] = useTheme();
  const [section, setSection] = useState('mapa');

  const isRoutes = route === 'rutas';
  const page = OTHER_PAGES[route];
  const current = page || isRoutes ? route : section;

  // Al entrar en otra página, empezar arriba del todo.
  useEffect(() => {
    if (page || isRoutes) window.scrollTo(0, 0);
  }, [page, isRoutes, nonce]);

  return (
    <div className="app">
      <Header current={current} theme={theme} onToggleTheme={toggleTheme} />
      <main className="main">
        {isRoutes ? (
          <RoutesPage theme={theme} />
        ) : page ? (
          <ComingSoonPage {...page} />
        ) : (
          <HomePage route={route} nonce={nonce} theme={theme} onSectionChange={setSection} />
        )}
      </main>
    </div>
  );
}
