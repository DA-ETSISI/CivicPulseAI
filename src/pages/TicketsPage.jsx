import { useEffect, useMemo, useRef, useState } from 'react';
import SearchForm from '../components/tickets/SearchForm.jsx';
import TrainList from '../components/tickets/TrainList.jsx';
import BookingSummary, { legTotal } from '../components/tickets/BookingSummary.jsx';
import PassengerForm from '../components/tickets/PassengerForm.jsx';
import Confirmation from '../components/tickets/Confirmation.jsx';
import { loadTimetable, searchTrains, todayIso } from '../lib/timetable.js';
import { scrollToSection } from '../lib/navigation.js';

const STEPS = [
  { id: 'outbound', label: 'Ida' },
  { id: 'inbound', label: 'Vuelta' },
  { id: 'passengers', label: 'Viajeros' },
  { id: 'done', label: 'Confirmación' },
];

/** Sección «Billetes»: buscar trayecto → elegir tren y tarifa → datos de viajeros → confirmación. */
export default function TicketsPage() {
  const [timetable, setTimetable] = useState(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(null);
  const [step, setStep] = useState('search');
  const [outbound, setOutbound] = useState(null);
  const [inbound, setInbound] = useState(null);
  const [booking, setBooking] = useState(null);
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    loadTimetable().then(setTimetable, () => setFailed(true));
  }, []);

  // Aparición suave al llegar a la sección
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { threshold: 0.08 });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const minDate = useMemo(() => {
    if (!timetable) return todayIso();
    const today = todayIso();
    return today > timetable.base ? today : timetable.base;
  }, [timetable]);

  const initialForm = useMemo(
    () => ({ from: null, to: null, roundTrip: false, dateOut: minDate, dateBack: minDate, pax: { adults: 1, children: 0, infants: 0 } }),
    [minDate],
  );

  const outResults = useMemo(
    () => (timetable && query ? searchTrains(timetable, query.from.ids, query.to.ids, query.dateOut) : []),
    [timetable, query],
  );
  const backResults = useMemo(
    () => (timetable && query?.roundTrip ? searchTrains(timetable, query.to.ids, query.from.ids, query.dateBack) : []),
    [timetable, query],
  );

  const goTo = (next) => {
    setStep(next);
    requestAnimationFrame(() => scrollToSection('billetes-flow'));
  };

  const search = (form) => {
    setQuery(form);
    setOutbound(null);
    setInbound(null);
    setBooking(null);
    goTo('outbound');
  };

  const steps = STEPS.filter((s) => s.id !== 'inbound' || query?.roundTrip);
  const stepIndex = steps.findIndex((s) => s.id === step);

  return (
    <section id="billetes" ref={sectionRef} className={`page tickets reveal${visible ? ' is-visible' : ''}`}>
      <div className="page-head">
        <p className="eyebrow">Billetes</p>
        <h2 className="section-title">¿A dónde quieres viajar?</h2>
        <p>Busca entre los horarios oficiales de Renfe, elige tu tren y tu tarifa, y reserva en pocos pasos.</p>
      </div>

      {failed && <div className="card placeholder">No se han podido cargar los horarios. Ejecuta «npm run data».</div>}
      {!failed && !timetable && <div className="card placeholder">Cargando horarios…</div>}

      {timetable && (
        <SearchForm key={query ? `${query.dateOut}|${query.dateBack}` : 'new'} timetable={timetable} minDate={minDate} initial={query ?? initialForm} onSearch={search} />
      )}

      {timetable && query && step !== 'search' && (
        <div id="billetes-flow" className="booking">
          <ol className="steps" aria-label="Pasos de la compra">
            {steps.map((s, i) => (
              <li key={s.id} className={i < stepIndex ? 'is-done' : i === stepIndex ? 'is-current' : ''}>
                <span>{i + 1}</span>
                {s.label}
              </li>
            ))}
          </ol>

          <div className="booking-layout">
            <div className="booking-main">
              {step === 'outbound' && (
                <TrainList
                  title={`Ida · ${query.from.label} → ${query.to.label}`}
                  date={query.dateOut}
                  minDate={minDate}
                  maxDate={timetable.maxDate}
                  results={outResults}
                  selectedId={outbound?.train.id}
                  onChangeDate={(dateOut) =>
                    setQuery((q) => ({ ...q, dateOut, dateBack: q.dateBack < dateOut ? dateOut : q.dateBack }))
                  }
                  onSelect={(train, fare) => {
                    setOutbound({ train, fare });
                    goTo(query.roundTrip ? 'inbound' : 'passengers');
                  }}
                />
              )}
              {step === 'inbound' && (
                <TrainList
                  title={`Vuelta · ${query.to.label} → ${query.from.label}`}
                  date={query.dateBack}
                  minDate={query.dateOut}
                  maxDate={timetable.maxDate}
                  results={backResults}
                  selectedId={inbound?.train.id}
                  onChangeDate={(dateBack) => setQuery((q) => ({ ...q, dateBack }))}
                  onSelect={(train, fare) => {
                    setInbound({ train, fare });
                    goTo('passengers');
                  }}
                />
              )}
              {step === 'passengers' && (
                <PassengerForm
                  pax={query.pax}
                  onBack={() => goTo(query.roundTrip ? 'inbound' : 'outbound')}
                  onConfirm={({ email }) => {
                    setBooking({
                      email,
                      total: legTotal(outbound, query.pax) + legTotal(inbound, query.pax),
                      locator: Math.random().toString(36).slice(2, 8).toUpperCase(),
                    });
                    goTo('done');
                  }}
                />
              )}
              {step === 'done' && booking && (
                <Confirmation
                  booking={booking}
                  onRestart={() => {
                    setQuery(null);
                    setStep('search');
                    requestAnimationFrame(() => scrollToSection('billetes'));
                  }}
                />
              )}
            </div>

            <BookingSummary
              query={query}
              outbound={outbound}
              inbound={inbound}
              onEditOutbound={step !== 'done' ? () => goTo('outbound') : null}
              onEditInbound={step !== 'done' && query.roundTrip ? () => goTo('inbound') : null}
            />
          </div>
        </div>
      )}
    </section>
  );
}
