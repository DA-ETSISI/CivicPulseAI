import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import HomePage from './pages/HomePage.jsx';
import IncidentsPage from './pages/IncidentsPage.jsx';
import RoutesPage from './pages/RoutesPage.jsx';
import MyTicketPage from './pages/MyTicketPage.jsx';
import { useRoute } from './lib/navigation.js';
import { useTheme } from './lib/theme.js';

/** Secciones que son páginas propias; «inicio», «mapa» y «billetes» viven juntas en la página principal. */
const PAGES = {
  incidencias: () => <IncidentsPage />,
  rutas: ({ theme }) => <RoutesPage theme={theme} />,
  'mi-billete': () => <MyTicketPage />,
};

export default function App() {
  const { route, nonce } = useRoute();
  const [theme, toggleTheme] = useTheme();
  const [section, setSection] = useState('inicio');

  const Page = PAGES[route];
  const current = Page ? route : section;

  // Al entrar en otra página, empezar arriba del todo.
  useEffect(() => {
    if (Page) window.scrollTo(0, 0);
  }, [Page, nonce]);

  return (
    <div className="app">
      <Header current={current} theme={theme} onToggleTheme={toggleTheme} />
      <main className="main">
        {Page ? (
          <Page theme={theme} />
        ) : (
          <HomePage route={route} nonce={nonce} theme={theme} onSectionChange={setSection} />
        )}
      </main>
    </div>
  );
}
