/* Utilidades de formato, escape y calculo financiero compartidas por los modulos. */
const Fmt = (() => {
  const soles = new Intl.NumberFormat('es-PE', {
    style: 'currency', currency: 'PEN', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const solesCorto = new Intl.NumberFormat('es-PE', {
    style: 'currency', currency: 'PEN', maximumFractionDigits: 0,
  });

  const money = (n) => (isFinite(n) ? soles.format(n) : '—');
  const moneyCorto = (n) => (isFinite(n) ? solesCorto.format(n) : '—');
  const pct = (n, d = 2) => (isFinite(n) ? `${(n * 100).toFixed(d)}%` : '—');
  const pp = (n, d = 2) => (isFinite(n) ? `${n >= 0 ? '+' : ''}${(n * 100).toFixed(d)} pp` : '—');

  /** Escapa texto antes de insertarlo en HTML. Todo dato externo pasa por aqui. */
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Solo se permiten enlaces http(s): evita javascript: y data: en URLs de datos. */
  function urlSegura(u) {
    if (!u) return null;
    try {
      const p = new URL(u, location.href);
      return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : null;
    } catch { return null; }
  }

  const mesLargo = (iso) => {
    const [a, m] = String(iso).split('-');
    const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
    return `${nombres[parseInt(m, 10) - 1] || m} ${a}`;
  };

  /* ── Motor financiero ───────────────────────────────── */

  /**
   * TREA aplicable a un saldo segun la escala de tramos de la entidad.
   * Los tramos vienen ordenados por saldo de inicio; se toma el ultimo que aplique.
   */
  function treaPorSaldo(entidad, saldo, cumpleCondicion = true) {
    const ficha = Datos.fichaDe(entidad.entidad);
    const tramos = (ficha && ficha.tramos) || [];
    const treaMax = entidad.trea || 0;

    if (!tramos.length) return cumpleCondicion ? treaMax : Math.min(treaMax, 0.005);

    const ordenados = [...tramos].sort((a, b) => a.desde - b.desde);
    let aplicable = ordenados[0];
    for (const t of ordenados) if (saldo >= t.desde) aplicable = t;

    // Si no cumple la condicion de campaña, no accede al tramo promocional.
    if (!cumpleCondicion) {
      const base = ordenados.filter((t) => t.trea < treaMax).map((t) => t.trea);
      return base.length ? Math.max(...base) : 0;
    }
    return aplicable.trea;
  }

  /** Saldo que efectivamente gana la tasa (algunas campañas tienen tope remunerado). */
  function saldoRemunerado(entidad, saldo) {
    const ficha = Datos.fichaDe(entidad.entidad);
    const tope = ficha && ficha.simulador && ficha.simulador.tope_remunerado;
    return (isFinite(tope) && tope > 0) ? Math.min(saldo, tope) : saldo;
  }

  /**
   * Proyeccion mes a mes. La TREA es efectiva anual, asi que la tasa mensual
   * equivalente es (1+TREA)^(1/12)-1. El interes se calcula solo sobre el saldo
   * remunerado; el excedente sobre el tope no genera intereses promocionales.
   */
  function proyectar(entidad, { monto, aporte = 0, meses = 12, cumple = true, itf = false }) {
    let saldo = monto;
    if (itf) saldo -= monto * 0.00005; // ITF 0.005%

    const filas = [];
    let acumulado = 0;
    let aportado = saldo;

    for (let m = 1; m <= meses; m += 1) {
      const trea = treaPorSaldo(entidad, saldo, cumple);
      const remunerado = saldoRemunerado(entidad, saldo);
      const mensual = Math.pow(1 + trea, 1 / 12) - 1;
      const interes = remunerado * mensual;

      acumulado += interes;
      saldo += interes + aporte;
      aportado += aporte;

      filas.push({ mes: m, trea, remunerado, interes, acumulado, aportado, saldo });
    }

    const trea = treaPorSaldo(entidad, monto, cumple);
    return {
      filas,
      treaAplicada: trea,
      saldoRemunerado: saldoRemunerado(entidad, monto),
      interesTotal: acumulado,
      saldoFinal: saldo,
      aportadoTotal: aportado,
    };
  }

  return { money, moneyCorto, pct, pp, esc, urlSegura, mesLargo, treaPorSaldo, saldoRemunerado, proyectar };
})();
