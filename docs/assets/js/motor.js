/* Motor financiero puro y sin dependencias.
 *
 * Vive aparte del navegador a proposito: recibe todos sus datos como parametros
 * explicitos (no lee `Datos` ni el DOM), asi que puede probarse con `node --test`
 * sin simular un navegador. formato.js lo envuelve para el uso en la pagina.
 *
 * Corrige el defecto principal senalado en la auditoria: el saldo por encima del
 * TOPE REMUNERADO ya no desaparece del calculo. Se separa explicitamente:
 *
 *   interes promocional   (saldo hasta el tope, a la TREA de campana)
 * + interes del excedente (saldo sobre el tope, a la tasa regular)
 * + interes de aportes    (los aportes recurrentes tambien capitalizan)
 * - mantenimiento mensual
 * = interes neto estimado
 *
 * Cuando la tasa regular del excedente no esta verificada (tasaRegular = null),
 * el excedente gana 0 pero se REPORTA por separado (excedentePromedio,
 * excedenteNoVerificado) en vez de ocultarse: el usuario ve que ese dinero no
 * esta rindiendo la tasa promocional.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Motor = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ITF_TASA = 0.00005; // Impuesto a las Transacciones Financieras: 0.005%

  /** Tasa mensual equivalente de una tasa efectiva anual: (1+TEA)^(1/12)-1. */
  function mensualEquivalente(anual) {
    if (!isFinite(anual) || anual <= -1) return 0;
    return Math.pow(1 + anual, 1 / 12) - 1;
  }

  /**
   * TREA aplicable a un saldo segun la escala de tramos.
   * Los tramos son [{desde, trea}]; se toma el ultimo cuyo `desde` <= saldo.
   * Si no se cumple la condicion de campana, no se accede al tramo promocional:
   * se devuelve la mayor tasa por debajo de la TREA maxima (la tasa "base").
   */
  function treaPorSaldo(tramos, treaMax, saldo, cumpleCondicion) {
    if (!tramos || !tramos.length) {
      return cumpleCondicion ? treaMax : Math.min(treaMax, 0.005);
    }
    const ordenados = tramos.slice().sort((a, b) => a.desde - b.desde);

    if (!cumpleCondicion) {
      const base = ordenados.filter((t) => t.trea < treaMax).map((t) => t.trea);
      return base.length ? Math.max(...base) : 0;
    }

    let aplicable = ordenados[0];
    for (const t of ordenados) if (saldo >= t.desde) aplicable = t;
    return aplicable.trea;
  }

  /** Saldo que efectivamente gana la tasa promocional (limitado por el tope). */
  function saldoRemunerado(saldo, topeRemunerado) {
    return (isFinite(topeRemunerado) && topeRemunerado > 0)
      ? Math.min(saldo, topeRemunerado)
      : saldo;
  }

  /**
   * Proyeccion mes a mes de una cuenta de ahorro.
   *
   * @param {object} p Configuracion normalizada del producto.
   *   tramos            [{desde, trea}] escala de TREA por saldo
   *   treaMax           TREA promocional maxima
   *   topeRemunerado    saldo maximo que gana la TREA promocional (null = sin tope)
   *   tasaRegular       TREA que gana el excedente sobre el tope (null = no verificada)
   *   mantenimientoMensual  comision de mantenimiento mensual en soles
   * @param {object} o Escenario del usuario.
   *   monto, aporte, meses, cumple, itf
   */
  function proyectar(p, o) {
    const tramos = p.tramos || [];
    const treaMax = p.treaMax || 0;
    const tope = p.topeRemunerado;
    const tasaRegular = (p.tasaRegular === undefined) ? null : p.tasaRegular;
    const mantenimiento = p.mantenimientoMensual || 0;

    const monto = Math.max(0, o.monto || 0);
    const aporte = Math.max(0, o.aporte || 0);
    const meses = Math.max(1, Math.round(o.meses || 12));
    const cumple = o.cumple !== false;
    const cobrarItf = !!o.itf;

    let saldo = monto;
    let itfPagado = 0;
    if (cobrarItf) { const c = monto * ITF_TASA; saldo -= c; itfPagado += c; }

    const filas = [];
    let interesPromo = 0;
    let interesExcedente = 0;
    let mantenimientoTotal = 0;
    let aportado = saldo;
    let sumaExcedente = 0;
    const excedenteNoVerificado = !isFinite(tasaRegular) || tasaRegular === null;

    for (let m = 1; m <= meses; m += 1) {
      const trea = treaPorSaldo(tramos, treaMax, saldo, cumple);
      const remunerado = saldoRemunerado(saldo, tope);
      const excedente = Math.max(0, saldo - remunerado);
      sumaExcedente += excedente;

      const mPromo = mensualEquivalente(trea);
      const mReg = excedenteNoVerificado ? 0 : mensualEquivalente(tasaRegular);

      const iPromo = remunerado * mPromo;
      const iExc = excedente * mReg;
      interesPromo += iPromo;
      interesExcedente += iExc;
      mantenimientoTotal += mantenimiento;

      saldo += iPromo + iExc + aporte - mantenimiento;
      if (cobrarItf && aporte > 0) { const c = aporte * ITF_TASA; saldo -= c; itfPagado += c; }
      aportado += aporte;

      filas.push({
        mes: m, trea, remunerado, excedente,
        interes: iPromo + iExc, interesPromo: iPromo, interesExcedente: iExc,
        mantenimiento, acumulado: interesPromo + interesExcedente,
        aportado, saldo,
      });
    }

    const interesBruto = interesPromo + interesExcedente;
    const interesNeto = interesBruto - mantenimientoTotal - itfPagado;

    return {
      filas,
      treaAplicada: treaPorSaldo(tramos, treaMax, monto, cumple),
      saldoRemunerado: saldoRemunerado(monto, tope),
      excedenteInicial: Math.max(0, monto - saldoRemunerado(monto, tope)),
      excedentePromedio: sumaExcedente / meses,
      excedenteNoVerificado,
      interesTotal: interesBruto, // compatibilidad: interes bruto (promo + excedente)
      interesPromo,
      interesExcedente,
      mantenimientoTotal,
      itfPagado,
      interesNeto,
      saldoFinal: saldo,
      aportadoTotal: aportado,
    };
  }

  /**
   * Rendimiento real tras inflacion: (1 + nominal) / (1 + inflacion) - 1.
   * Es la unica forma correcta de comparar poder adquisitivo.
   */
  function retornoReal(nominal, inflacion) {
    if (!isFinite(nominal) || !isFinite(inflacion) || inflacion <= -1) return NaN;
    return (1 + nominal) / (1 + inflacion) - 1;
  }

  /** Cuota fija de un credito (sistema frances) sobre una TCEA. */
  function cuotaFrancesa(principal, tcea, meses) {
    const i = mensualEquivalente(tcea);
    if (i <= 0) return principal / meses;
    return (principal * i) / (1 - Math.pow(1 + i, -meses));
  }

  return {
    ITF_TASA,
    mensualEquivalente,
    treaPorSaldo,
    saldoRemunerado,
    proyectar,
    retornoReal,
    cuotaFrancesa,
  };
}));
