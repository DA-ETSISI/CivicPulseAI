import { useEffect, useRef, useState } from 'react';
import { decodeQr } from '../../lib/qrTicket.js';

/**
 * Escáner de QR con la cámara trasera. La cámara se enciende al montar este componente (es decir,
 * solo cuando el usuario pulsa «Escanear billete») y se apaga en cuanto se lee el QR, se cancela o se
 * sale de la página. La imagen no se graba ni se guarda: solo se analiza cada fotograma en memoria.
 */
export default function QrScanner({ onText, onClose }) {
  const videoRef = useRef(null);
  const [state, setState] = useState('starting');
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;
    let stopped = false;
    let timer = 0;

    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite usar la cámara. Sube una foto del QR o introduce los datos a mano.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) return stop();
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setState('scanning');
        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= 2) {
            const text = await decodeQr(video);
            if (text && !stopped) {
              stop(); // la cámara se apaga antes de procesar el contenido
              onText(text);
              return;
            }
          }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (e) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'No has dado permiso para usar la cámara. Puedes subir una foto del QR o introducir los datos a mano.'
            : 'No hemos podido abrir la cámara. Sube una foto del QR o introduce los datos a mano.',
        );
      }
    })();

    return stop;
  }, [onText]);

  return (
    <div className="qr-scanner" role="dialog" aria-label="Escanear el QR del billete">
      {error ? (
        <p className="ticket-error" role="alert">
          {error}
        </p>
      ) : (
        <div className="qr-view">
          <video ref={videoRef} muted playsInline aria-label="Vista de la cámara" />
          <span className="qr-frame" aria-hidden="true" />
          <p className="qr-hint">{state === 'starting' ? 'Abriendo la cámara…' : 'Apunta al código QR del billete'}</p>
        </div>
      )}
      <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
        {error ? 'Cerrar' : 'Cancelar'}
      </button>
    </div>
  );
}
