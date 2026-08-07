/* Pestaña Ranking — comparador guiado por el monto del usuario.
 *
 * NO calcula finanzas por su cuenta: toda proyeccion sale del motor compartido
 * (Fmt.proyectar / Fmt.treaPorSaldo / Fmt.retornoReal). Aqui solo se lee la
 * entrada del usuario, se clasifica la compatibilidad, se ordena y se pinta.
 */
const Ranking = (() => {
  // Supuesto explicito y etiquetado para el rendimiento real: punto medio de la
  // meta de inflacion del BCRP. No es una medicion en vivo; se muestra como tal.
  const INFLACION_SUPUESTO = 0.02;
  const LS = 'ranking_prefs';

  const estado = {
    monto: 10000,
    meses: 12,
    aporte: 0,
    condicion: 'si',        // 'si' | 'no' | 'ambos'
    orden: 'ganancia',
    vista: 'cuadricula',
    ocultarIncompat: true,
    texto: '',
    chips: {},              // { digital:true, fsd:true, ... }
    avanzados: { trea: 0, apertura: '', minimo: '', verif: '' },
    comparacion: [],        // nombres de entidad, máx. 3
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const HOY = new Date();

  /* ── Preferencias en localStorage ─────────────────────── */
  function guardarPrefs() {
    try {
      localStorage.setItem(LS, JSON.stringify({
        monto: estado.monto, meses: estado.meses, aporte: estado.aporte,
        condicion: estado.condicion, orden: estado.orden, vista: estado.vista,
        ocultarIncompat: estado.ocultarIncompat, chips: estado.chips,
      }));
    } catch { /* modo privado */ }
  }
  function cargarPrefs() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(LS) || '{}'); } catch { p = {}; }
    if (typeof p.monto === 'number' && p.monto >= 0) estado.monto = p.monto;
    if ([3, 6, 12, 24].includes(p.meses)) estado.meses = p.meses;
    if (typeof p.aporte === 'number' && p.aporte >= 0) estado.aporte = p.aporte;
    if (['si', 'no', 'ambos'].includes(p.condicion)) estado.condicion = p.condicion;
    if (typeof p.orden === 'string') estado.orden = p.orden;
    if (['cuadricula', 'lista'].includes(p.vista)) estado.vista = p.vista;
    if (typeof p.ocultarIncompat === 'boolean') estado.ocultarIncompat = p.ocultarIncompat;
    if (p.chips && typeof p.chips === 'object') estado.chips = p.chips;
  }

  /* ── Utilidades de dominio ────────────────────────────── */
  const esDigital = (e) => /digital|web|app/i.test(e.apertura || '');
  const esPresencial = (e) => /presencial|agencia/i.test(e.apertura || '');
  const sinMantenimiento = (e) => /(^|[^0-9])0(\.00)?($|[^0-9])|sin costo|gratis/i.test(e.mantenimiento || 'S/0');

  function claseVerificacion(txt = '') {
    if (/^verificado/i.test(txt)) return 'verde';
    if (/reserva|verificar antes|requiere/i.test(txt)) return 'rojo';
    return 'ambar';
  }
  function etiquetaVerificacion(txt = '') {
    return { verde: 'Verificado', ambar: 'Verificación parcial', rojo: 'Requiere confirmación' }[claseVerificacion(txt)];
  }

  /** Señales de condición: a más señales, más exigente el producto. */
  function señalesCondicion(e) {
    const t = `${e.condicion || ''} ${e.vigencia || ''}`.toLowerCase();
    let n = 0;
    if (/nuevo/.test(t)) n += 1;
    if (/digital|app|100%/.test(t)) n += 1;
    if (/sueldo|planilla/.test(t)) n += 1;
    if (/m[ií]nimo|mantener|saldo/.test(t)) n += 1;
    if (/tope|hasta s\//.test(t)) n += 1;
    if (e.monto_minimo) n += 1;
    return n;
  }
  const requiereCondicion = (e) => señalesCondicion(e) > 0 && !/sin condici[oó]n|no exige/i.test(e.condicion || '');

  /** Última fecha dd/mm/aaaa hallada en la vigencia = fin de campaña. */
  function finCampana(e) {
    const fechas = (e.vigencia || '').match(/(\d{2})\/(\d{2})\/(\d{4})/g) || [];
    if (!fechas.length) return null;
    const ult = fechas[fechas.length - 1].split('/');
    return new Date(+ult[2], +ult[1] - 1, +ult[0]);
  }
  function estadoCampana(e) {
    const fin = finCampana(e);
    if (!fin) return { clase: '', txt: '', vencida: false };
    const dias = Math.ceil((fin - HOY) / 86400000);
    if (dias < 0) return { clase: 'rojo', txt: 'Campaña vencida', vencida: true };
    if (dias <= 7) return { clase: 'ambar', txt: `Vence en ${dias} día${dias === 1 ? '' : 's'}`, vencida: false };
    return { clase: 'verde', txt: 'Campaña vigente', vencida: false };
  }
  const topeDe = (e) => {
    const f = Datos.fichaDe(e.entidad);
    return f && f.simulador && f.simulador.tope_remunerado;
  };

  /* ── Cálculo por producto (delegado al motor) ─────────── */
  function calcular(e) {
    const cumple = estado.condicion !== 'no';
    const r = Fmt.proyectar(e, { monto: estado.monto, aporte: estado.aporte, meses: estado.meses, cumple });
    return {
      r,
      treaApl: r.treaAplicada,
      treaMax: e.trea || 0,
      interes: r.interesNeto,
      saldoFinal: r.saldoFinal,
      real: Fmt.retornoReal(r.treaAplicada, INFLACION_SUPUESTO),
      excedente: r.excedenteInicial,
      excedenteNoVerif: r.excedenteNoVerificado,
      señales: señalesCondicion(e),
      req: requiereCondicion(e),
    };
  }

  /** Devuelve { compatible, motivo }. No oculta: explica. */
  function clasificar(e, c) {
    const camp = estadoCampana(e);
    if (estado.monto < (e.monto_minimo || 0)) {
      return { compatible: false, motivo: `El monto no alcanza el mínimo de ${Fmt.moneyCorto(e.monto_minimo)}.` };
    }
    if (camp.vencida) return { compatible: false, motivo: 'La promoción venció; verifica la tasa vigente.' };
    if (estado.condicion === 'no' && c.req) {
      return { compatible: false, motivo: 'Requiere condiciones promocionales (cliente nuevo, digital o saldo mínimo).' };
    }
    if (estado.avanzados.apertura === 'digital' && !esDigital(e)) {
      return { compatible: false, motivo: 'La apertura es exclusivamente presencial.' };
    }
    return { compatible: true, motivo: null };
  }

  /* ── Filtro y orden ───────────────────────────────────── */
  function preparar() {
    return Datos.ranking().map((e, i) => {
      const c = calcular(e);
      const k = clasificar(e, c);
      return { e, c, k, orig: i };
    });
  }

  function pasaFiltros(x) {
    const { e, c, k } = x;
    if (estado.texto) {
      const heno = `${e.entidad} ${e.producto} ${e.grupo}`.toLowerCase();
      if (!heno.includes(estado.texto)) return false;
    }
    const ch = estado.chips;
    if (ch.digital && !esDigital(e)) return false;
    if (ch.sinMinimo && e.monto_minimo) return false;
    if (ch.sinMantenimiento && !sinMantenimiento(e)) return false;
    if (ch.verificado && claseVerificacion(e.verificacion) !== 'verde') return false;
    if (ch.fsd && e.fsd !== 'Sí') return false;
    if (ch.sinCondiciones && c.req) return false;
    if (ch.vigente && estadoCampana(e).vencida) return false;

    const a = estado.avanzados;
    if (a.trea && (e.trea || 0) < a.trea) return false;
    if (a.minimo !== '' && (e.monto_minimo || 0) > parseFloat(a.minimo)) return false;
    if (a.apertura === 'digital' && !esDigital(e)) return false;
    if (a.apertura === 'presencial' && !esPresencial(e)) return false;
    if (a.verif && claseVerificacion(e.verificacion) !== a.verif) return false;

    if (estado.ocultarIncompat && !k.compatible) return false;
    return true;
  }

  function ordenar(lista) {
    const fns = {
      ganancia: (a, b) => b.c.interes - a.c.interes,
      treaAplicable: (a, b) => b.c.treaApl - a.c.treaApl,
      treaMax: (a, b) => b.c.treaMax - a.c.treaMax,
      minimo: (a, b) => (a.e.monto_minimo || 0) - (b.e.monto_minimo || 0),
      condiciones: (a, b) => a.c.señales - b.c.señales || b.c.interes - a.c.interes,
      mantenimiento: (a, b) => (sinMantenimiento(b.e) - sinMantenimiento(a.e)) || b.c.interes - a.c.interes,
      digital: (a, b) => (esDigital(b.e) - esDigital(a.e)) || b.c.interes - a.c.interes,
      entidad: (a, b) => a.e.entidad.localeCompare(b.e.entidad, 'es'),
    };
    // Los incompatibles siempre al final cuando se muestran.
    lista.sort((a, b) => (a.k.compatible === b.k.compatible ? 0 : a.k.compatible ? -1 : 1)
      || (fns[estado.orden] || fns.ganancia)(a, b));
    return lista;
  }

  /* ── Render: estado, resumen, destacados ──────────────── */
  function pintarEstadoLinea() {
    const r = Datos.ranking();
    const live = Datos.estado.live || {};
    const fsd = (Datos.estado.base && Datos.estado.base.fsd) || (live.fsd);
    const cobertura = fsd && fsd.cobertura ? Fmt.moneyCorto(fsd.cobertura) : 'S/122,000';
    const cuando = live.actualizado_pe;
    const fresco = cuando
      ? `<span class="frescura ok">Datos actualizados ${Fmt.esc(cuando)}</span>`
      : `<span class="frescura base">Datos base · corte ${Fmt.esc(Datos.estado.base.corte)}</span>`;
    $('#ranking-estado').innerHTML =
      `${r.length} entidades verificadas · Cobertura FSD ${cobertura} por persona y entidad · ${fresco}`;
  }

  function pintarResumen(compat, todos) {
    const incompat = todos.length - compat.length;
    const mejor = compat.reduce((m, x) => (x.c.interes > (m ? m.c.interes : -1) ? x : m), null);
    const treaMaxPub = todos.reduce((m, x) => Math.max(m, x.c.treaMax), 0);
    const cond = { si: 'cumpliendo las condiciones', no: 'sin condiciones especiales', ambos: 'en el mejor escenario' }[estado.condicion];

    $('#resumen-personalizado').innerHTML = `
     <div class="resumen-cabecera">Para <strong>${Fmt.moneyCorto(estado.monto)}</strong> durante
      <strong>${estado.meses} meses</strong> <span class="sutil">(${cond})</span></div>
     <div class="resumen-cifras">
      <div class="resumen-dato"><span class="rd-valor">${todos.length}</span><span class="rd-etq">productos analizados</span></div>
      <div class="resumen-dato"><span class="rd-valor verde">${compat.length}</span><span class="rd-etq">compatibles con tu monto</span></div>
      <div class="resumen-dato"><span class="rd-valor ambar">${incompat}</span><span class="rd-etq">requieren verificar condiciones</span></div>
      <div class="resumen-dato destac"><span class="rd-valor">${mejor ? Fmt.money(mejor.c.interes) : '—'}</span><span class="rd-etq">ganancia máxima estimada${mejor ? ` · ${Fmt.esc(mejor.e.entidad)}` : ''}</span></div>
     </div>
     <p class="resumen-nota">La <strong>TREA aplicable</strong> a tu saldo puede ser menor que la
      TREA máxima publicada (${Fmt.pct(treaMaxPub)}): muchas campañas solo pagan la tasa alta hasta
      cierto saldo. Rendimiento real estimado con un supuesto de inflación de ${Fmt.pct(INFLACION_SUPUESTO)}
      anual (meta del BCRP), no una medición en vivo.</p>`;
  }

  function tarjetaDestacada(titulo, sub, x) {
    if (!x) return '';
    return `<article class="destacado">
      <div class="destacado-etq">${titulo}</div>
      <div class="destacado-entidad">
       <img src="${Datos.logoDe(x.e.entidad)}" alt="" width="28" height="28" loading="lazy" onerror="this.style.visibility='hidden'">
       <span>${Fmt.esc(x.e.entidad)}</span>
      </div>
      <div class="destacado-ganancia">${Fmt.money(x.c.interes)}</div>
      <div class="destacado-sub">${sub} · TREA aplicable ${Fmt.pct(x.c.treaApl)}</div>
      <button type="button" class="btn-secundario btn-mini" data-simular="${Fmt.esc(x.e.entidad)}">Simular</button>
     </article>`;
  }

  function pintarDestacados(compat) {
    const cont = $('#destacados');
    if (!compat.length) { cont.innerHTML = '<p class="vacio">Ningún producto es compatible con los datos ingresados.</p>'; return; }
    const porGanancia = [...compat].sort((a, b) => b.c.interes - a.c.interes);
    const mayor = porGanancia[0];
    const menosCond = [...compat].sort((a, b) => a.c.señales - b.c.señales || b.c.interes - a.c.interes)[0];
    const digital = porGanancia.find((x) => esDigital(x.e));

    const usados = new Set();
    const piezas = [];
    const añadir = (t, s, x) => {
      if (x && !usados.has(x.e.entidad)) { usados.add(x.e.entidad); piezas.push(tarjetaDestacada(t, s, x)); }
    };
    añadir('Mayor rendimiento estimado', 'Compatible con tus datos', mayor);
    añadir('Menos condiciones', 'Entre los compatibles', menosCond);
    añadir('Alternativa digital destacada', 'Apertura 100% digital', digital);
    cont.innerHTML = piezas.join('') || tarjetaDestacada('Mayor rendimiento estimado', 'Compatible con tus datos', mayor);
  }

  /* ── Render: tarjeta de producto ──────────────────────── */
  function tarjeta(x, puesto) {
    const { e, c, k } = x;
    const url = Fmt.urlSegura(e.url);
    const camp = estadoCampana(e);
    const vClase = claseVerificacion(e.verificacion);
    const seleccionado = estado.comparacion.includes(e.entidad);
    const tope = topeDe(e);
    const abierta = estado.vista === 'lista';

    const condiciones = (e.condicion || '')
      .split(/[;.]\s+/).map((s) => s.trim()).filter((s) => s.length > 3).slice(0, 4);

    const detalle = [
      ['Vigencia de la campaña', e.vigencia],
      ['Abono de intereses', e.abono],
      ['Capitalización', e.capitalizacion],
      ['Retiros y cajeros', e.retiros],
      ['Transferencias', e.transferencias],
      ['Grupo económico', e.grupo],
      ['Calificación SBS', e.calificacion],
      ['Estado de verificación', e.verificacion],
    ].filter(([, v]) => v).map(([kk, v]) => `<dt>${kk}</dt><dd>${Fmt.esc(v)}</dd>`).join('');

    return `
    <article class="producto ${k.compatible ? '' : 'incompatible'}" data-entidad="${Fmt.esc(e.entidad)}">
     <div class="producto-cab">
      <img class="producto-logo" src="${Datos.logoDe(e.entidad)}" alt="Logotipo de ${Fmt.esc(e.entidad)}" width="42" height="42" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="producto-id">
       <div class="producto-nombre">${Fmt.esc(e.entidad)}</div>
       <div class="producto-sub">${Fmt.esc(e.producto)}</div>
      </div>
      <div class="producto-puesto" title="Posición por ganancia estimada">#${puesto}</div>
     </div>

     ${k.compatible ? `
     <div class="producto-resultado">
      <div class="pr-ganancia">
       <span class="pr-valor">${Fmt.money(c.interes)}</span>
       <span class="pr-cap">Ganancia estimada en ${estado.meses} meses con ${Fmt.moneyCorto(estado.monto)}</span>
      </div>
      <div class="pr-tasas">
       <span><b>${Fmt.pct(c.treaApl)}</b> TREA aplicable</span>
       ${Math.abs(c.treaApl - c.treaMax) > 0.0001 ? `<span class="pr-max">${Fmt.pct(c.treaMax)} máx. publicada</span>` : ''}
      </div>
     </div>` : `
     <div class="producto-incompat">
      <span class="incompat-marca">Incompatible con tu selección</span>
      <span class="incompat-motivo">${Fmt.esc(k.motivo)}</span>
     </div>`}

     <dl class="producto-datos">
      <div><dt>Saldo final estimado</dt><dd>${Fmt.money(c.saldoFinal)}</dd></div>
      <div><dt>Tope remunerado</dt><dd>${isFinite(tope) && tope > 0 ? Fmt.moneyCorto(tope) : 'Todo el saldo'}</dd></div>
      <div><dt>Saldo en exceso</dt><dd>${c.excedente > 0 ? `${Fmt.moneyCorto(c.excedente)}${c.excedenteNoVerif ? ' · tasa regular no verificada' : ''}` : 'Ninguno'}</dd></div>
      <div><dt>Monto mínimo</dt><dd>${e.monto_minimo ? Fmt.moneyCorto(e.monto_minimo) : 'S/0'}</dd></div>
      <div><dt>Apertura</dt><dd>${esDigital(e) ? 'Digital' : 'Presencial'}</dd></div>
      <div><dt>Mantenimiento</dt><dd>${Fmt.esc(e.mantenimiento || '—')}</dd></div>
      <div><dt>Rend. real estimado</dt><dd>${Fmt.pct(c.real)}</dd></div>
      <div><dt>FSD</dt><dd>${e.fsd === 'Sí' ? 'Cubierto' : Fmt.esc(e.fsd || '—')}</dd></div>
     </dl>

     ${condiciones.length ? `
     <div class="producto-condicion">
      <span class="cond-titulo">Para acceder a esta tasa:</span>
      <ul>${condiciones.map((cc) => `<li>${Fmt.esc(cc)}</li>`).join('')}</ul>
     </div>` : ''}

     <div class="producto-estados">
      <span class="etiqueta ${vClase}">${etiquetaVerificacion(e.verificacion)}</span>
      ${camp.txt ? `<span class="etiqueta ${camp.clase}">${camp.txt}</span>` : ''}
      ${e.fsd === 'Sí' ? '<span class="etiqueta verde">FSD</span>' : ''}
      ${esDigital(e) ? '<span class="etiqueta azul">Digital</span>' : ''}
     </div>

     <details class="producto-mas" ${abierta ? 'open' : ''}>
      <summary>Ver todas las condiciones</summary>
      <dl class="detalle-cuerpo">${detalle}</dl>
     </details>

     <div class="producto-acciones">
      <button type="button" class="btn-comparar ${seleccionado ? 'activo' : ''}" data-comparar="${Fmt.esc(e.entidad)}"
       aria-pressed="${seleccionado}">${seleccionado ? '✓ Comparando' : 'Comparar'}</button>
      <button type="button" class="btn-secundario" data-simular="${Fmt.esc(e.entidad)}">Simular</button>
      ${url ? `<a class="btn-fuente" href="${url}" target="_blank" rel="noopener">Ver fuente oficial ↗</a>` : ''}
     </div>
    </article>`;
  }

  /* ── Bandeja y vista de comparación ───────────────────── */
  function pintarBandeja() {
    const n = estado.comparacion.length;
    const bandeja = $('#bandeja-comparacion');
    bandeja.hidden = n === 0;
    $('#bandeja-texto').textContent = `${n} producto${n === 1 ? '' : 's'} seleccionado${n === 1 ? '' : 's'}`;
    $('#bandeja-comparar').disabled = n < 2;
  }

  function alternarComparacion(nombre) {
    const i = estado.comparacion.indexOf(nombre);
    if (i >= 0) estado.comparacion.splice(i, 1);
    else if (estado.comparacion.length < 3) estado.comparacion.push(nombre);
    // Actualiza solo los botones afectados, sin re-render: conserva scroll y
    // los <details> abiertos, y evita recalcular todas las proyecciones.
    $$('[data-comparar]').forEach((b) => {
      const on = estado.comparacion.includes(b.dataset.comparar);
      b.classList.toggle('activo', on);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? '✓ Comparando' : 'Comparar';
    });
    pintarBandeja();
  }

  function abrirComparacion() {
    const items = estado.comparacion
      .map((n) => Datos.ranking().find((e) => e.entidad === n))
      .filter(Boolean)
      .map((e) => ({ e, c: calcular(e), k: clasificar(e, calcular(e)) }));
    if (items.length < 2) return;

    const filas = [
      ['TREA aplicable', (x) => Fmt.pct(x.c.treaApl)],
      ['TREA máxima publicada', (x) => Fmt.pct(x.c.treaMax)],
      ['Ganancia estimada', (x) => Fmt.money(x.c.interes)],
      ['Saldo final', (x) => Fmt.money(x.c.saldoFinal)],
      ['Tope remunerado', (x) => { const t = topeDe(x.e); return isFinite(t) && t > 0 ? Fmt.moneyCorto(t) : 'Todo el saldo'; }],
      ['Saldo en exceso', (x) => (x.c.excedente > 0 ? Fmt.moneyCorto(x.c.excedente) : 'Ninguno')],
      ['Monto mínimo', (x) => (x.e.monto_minimo ? Fmt.moneyCorto(x.e.monto_minimo) : 'S/0')],
      ['Mantenimiento', (x) => Fmt.esc(x.e.mantenimiento || '—')],
      ['Apertura', (x) => (esDigital(x.e) ? 'Digital' : 'Presencial')],
      ['Condición principal', (x) => Fmt.esc((x.e.condicion || '—').split(/[;.]/)[0])],
      ['FSD', (x) => (x.e.fsd === 'Sí' ? 'Cubierto' : Fmt.esc(x.e.fsd || '—'))],
      ['Verificación', (x) => etiquetaVerificacion(x.e.verificacion)],
      ['Campaña', (x) => estadoCampana(x.e).txt || '—'],
    ];

    const cabeceras = items.map((x) => `<th scope="col">
      <div class="comp-cab"><img src="${Datos.logoDe(x.e.entidad)}" alt="" width="24" height="24" onerror="this.style.visibility='hidden'">
      ${Fmt.esc(x.e.entidad)}</div><div class="sutil">${Fmt.esc(x.e.producto)}</div></th>`).join('');

    // Tabla (escritorio) + tarjetas apiladas (móvil), misma información.
    const tabla = `<div class="tabla-envoltura comp-tabla"><table class="tabla">
      <thead><tr><th scope="col">Criterio</th>${cabeceras}</tr></thead>
      <tbody>${filas.map(([lbl, fn]) => `<tr><th scope="row">${lbl}</th>${items.map((x) => `<td>${fn(x)}</td>`).join('')}</tr>`).join('')}</tbody>
     </table></div>`;

    const apiladas = `<div class="comp-apiladas">${items.map((x) => `
      <div class="comp-card">
       <div class="comp-card-tit"><img src="${Datos.logoDe(x.e.entidad)}" alt="" width="24" height="24" onerror="this.style.visibility='hidden'"> ${Fmt.esc(x.e.entidad)}</div>
       <dl>${filas.map(([lbl, fn]) => `<div><dt>${lbl}</dt><dd>${fn(x)}</dd></div>`).join('')}</dl>
      </div>`).join('')}</div>`;

    $('#comparacion-contenido').innerHTML = tabla + apiladas;
    const dlg = $('#dialogo-comparacion');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  /* ── Pintado principal ────────────────────────────────── */
  function pintar() {
    const todos = preparar();
    const compat = todos.filter((x) => x.k.compatible);

    pintarResumen(compat, todos);
    pintarDestacados(compat);

    const filtrados = ordenar(todos.filter(pasaFiltros));
    const cont = $('#rejilla-entidades');
    cont.className = estado.vista === 'lista' ? 'lista-entidades' : 'rejilla';
    cont.innerHTML = filtrados.length
      ? filtrados.map((x, i) => tarjeta(x, i + 1)).join('')
      : '<p class="vacio">Ningún producto coincide con tu selección. Prueba a quitar filtros o mostrar los incompatibles.</p>';

    $('#conteo-resultados').textContent =
      `${filtrados.length} de ${todos.length} productos${estado.ocultarIncompat ? ' (incompatibles ocultos)' : ''}.`;

    pintarBandeja();
  }

  const debounce = (fn, ms = 300) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };
  const pintarDebounced = debounce(pintar, 280);

  /* ── Metodología (se conserva) ────────────────────────── */
  function pintarMetodologia() {
    const notas = (Datos.estado.base && Datos.estado.base.notas) || [];
    const cab = notas.findIndex((f) => f[0] === 'Entidad/tema');
    let html = `
     <p><strong>TREA, no TEA.</strong> La TREA ya incluye comisiones y gastos, así que es la única cifra
      comparable entre entidades.</p>
     <p><strong>La ganancia estimada usa tu monto.</strong> Se aplica la escala de tasas real de cada
      entidad y su tope remunerado: el saldo por encima del tope no gana la tasa promocional.</p>
     <p><strong>Las campañas caducan.</strong> Verifica el tarifario el día que abras la cuenta: la tasa
      vigente es la del contrato, no la de este portal.</p>
     <p><strong>Rendimiento real.</strong> Se estima con un supuesto de inflación de ${Fmt.pct(INFLACION_SUPUESTO)}
      anual (meta del BCRP). Es un supuesto, no una medición en vivo.</p>`;
    if (cab >= 0) {
      const filas = notas.slice(cab + 1).filter((f) => f[0] && f[2]);
      html += `<div class="tabla-envoltura"><table class="tabla">
        <caption>Registro de fuentes consultadas</caption>
        <thead><tr><th scope="col">Entidad / tema</th><th scope="col">Tipo</th><th scope="col">Confianza</th><th scope="col">Fuente</th></tr></thead>
        <tbody>${filas.map((f) => {
          const u = Fmt.urlSegura(f[2]);
          return `<tr><td>${Fmt.esc(f[0])}</td><td>${Fmt.esc(f[1] || '')}</td><td>${Fmt.esc(f[4] || '')}</td>
            <td>${u ? `<a href="${u}" target="_blank" rel="noopener">Abrir</a>` : '—'}</td></tr>`;
        }).join('')}</tbody></table></div>`;
    }
    $('#notas-metodologia').innerHTML = html;
  }

  /* ── Sincronización UI ↔ estado ───────────────────────── */
  function reflejarEntradas() {
    $('#dec-monto').value = estado.monto;
    $('#dec-aporte').value = estado.aporte;
    $$('#dec-plazo .seg').forEach((b) => {
      const on = +b.dataset.plazo === estado.meses;
      b.classList.toggle('activa', on); b.setAttribute('aria-pressed', String(on));
    });
    $$('#dec-condicion .seg').forEach((b) => {
      const on = b.dataset.cond === estado.condicion;
      b.classList.toggle('activa', on); b.setAttribute('aria-pressed', String(on));
    });
    $('#f-orden').value = estado.orden;
    $('#toggle-incompatibles').checked = estado.ocultarIncompat;
    $$('.chip-filtro').forEach((b) => {
      const on = !!estado.chips[b.dataset.filtro];
      b.classList.toggle('activo', on); b.setAttribute('aria-pressed', String(on));
    });
    $$('[data-vista]').forEach((b) => {
      const on = b.dataset.vista === estado.vista;
      b.classList.toggle('activa', on); b.setAttribute('aria-pressed', String(on));
    });
    actualizarContadorFiltros();
  }

  function actualizarContadorFiltros() {
    const n = Object.values(estado.chips).filter(Boolean).length
      + (estado.avanzados.trea ? 1 : 0) + (estado.avanzados.apertura ? 1 : 0)
      + (estado.avanzados.minimo !== '' ? 1 : 0) + (estado.avanzados.verif ? 1 : 0);
    const badge = $('#f-activos');
    badge.hidden = n === 0; badge.textContent = n;
  }

  function bindEventos() {
    // Monto: input con debounce + botones rápidos.
    $('#dec-monto').addEventListener('input', () => {
      estado.monto = Math.max(0, parseFloat($('#dec-monto').value) || 0);
      guardarPrefs(); pintarDebounced();
    });
    $$('#dec-monto-rapidos .chip').forEach((b) => b.addEventListener('click', () => {
      estado.monto = +b.dataset.monto; reflejarEntradas(); guardarPrefs(); pintar();
    }));
    $('#dec-aporte').addEventListener('input', () => {
      estado.aporte = Math.max(0, parseFloat($('#dec-aporte').value) || 0);
      guardarPrefs(); pintarDebounced();
    });
    $('#dec-plazo').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-plazo]'); if (!b) return;
      estado.meses = +b.dataset.plazo; reflejarEntradas(); guardarPrefs(); pintar();
    });
    $('#dec-condicion').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-cond]'); if (!b) return;
      estado.condicion = b.dataset.cond; reflejarEntradas(); guardarPrefs(); pintar();
    });
    $('#barra-decision').addEventListener('submit', (ev) => { ev.preventDefault(); pintar(); });

    // Filtros
    $('#f-texto').addEventListener('input', () => { estado.texto = $('#f-texto').value.trim().toLowerCase(); pintarDebounced(); });
    $('#f-orden').addEventListener('change', () => { estado.orden = $('#f-orden').value; guardarPrefs(); pintar(); });
    $('#btn-filtros').addEventListener('click', () => {
      const drawer = $('#filtros-avanzados');
      const abrir = drawer.hidden;
      drawer.hidden = !abrir;
      $('#btn-filtros').setAttribute('aria-expanded', String(abrir));
    });
    $$('.chip-filtro').forEach((b) => b.addEventListener('click', () => {
      estado.chips[b.dataset.filtro] = !estado.chips[b.dataset.filtro];
      reflejarEntradas(); guardarPrefs(); pintar();
    }));
    ['#f-trea', '#f-apertura', '#f-minimo', '#f-verif'].forEach((s) => {
      const el = $(s); if (!el) return;
      el.addEventListener('change', () => {
        estado.avanzados = {
          trea: parseFloat($('#f-trea').value) || 0,
          apertura: $('#f-apertura').value,
          minimo: $('#f-minimo').value,
          verif: $('#f-verif').value,
        };
        actualizarContadorFiltros(); pintar();
      });
    });
    $('#f-limpiar').addEventListener('click', () => {
      estado.chips = {}; estado.avanzados = { trea: 0, apertura: '', minimo: '', verif: '' };
      $('#f-trea').value = '0'; $('#f-apertura').value = ''; $('#f-minimo').value = ''; $('#f-verif').value = '';
      reflejarEntradas(); guardarPrefs(); pintar();
    });
    $('#toggle-incompatibles').addEventListener('change', () => {
      estado.ocultarIncompat = $('#toggle-incompatibles').checked; guardarPrefs(); pintar();
    });
    $$('[data-vista]').forEach((b) => b.addEventListener('click', () => {
      estado.vista = b.dataset.vista; reflejarEntradas(); guardarPrefs(); pintar();
    }));

    // Delegación en la rejilla: comparar / simular.
    $('#rejilla-entidades').addEventListener('click', (ev) => {
      const cmp = ev.target.closest('[data-comparar]');
      if (cmp) { alternarComparacion(cmp.dataset.comparar); return; }
      const sim = ev.target.closest('[data-simular]');
      if (sim) { App.irA('simulador'); Simulador.seleccionar(sim.dataset.simular); }
    });
    // Destacados también permiten simular.
    $('#destacados').addEventListener('click', (ev) => {
      const sim = ev.target.closest('[data-simular]');
      if (sim) { App.irA('simulador'); Simulador.seleccionar(sim.dataset.simular); }
    });

    // Bandeja de comparación.
    $('#bandeja-comparar').addEventListener('click', abrirComparacion);
    $('#bandeja-limpiar').addEventListener('click', () => { estado.comparacion = []; pintar(); });
    $('#cerrar-comparacion').addEventListener('click', () => {
      const d = $('#dialogo-comparacion');
      if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
    });
  }

  function iniciar() {
    cargarPrefs();
    bindEventos();
  }

  function render() {
    reflejarEntradas();
    pintarEstadoLinea();
    pintarMetodologia();
    pintar();
  }

  return { iniciar, render };
})();
