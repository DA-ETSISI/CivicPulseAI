import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TicketForm from '../components/ticket/TicketForm.jsx';
import QrScanner from '../components/ticket/QrScanner.jsx';
import Itinerary, { Countdown, IncidentPanel, timeline, useNow } from '../components/ticket/Itinerary.jsx';
import TicketMap from '../components/ticket/TicketMap.jsx';
import { useNetworkData } from '../lib/useNetworkData.js';
import { useTrainInsights } from '../lib/useTrainInsights.js';
import { loadTimetable, addDays } from '../lib/timetable.js';
import { decodeQr, parseTicketText } from '../lib/qrTicket.js';
import { navigate } from '../lib/navigation.js';
import {
  alternativesAfter,
  buildItinerary,
  clearTrip,
  exampleTicket,
  hasSavedTrip,
  loadTrip,
  madridToday,
  saveTrip,
  simulatedDelays,
} from '../lib/myTicket.js';

const PRIVACY_TEXT =
  'Tu billete se procesa en tu dispositivo. Solo usamos el número de tren, la fecha y las estaciones para mostrarte tu viaje. No guardamos tu nombre ni tus datos personales.';

const QR_UNREADABLE =
  'No hemos podido leer los datos del viaje en este QR. Los billetes de Renfe pueden llevar el código cifrado o en un formato que no es público, y no intentamos saltarnos esa protección. Escribe el número de tren y la fecha a mano.';

/** Avisos del navegador X minutos antes de cada salida (solo si el usuario los activa y mientras la página está abierta). */
function useDepartureNotices(tl, enabled, minutes) {
  useEffect(() => {
    if (!enabled || !tl || !('Notification' in window) || Notification.permission !== 'granted') return undefined;
    const now = Date.now();
    const timers = tl.legs
      .map((leg) => {
        const at = leg.depAt - minutes * 60_000;
        if (at <= now) return null;
        return setTimeout(() => {
          new Notification(`Tu tren ${leg.number} sale en ${minutes} min`, { body: `Desde ${leg.from} hacia ${leg.to}.`, tag: `viaclara-${leg.number}` });
        }, at - now);
      })
      .filter(Boolean);
    return () => timers.forEach(clearTimeout);
  }, [tl, enabled, minutes]);
}

/**
 * Sección «Mi billete»: el viaje de tu billete de tren, con transbordos y cuenta atrás.
 * Con `demoMode` es la pestaña «Billete prueba»: abre directamente la demo (datos ficticios) y no lee
 * ni toca el billete guardado en el dispositivo. «Salir de la demo» lleva a «Mi billete».
 */
export default function MyTicketPage({ demoMode = false }) {
  // Modo demo: en desarrollo (enlace de ejemplo y ?demo=) y siempre en «Billete prueba».
  // Solo en ese caso se descarga el fixture (datos inventados, sin nada personal).
  const demoEnabled = import.meta.env.DEV || demoMode;
  const map = useNetworkData();
  const [timetable, setTimetable] = useState(null);
  const [ticket, setTicket] = useState(() => (demoMode ? null : loadTrip()));
  const [extra, setExtra] = useState(null); // coche y plaza: solo en memoria, nunca se guardan
  const [remember, setRemember] = useState(() => (demoMode ? false : hasSavedTrip()));
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState(null);
  const [notify, setNotify] = useState({ enabled: false, minutes: 10, message: null });
  const fileRef = useRef(null);
  // Modo demo (solo desarrollo): escenario cargado y desfase del reloj simulado.
  const [demoKit, setDemoKit] = useState(null);
  const [demo, setDemo] = useState(null);
  const [clockOffset, setClockOffset] = useState(0);
  const realNow = useNow(1000);
  const realNowRef = useRef(realNow);
  realNowRef.current = realNow;
  const now = realNow + (demo ? clockOffset : 0);

  useEffect(() => {
    if (demoEnabled) import('../dev/ticketDemo.jsx').then(setDemoKit);
  }, [demoEnabled]);

  const startDemo = useCallback(
    (id, clockMin) => {
      if (!demoKit) return;
      const d = demoKit.loadScenario(id);
      setDemo(d);
      setClockOffset(demoKit.clockAt(d.itinerary.date, clockMin ?? d.clockMin) - realNowRef.current);
      setNotice(null);
    },
    [demoKit],
  );
  const exitDemo = () => {
    if (demoMode) return navigate('mi-billete'); // «Billete prueba» siempre es demo
    setDemo(null);
    setClockOffset(0);
  };

  // ?demo=1 (o ?demo=<escenario>) abre la demo al entrar; ?hora=HH:MM fija el reloj simulado.
  useEffect(() => {
    if (!demoKit) return;
    const id = demoKit.scenarioFromUrl() ?? (demoMode ? 'normal' : null);
    if (id) startDemo(id, demoKit.clockFromUrl() ?? undefined);
  }, [demoKit, startDemo, demoMode]);

  useEffect(() => {
    loadTimetable().then(setTimetable, () => setNotice('No hemos podido cargar los horarios de Renfe. Ejecuta «npm run data».'));
  }, []);

  const result = useMemo(() => (timetable && ticket ? buildItinerary(timetable, ticket) : null), [timetable, ticket]);
  const itinerary = demo ? demo.itinerary : result?.ok ? result.itinerary : null;

  // Retrasos en tiempo real: solo se consulta por número de tren, y solo si el viaje es hoy.
  const numbers = useMemo(
    () => (!demo && itinerary && itinerary.date === madridToday() ? itinerary.legs.map((l) => l.number) : []),
    [itinerary, demo],
  );
  const insights = useTrainInsights(numbers);
  // Retraso simulado (?retraso=) para probar cómo se ve una incidencia; se suma a los datos en directo.
  const simulated = useMemo(() => (demo ? null : simulatedDelays(itinerary)), [itinerary, demo]);
  const delays = useMemo(
    () =>
      demo
        ? demo.delays
        : {
            ...Object.fromEntries(Object.entries(insights.live).map(([n, t]) => [n, t.officialDelayMin ?? 0])),
            ...(simulated ?? {}),
          },
    [insights.live, simulated, demo],
  );
  const tl = useMemo(() => {
    if (!itinerary) return null;
    const t = timeline(itinerary, delays, demo?.incidents);
    t.legs.forEach((l) => (l.live = l.number in delays));
    return t;
  }, [itinerary, delays, demo]);

  useDepartureNotices(tl, notify.enabled && !demo, notify.minutes);

  // Si un retraso hace perder un transbordo, alternativas desde esa estación hasta el destino.
  const alternatives = useMemo(() => {
    if (!tl || !timetable) return [];
    const i = tl.transfers.findIndex((t) => t.state === 'risk');
    if (i < 0) return [];
    const leg = tl.legs[i];
    const earliest = leg.arr + leg.delay + tl.transfers[i].need;
    if (demo) return (demo.alternatives[i] ?? []).filter((a) => a.dep >= earliest);
    return alternativesAfter(timetable, itinerary, i, earliest);
  }, [tl, timetable, itinerary, demo]);

  // «Recordar este viaje»: se guarda solo el itinerario mínimo y se borra cuando el viaje termina.
  // (La demo nunca toca lo guardado en el dispositivo.)
  useEffect(() => {
    if (demo || demoMode) return;
    if (remember && ticket && tl) saveTrip(ticket, tl.endsAt);
    if (!remember) clearTrip();
  }, [remember, ticket, tl, demo, demoMode]);
  const finished = !demo && !demoMode && tl && now > tl.endsAt + 30 * 60_000;
  useEffect(() => {
    if (finished) clearTrip();
  }, [finished]);

  const forget = () => {
    if (demoMode) return exitDemo(); // en la prueba no hay billete real que borrar
    exitDemo();
    clearTrip();
    setTicket(null);
    setExtra(null);
    setRemember(false);
    setNotice(null);
  };

  // El contenido del QR solo pasa por aquí: se extrae lo mínimo y el texto original se descarta.
  const handleQrText = useCallback(
    (text) => {
      setScanning(false);
      const parsed = timetable ? parseTicketText(timetable, text) : null;
      if (!parsed) {
        setNotice(QR_UNREADABLE);
        return;
      }
      setExtra({ car: parsed.car, seat: parsed.seat });
      setTicket({ date: parsed.date, legs: parsed.legs });
      setNotice(null);
    },
    [timetable],
  );

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // la imagen no se conserva
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const text = await decodeQr(bitmap);
      bitmap.close();
      if (text) handleQrText(text);
      else setNotice('No encontramos ningún código QR en esa imagen. Prueba con otra foto más nítida o escribe los datos a mano.');
    } catch {
      setNotice('No hemos podido abrir esa imagen. Prueba con otra o escribe los datos a mano.');
    }
  };

  const toggleNotify = async (enabled) => {
    if (!enabled) return setNotify((n) => ({ ...n, enabled: false, message: null }));
    if (!('Notification' in window)) return setNotify((n) => ({ ...n, message: 'Este navegador no permite avisos.' }));
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') return setNotify((n) => ({ ...n, enabled: false, message: 'Has bloqueado los avisos de esta web en el navegador.' }));
    setNotify((n) => ({ ...n, enabled: true, message: null }));
  };

  const today = madridToday();
  const showExample = () => {
    if (demoKit) return startDemo('normal'); // en desarrollo, el ejemplo es el escenario normal de la demo
    const ex = timetable && exampleTicket(timetable);
    if (ex) {
      setExtra(null);
      setTicket(ex);
      setNotice(null);
    } else setNotice('Ahora mismo no encontramos un viaje de ejemplo con transbordo. Prueba más tarde.');
  };

  return (
    <section className="page my-ticket" id={demoMode ? 'billete-prueba' : 'mi-billete'}>
      <div className="page-head">
        {demoMode ? (
          <>
            <h1>Billete de prueba</h1>
            <p>
              Un viaje de ejemplo con datos ficticios para ver cómo funciona «Mi billete». Elige un escenario (retraso, transbordo perdido,
              tren cancelado…) y mueve la hora simulada para ver la cuenta atrás en cada momento.
            </p>
          </>
        ) : (
          <>
            <h1>Mi billete</h1>
            <p>Introduce tu billete de tren y te enseñamos tu viaje: los trenes que tienes que coger, los transbordos y cuánto falta para tu próximo tren.</p>
          </>
        )}
      </div>

      {demo && demoKit && (
        <demoKit.DemoPanel
          demo={demo}
          now={now}
          onScenario={(id) => startDemo(id)}
          onClock={(min) => setClockOffset(demoKit.clockAt(demo.itinerary.date, min) - realNowRef.current)}
          onExit={exitDemo}
        />
      )}

      {demoMode && !itinerary && <p className="empty">Cargando el viaje de ejemplo…</p>}

      {!itinerary && !demoMode && (
        <div className="ticket-entry">
          <div className="card ticket-card">
            <h2>Escribe los datos del billete</h2>
            {timetable ? (
              <TicketForm
                key={result?.ok === false ? 'retry' : 'new'}
                timetable={timetable}
                minDate={today > timetable.base ? today : timetable.base}
                maxDate={addDays(timetable.base, timetable.days - 1)}
                defaultDate={ticket?.date ?? today}
                failedLeg={result?.ok === false ? result.legIndex : null}
                onSubmit={(t) => {
                  setExtra(null);
                  setTicket(t);
                  setNotice(null);
                }}
              />
            ) : (
              <p className="empty">Cargando los horarios de Renfe…</p>
            )}
            {result?.ok === false && (
              <p className="ticket-error" role="alert">
                {result.error}
              </p>
            )}
          </div>

          <div className="card ticket-card">
            <h2>O escanea el QR</h2>
            {scanning ? (
              <QrScanner onText={handleQrText} onClose={() => setScanning(false)} />
            ) : (
              <div className="qr-actions">
                <button type="button" className="btn" onClick={() => setScanning(true)} disabled={!timetable}>
                  Escanear billete
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={!timetable}>
                  Subir foto o captura del QR
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
                <p className="qr-note">La cámara solo se enciende cuando pulsas «Escanear billete» y se apaga en cuanto lee el código.</p>
              </div>
            )}
            <button type="button" className="link example-link" onClick={showExample} disabled={!timetable}>
              ¿Sin billete a mano? Ver un ejemplo con transbordo
            </button>
          </div>

          <p className="privacy-note">{PRIVACY_TEXT}</p>
        </div>
      )}

      {notice && (
        <p className="ticket-notice" role="alert">
          {notice}
        </p>
      )}

      {itinerary && tl && (
        <>
          <Countdown tl={tl} now={now} />
          <IncidentPanel
            tl={tl}
            alternatives={alternatives}
            simulated={demo ? 'Demo · datos ficticios' : simulated ? 'Retraso simulado (prueba)' : null}
          />

          <div className="ticket-trip">
            <div className="card ticket-card">
              <div className="ticket-trip-head">
                <h2>
                  {itinerary.legs[0].from} → {itinerary.legs.at(-1).to}
                </h2>
                <p>
                  {itinerary.legs.length === 1
                    ? 'Directo'
                    : `${itinerary.legs.length - 1} ${itinerary.legs.length === 2 ? 'transbordo' : 'transbordos'}`}
                </p>
              </div>
              <Itinerary itinerary={itinerary} tl={tl} extra={extra} />

              <div className="ticket-options">
                <label className="check">
                  <input type="checkbox" checked={remember && !demo} disabled={Boolean(demo)} onChange={(e) => setRemember(e.target.checked)} />
                  Recordar este viaje en este dispositivo (se borra solo cuando termina)
                </label>
                <label className="check">
                  <input type="checkbox" checked={notify.enabled} onChange={(e) => toggleNotify(e.target.checked)} />
                  Avisarme
                  <select
                    value={notify.minutes}
                    onChange={(e) => setNotify((n) => ({ ...n, minutes: Number(e.target.value) }))}
                    aria-label="Minutos de antelación"
                  >
                    {[5, 10, 15, 30].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                  antes de cada salida (con la página abierta)
                </label>
                {notify.message && <p className="ticket-error">{notify.message}</p>}
                <div className="ticket-actions">
                  <button type="button" className="btn btn-ghost btn-small" onClick={forget}>
                    Borrar mi billete
                  </button>
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      exitDemo();
                      setTicket(null);
                      setExtra(null);
                    }}
                  >
                    Introducir otro billete
                  </button>
                </div>
              </div>
            </div>

            <div className="card map-card ticket-map-card">
              <div className="map-area">
                {map.status === 'ready' && timetable ? (
                  <TicketMap provinces={map.provinces} countries={map.countries} stations={timetable.stations} itinerary={itinerary} tl={tl} now={now} />
                ) : (
                  <div className="map-status">Cargando mapa…</div>
                )}
              </div>
            </div>
          </div>

          <p className="privacy-note">{PRIVACY_TEXT}</p>
        </>
      )}
    </section>
  );
}
