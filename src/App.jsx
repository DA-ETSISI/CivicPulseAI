import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import HomePage from './pages/HomePage.jsx';
import ComingSoonPage from './pages/ComingSoonPage.jsx';
import IncidentsPage from './pages/IncidentsPage.jsx';
import { useRoute } from './lib/navigation.js';
import { useTheme } from './lib/theme.js';

const OTHER_PAGES = {
  rutas: {
    title: 'Rutas',
    text: 'Aquí podrás descubrir rutas y escapadas en tren por toda España.',
  },
};

export default function App() {
  const { route, nonce } = useRoute();
  const [theme, toggleTheme] = useTheme();
  const [section, setSection] = useState('mapa');

  const isIncidents = route === 'incidencias';
  const page = OTHER_PAGES[route];
  const current = page || isIncidents ? route : section;

  // Al entrar en otra página, empezar arriba del todo.
  useEffect(() => {
    if (page || isIncidents) window.scrollTo(0, 0);
  }, [page, isIncidents, nonce]);

  return (
    <div className="app">
      <Header current={current} theme={theme} onToggleTheme={toggleTheme} />
      <main className="main">
        {isIncidents ? (
          <IncidentsPage />
        ) : page ? (
          <ComingSoonPage {...page} />
        ) : (
          <HomePage route={route} nonce={nonce} theme={theme} onSectionChange={setSection} />
        )}
      </main>
    </div>
  );
}
