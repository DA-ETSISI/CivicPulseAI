export default function TicketsPage() {
  return (
    <section className="page">
      <div className="page-head">
        <h1>Billetes</h1>
        <p>Aquí podrás buscar trayectos y reservar tu billete.</p>
      </div>
      <div className="card placeholder">
        <span className="placeholder-icon" aria-hidden="true">🎫</span>
        <h2>Próximamente</h2>
        <p>Estamos preparando el buscador de trayectos y la reserva de billetes.</p>
        <a className="btn" href="#/mapa">Volver al mapa</a>
      </div>
    </section>
  );
}
