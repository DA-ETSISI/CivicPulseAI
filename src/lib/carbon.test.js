// Pruebas de la huella de carbono tren vs. coche. Se ejecutan con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareWithCar, fmtKg, sumComparisons, travellers } from './carbon.js';
import { routeKm } from './mapGeometry.js';

test('routeKm: Madrid → Sevilla en línea recta ronda los 390 km', () => {
  const km = routeKm([
    [-3.6894, 40.4065], // Madrid-Atocha
    [-5.9758, 37.3917], // Sevilla-Santa Justa
  ]);
  assert.ok(km > 380 && km < 400, `salió ${km}`);
});

test('routeKm suma tramo a tramo y es 0 con un solo punto', () => {
  const a = [-3.7, 40.4];
  const b = [-4.0, 39.9];
  const c = [-4.8, 37.9];
  assert.equal(routeKm([a]), 0);
  assert.ok(Math.abs(routeKm([a, b, c]) - (routeKm([a, b]) + routeKm([b, c]))) < 1e-9);
});

test('una persona, 400 km en gasolina', () => {
  const r = compareWithCar({ km: 400, people: 1, fuel: 'gasolina' });
  assert.equal(r.carKg, 73.2); // 0,183 × 400
  assert.equal(r.trainKg, 1.5); // 0,00379 × 400
  assert.equal(r.savedKg, 71.7);
  assert.equal(r.savedPct, 98);
  assert.equal(r.cars, 1);
});

test('el coche emite por vehículo y el tren por viajero', () => {
  const four = compareWithCar({ km: 100, people: 4, fuel: 'diesel' });
  assert.equal(four.cars, 1);
  assert.equal(four.carKg, 15.9); // un solo coche
  assert.equal(four.trainKg, 1.5); // 4 × 0,379
  // Con 6 viajeros harían falta dos coches.
  assert.equal(compareWithCar({ km: 100, people: 6, fuel: 'diesel' }).cars, 2);
});

test('datos inválidos no rompen el cálculo', () => {
  assert.equal(compareWithCar({ km: 0, people: 1 }), null);
  assert.equal(compareWithCar({ km: NaN, people: 1 }), null);
  assert.equal(compareWithCar({ km: 100, people: 0 }), null);
  assert.throws(() => compareWithCar({ km: 100, people: 1, fuel: 'carbón' }));
});

test('travellers cuenta adultos, niños y bebés', () => {
  assert.equal(travellers({ adults: 2, children: 1, infants: 1 }), 4);
  assert.equal(travellers(undefined), 0);
});

test('sumComparisons suma ida y vuelta e ignora trayectos vacíos', () => {
  const ida = compareWithCar({ km: 400, people: 1 });
  const total = sumComparisons([ida, ida, null]);
  assert.equal(total.savedKg, 143.4);
  assert.equal(sumComparisons([null]), null);
});

test('fmtKg', () => {
  assert.equal(fmtKg(0.38), '380 g');
  assert.equal(fmtKg(7.25), '7,3 kg');
  assert.equal(fmtKg(143.4), '143 kg');
});
