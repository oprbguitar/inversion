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

  /* ── Motor financiero ───────────────────────────────────
   * El calculo vive en motor.js (puro y con pruebas). Aqui solo se arma la
   * configuracion normalizada del producto a partir de `Datos` y se delega. */

  /** Construye la config que espera Motor a partir de la entidad y su ficha. */
  function configDe(entidad) {
    const ficha = Datos.fichaDe(entidad.entidad) || {};
    const sim = ficha.simulador || {};
    return {
      tramos: ficha.tramos || [],
      treaMax: entidad.trea || 0,
      topeRemunerado: sim.tope_remunerado,
      // La tasa del excedente sobre el tope no esta verificada en la fuente;
      // se deja explicita como null para no inventar un numero (ver auditoria).
      tasaRegular: (sim.tasa_regular === undefined) ? null : sim.tasa_regular,
      mantenimientoMensual: sim.mantenimiento_mensual || 0,
    };
  }

  function treaPorSaldo(entidad, saldo, cumpleCondicion = true) {
    const c = configDe(entidad);
    return Motor.treaPorSaldo(c.tramos, c.treaMax, saldo, cumpleCondicion);
  }

  function saldoRemunerado(entidad, saldo) {
    return Motor.saldoRemunerado(saldo, configDe(entidad).topeRemunerado);
  }

  /** Proyeccion mes a mes; delega en el motor puro y conserva las claves usadas. */
  function proyectar(entidad, opciones) {
    return Motor.proyectar(configDe(entidad), opciones);
  }

  const retornoReal = Motor.retornoReal;

  return {
    money, moneyCorto, pct, pp, esc, urlSegura, mesLargo,
    treaPorSaldo, saldoRemunerado, proyectar, retornoReal,
  };
})();
