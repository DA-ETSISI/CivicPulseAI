import Header from './components/Header.jsx';
import MapPage from './pages/MapPage.jsx';
import TicketsPage from './pages/TicketsPage.jsx';
import { useHashRoute } from './lib/useHashRoute.js';

const PAGES = {
  mapa: MapPage,
  billetes: TicketsPage,
};

export default function App() {
  const route = useHashRoute('mapa');
  const Page = PAGES[route] ?? MapPage;

  return (
    <div className="app">
      <Header current={route} />
      <main className="main">
        <Page />
      </main>
    </div>
  );
}
