/* Capa de datos.
 *
 * Estrategia de actualizacion:
 *  1. dataset.json  — base verificada extraida del Excel (corte fijo).
 *  2. live.json     — snapshot que GitHub Actions regenera automaticamente
 *                     (BCRP + comparabien). Se pide con cache-busting, asi que
 *                     cada visita trae la ultima version publicada.
 *  3. API del BCRP  — se intenta en directo desde el navegador. Normalmente
 *                     falla por CORS (el BCRP no envia Access-Control-Allow-Origin);
 *                     si algun dia lo habilita, el portal usa el dato del minuto.
 *
 * El indicador de la cabecera dice siempre de donde salio cada dato.
 */
const Datos = (() => {
  const estado = {
    base: null,
    live: null,
    marcas: null,
    fuenteBcrp: 'excel',
    actualizado: null,
    errores: [],
  };

  const oyentes = [];
  const alActualizar = (fn) => oyentes.push(fn);
  const emitir = () => oyentes.forEach((fn) => fn(estado));

  async function traerJSON(url, { bust = false } = {}) {
    const destino = bust ? `${url}?t=${Date.now()}` : url;
    const r = await fetch(destino, { cache: bust ? 'no-store' : 'default' });
    if (!r.ok) throw new Error(`HTTP ${r.status} al pedir ${url}`);
    return r.json();
  }

  /* La API del BCRP responde JSON pero sin cabecera CORS: en navegador esto
     casi siempre rechaza. Se intenta igual y se degrada en silencio. */
  async function intentarBcrpEnVivo() {
    const hoy = new Date();
    const desde = `${hoy.getFullYear() - 2}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const hasta = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const url = `https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04722MM/json/${desde}/${hasta}/esp`;

    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), 6000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const MESES = { Ene: '01', Feb: '02', Mar: '03', Abr: '04', May: '05', Jun: '06',
                      Jul: '07', Ago: '08', Set: '09', Sep: '09', Oct: '10', Nov: '11', Dic: '12' };
      const serie = (j.periods || []).map((p) => {
        const m = /^([A-Za-z]{3})\.?(\d{4})/.exec(p.name || '');
        const v = parseFloat((p.values || [])[0]);
        if (!m || !MESES[m[1]] || !isFinite(v)) return null;
        return { mes: `${m[2]}-${MESES[m[1]]}`, tasa: v / 100, etiqueta: p.name };
      }).filter(Boolean).sort((a, b) => a.mes.localeCompare(b.mes));
      if (!serie.length) throw new Error('serie vacia');
      return serie;
    } finally {
      clearTimeout(reloj);
    }
  }

  async function cargar({ refrescar = false } = {}) {
    estado.errores = [];

    const [base, marcas] = await Promise.all([
      traerJSON('data/dataset.json'),
      traerJSON('data/marcas.json').catch(() => ({})),
    ]);
    estado.base = base;
    estado.marcas = marcas;

    // Snapshot automatico. Siempre con cache-busting: cada ingreso trae lo ultimo publicado.
    try {
      estado.live = await traerJSON('data/live.json', { bust: true });
      estado.actualizado = estado.live.actualizado || null;
      if (estado.live.bcrp) estado.fuenteBcrp = 'snapshot';
      Object.entries(estado.live.fuentes || {}).forEach(([k, v]) => {
        if (v.estado !== 'ok') estado.errores.push(`${k}: ${v.error}`);
      });
    } catch (e) {
      estado.errores.push(`snapshot automatico no disponible (${e.message})`);
    }

    // Intento directo contra el BCRP: si funciona, es el dato mas fresco posible.
    try {
      const serie = await intentarBcrpEnVivo();
      estado.live = estado.live || {};
      estado.live.bcrp = {
        ...(estado.live.bcrp || {}),
        serie,
        vigente: serie[serie.length - 1].tasa,
        mes_vigente: serie[serie.length - 1].mes,
        etiqueta_vigente: serie[serie.length - 1].etiqueta,
        fuente: 'https://estadisticas.bcrp.gob.pe/estadisticas/series/mensuales/resultados/PD04722MM/html',
      };
      estado.fuenteBcrp = 'api';
    } catch {
      /* CORS o red: se conserva el snapshot o el Excel. Sin ruido para el usuario. */
    }

    if (refrescar) void 0; // el bust ya garantiza datos nuevos
    emitir();
    return estado;
  }

  /* ── Accesores unificados ───────────────────────────── */

  const ranking = () => (estado.base ? estado.base.ranking : []);

  const fichaDe = (nombreEntidad) =>
    (estado.base ? estado.base.fichas : []).find((f) => f.entidad === nombreEntidad) || null;

  const marcaDe = (nombreEntidad) =>
    (estado.marcas && estado.marcas[nombreEntidad]) || { slug: 'generico', color: '#5a6a7d' };

  const logoDe = (nombreEntidad) => `assets/logos/${marcaDe(nombreEntidad).slug}.svg`;

  /** Serie del BCRP: prioriza API en vivo > snapshot > Excel. */
  function bcrp() {
    const vivo = estado.live && estado.live.bcrp;
    const base = estado.base ? estado.base.bcrp : { serie: [], vigente: null };
    if (vivo && vivo.serie && vivo.serie.length) {
      return { ...base, ...vivo, origen: estado.fuenteBcrp };
    }
    const serie = (base.serie || []).map((p) => ({ ...p, mes: String(p.mes).slice(0, 7) }));
    return { ...base, serie, origen: 'excel' };
  }

  const comparabien = () =>
    (estado.live && estado.live.comparabien) || { productos: [], fuente: 'https://comparabien.com.pe/ahorros' };

  const fsd = () => (estado.base ? estado.base.fsd : { cobertura: 122000 });

  const etiquetaOrigen = () => ({
    api: 'API del BCRP en vivo',
    snapshot: 'actualización automática',
    excel: 'archivo base',
  }[estado.fuenteBcrp]);

  return {
    estado, cargar, alActualizar,
    ranking, fichaDe, marcaDe, logoDe, bcrp, comparabien, fsd, etiquetaOrigen,
  };
})();
