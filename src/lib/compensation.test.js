// Pruebas de la calculadora de compensaciones. Se ejecutan con `npm test` (usa node:test, sin dependencias).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, claimWindow, computeCompensation, computeDelay, parseTime, pctFor, RENFE_RULES } from './compensation.js';

test('parseTime acepta horas válidas y rechaza las demás', () => {
  assert.equal(parseTime('08:45'), 525);
  assert.equal(parseTime('0:05'), 5);
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('12:60'), null);
  assert.equal(parseTime(''), null);
  assert.equal(parseTime(undefined), null);
});

test('computeDelay: retraso normal, llegada adelantada y viajes que pasan de medianoche', () => {
  assert.equal(computeDelay({ departure: '10:00', scheduledArrival: '12:30', actualArrival: '13:35' }).delay, 65);
  assert.equal(computeDelay({ departure: '10:00', scheduledArrival: '12:30', actualArrival: '12:20' }).delay, 0);
  // Sale a las 23:10, llega prevista a la 01:30 y llega de verdad a las 02:45.
  assert.equal(computeDelay({ departure: '23:10', scheduledArrival: '01:30', actualArrival: '02:45' }).delay, 75);
  // Llegada prevista 23:40 pero llega a las 00:50 del día siguiente.
  const late = computeDelay({ departure: '21:00', scheduledArrival: '23:40', actualArrival: '00:50' });
  assert.equal(late.delay, 70);
  assert.equal(late.arrivalAbs, 1490);
});

test('computeDelay detecta datos imposibles', () => {
  assert.equal(computeDelay({ departure: '10:00', scheduledArrival: '', actualArrival: '12:00' }).ok, false);
  assert.equal(computeDelay({ departure: '10:00', scheduledArrival: '10:00', actualArrival: '11:00' }).ok, false);
});

test('Larga Distancia: 50 % desde 60 min (incluido) y 100 % con más de 90', () => {
  assert.equal(pctFor(RENFE_RULES.larga, 59), 0);
  assert.equal(pctFor(RENFE_RULES.larga, 60), 50);
  assert.equal(pctFor(RENFE_RULES.larga, 90), 50);
  assert.equal(pctFor(RENFE_RULES.larga, 91), 100);
});

test('Avant: «superior a» 15 y 30 minutos', () => {
  assert.equal(pctFor(RENFE_RULES.avant, 15), 0);
  assert.equal(pctFor(RENFE_RULES.avant, 16), 50);
  assert.equal(pctFor(RENFE_RULES.avant, 31), 100);
});

test('computeCompensation: importe y formas de cobro en AVE', () => {
  const r = computeCompensation({ typeId: 'ave', delay: 75, price: 60, travelDate: '2026-11-10' });
  assert.equal(r.pct, 50);
  assert.equal(r.source, 'renfe');
  assert.equal(r.amount, 30);
  assert.deepEqual(r.payouts.map((p) => p.amount), [30, 45, 60]);
  assert.equal(r.rightsAt60, true);
});

test('Avlo no permite código de descuento ni Puntos Renfe', () => {
  const r = computeCompensation({ typeId: 'avlo', delay: 100, price: 20 });
  assert.equal(r.pct, 100);
  assert.equal(r.payouts.length, 1);
});

test('se aplica la norma más favorable: la de Renfe o el mínimo europeo', () => {
  // AVE tramo francés: 130 min → Renfe 50 %, UE 50 %; 70 min → Renfe 25 %, UE 25 %.
  assert.equal(computeCompensation({ typeId: 'fr-fr', delay: 130 }).pct, 50);
  // Otros enlaces: 60 min exactos → Renfe 0 % («superior a 60»), UE 25 % («60 o más»).
  const r = computeCompensation({ typeId: 'otros-enlaces', delay: 60, price: 40 });
  assert.equal(r.renfePct, 0);
  assert.equal(r.pct, 25);
  assert.equal(r.source, 'eu');
  assert.equal(r.amount, 10);
});

test('causas: fuerza mayor anula todo; Adif anula el compromiso de Renfe pero no el mínimo europeo', () => {
  assert.equal(computeCompensation({ typeId: 'ave', delay: 120, cause: 'force' }).pct, 0);
  const adif = computeCompensation({ typeId: 'ave', delay: 120, cause: 'adif', travelDate: '2026-10-01' });
  assert.equal(adif.renfePct, 0);
  assert.equal(adif.pct, 50);
  assert.equal(adif.source, 'eu');
  // Viajes anteriores al 31/01/2026: la exclusión de Adif no existía.
  assert.equal(computeCompensation({ typeId: 'ave', delay: 120, cause: 'adif', travelDate: '2026-01-15' }).renfePct, 100);
});

test('Cercanías no tiene compromiso de puntualidad', () => {
  const r = computeCompensation({ typeId: 'cercanias', delay: 90, price: 3 });
  assert.equal(r.pct, 0);
  assert.equal(r.isCercanias, true);
  assert.equal(r.rightsAt60, false);
});

test('precio inválido no rompe el cálculo', () => {
  assert.equal(computeCompensation({ typeId: 'ave', delay: 95, price: NaN }).amount, null);
  assert.equal(computeCompensation({ typeId: 'ave', delay: 95, price: -5 }).amount, null);
  assert.throws(() => computeCompensation({ typeId: 'patinete', delay: 10 }));
});

test('addMonths no se pasa de fin de mes', () => {
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
  assert.equal(addMonths('2026-01-15', 3), '2026-04-15');
});

test('claimWindow: espera de 24 h, plazo abierto y plazo vencido', () => {
  const arrival = 12 * 60; // llegó a las 12:00
  assert.equal(claimWindow('2026-11-18', arrival, new Date(2026, 10, 18, 20, 0)).state, 'wait');
  assert.equal(claimWindow('2026-11-18', arrival, new Date(2026, 10, 20, 9, 0)).state, 'open');
  assert.equal(claimWindow('2026-07-01', arrival, new Date(2026, 10, 19)).state, 'expired');
});
