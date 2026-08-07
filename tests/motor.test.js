/* Pruebas del motor financiero. Se ejecutan con `node --test` (sin dependencias). */
const test = require('node:test');
const assert = require('node:assert/strict');
const Motor = require('../docs/assets/js/motor.js');

// Producto de referencia: campana tipo Scotiabank Cuenta Digital.
// TREA 9.70% solo hasta S/3,000; por debajo de S/500 no califica.
const SCOTIA = {
  tramos: [
    { desde: 0, trea: 0 },
    { desde: 500, trea: 0.097 },
  ],
  treaMax: 0.097,
  topeRemunerado: 3000,
  tasaRegular: null, // el banco no publica un numero verificado
  mantenimientoMensual: 0,
};

const cerca = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

test('tasa mensual equivalente de la TREA', () => {
  // (1.097)^(1/12) - 1 ≈ 0.7745%
  assert.ok(cerca(Motor.mensualEquivalente(0.097) * 100, 0.7745, 0.001));
  assert.equal(Motor.mensualEquivalente(0), 0);
});

test('monto por debajo del minimo de campana no accede al tramo promocional', () => {
  // Con saldo 400 (< 500) el tramo aplicable es el de trea 0.
  const trea = Motor.treaPorSaldo(SCOTIA.tramos, SCOTIA.treaMax, 400, true);
  assert.equal(trea, 0);
});

test('monto exactamente en el umbral promocional gana la tasa de campana', () => {
  const trea = Motor.treaPorSaldo(SCOTIA.tramos, SCOTIA.treaMax, 500, true);
  assert.equal(trea, 0.097);
});

test('monto exactamente en el tope: todo el saldo es remunerado', () => {
  const r = Motor.proyectar(SCOTIA, { monto: 3000, meses: 12, cumple: true });
  assert.equal(r.excedenteInicial, 0);
  assert.equal(r.interesExcedente, 0);
  // 3000 a 9.70% capitalizado mensual ≈ 279 en 12 meses.
  assert.ok(cerca(r.interesTotal, 279, 2), `interes=${r.interesTotal}`);
});

test('monto por encima del tope: el excedente NO desaparece, se reporta', () => {
  const r = Motor.proyectar(SCOTIA, { monto: 10000, meses: 12, cumple: true });
  // El interes promocional se calcula solo sobre 3000 (≈278.8), igual que antes.
  assert.ok(cerca(r.interesPromo, 278.8, 1.5), `promo=${r.interesPromo}`);
  // El excedente inicial (7000) queda visible en vez de esfumarse.
  assert.equal(r.excedenteInicial, 7000);
  assert.equal(r.excedenteNoVerificado, true);
  // Sin tasa regular verificada, el excedente aporta 0 (pero esta reportado).
  assert.equal(r.interesExcedente, 0);
});

test('con tasa regular verificada, el excedente si genera interes', () => {
  const conRegular = { ...SCOTIA, tasaRegular: 0.0025 };
  const r = Motor.proyectar(conRegular, { monto: 10000, meses: 12, cumple: true });
  assert.equal(r.excedenteNoVerificado, false);
  assert.ok(r.interesExcedente > 0, 'el excedente debe rendir algo');
  // 7000 a 0.25% anual ≈ 17.5 en el ano, sumado al promocional.
  assert.ok(cerca(r.interesExcedente, 17.5, 3), `excedente=${r.interesExcedente}`);
  assert.ok(r.interesTotal > r.interesPromo);
});

test('campana no cumplida: no se aplica la tasa promocional', () => {
  const r = Motor.proyectar(SCOTIA, { monto: 10000, meses: 12, cumple: false });
  assert.equal(r.treaAplicada, 0); // el unico tramo bajo la maxima es 0
  assert.equal(r.interesPromo, 0);
});

test('aportes mensuales capitalizan y elevan el saldo final', () => {
  const sin = Motor.proyectar(SCOTIA, { monto: 3000, aporte: 0, meses: 12, cumple: true });
  const con = Motor.proyectar(SCOTIA, { monto: 3000, aporte: 200, meses: 12, cumple: true });
  assert.ok(con.aportadoTotal > sin.aportadoTotal);
  assert.ok(con.saldoFinal > sin.saldoFinal + 2400 - 1); // al menos los aportes
});

test('la comision de mantenimiento erosiona el rendimiento neto', () => {
  const conCosto = { ...SCOTIA, mantenimientoMensual: 10 };
  const r = Motor.proyectar(conCosto, { monto: 3000, meses: 12, cumple: true });
  assert.equal(r.mantenimientoTotal, 120);
  assert.ok(r.interesNeto < r.interesTotal, 'el neto descuenta el mantenimiento');
  assert.ok(cerca(r.interesNeto, r.interesTotal - 120, 0.01));
});

test('el ITF descuenta del saldo y se contabiliza', () => {
  const r = Motor.proyectar(SCOTIA, { monto: 10000, meses: 12, cumple: true, itf: true });
  assert.ok(r.itfPagado > 0);
  assert.ok(cerca(r.itfPagado, 10000 * Motor.ITF_TASA, 0.001));
});

test('rendimiento real: negativo cuando la inflacion supera al nominal', () => {
  // 4% nominal con 5% de inflacion => real negativo.
  const real = Motor.retornoReal(0.04, 0.05);
  assert.ok(real < 0, `real=${real}`);
  assert.ok(cerca(real * 100, -0.952, 0.01));
});

test('rendimiento real: positivo cuando el nominal supera a la inflacion', () => {
  const real = Motor.retornoReal(0.097, 0.03);
  assert.ok(real > 0);
  assert.ok(cerca(real * 100, 6.5, 0.1));
});

test('datos incompletos no rompen el motor', () => {
  const vacio = Motor.proyectar({}, { monto: 1000, meses: 6 });
  assert.ok(Number.isFinite(vacio.interesTotal));
  assert.ok(Number.isFinite(vacio.saldoFinal));
});

test('cuota francesa de una tarjeta de credito', () => {
  // 3000 a TCEA 39.29% en 12 cuotas ≈ 297.8/mes (verificado antes en el portal).
  const cuota = Motor.cuotaFrancesa(3000, 0.3929, 12);
  assert.ok(cerca(cuota, 297.8, 0.5), `cuota=${cuota}`);
});
