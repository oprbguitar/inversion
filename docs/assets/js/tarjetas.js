/* Pestaña Tarjetas de crédito: listado comparable + simulador de cuotas.
 *
 * Las tasas de tarjeta no tienen fuente automatizable: la SBS (unico
 * consolidado oficial) esta tras proteccion anti-bot y las entidades no
 * publican API. El dataset es curado y cada tarjeta declara su nivel de
 * verificacion y enlaza a la pagina oficial del producto.
 */
const Tarjetas = (() => {
  let datos = null;
  let vista = 'cuadricula';
  try { vista = localStorage.getItem('vista_tarjetas') || 'cuadricula'; } catch { /* modo privado */ }

  const $ = (s) => document.querySelector(s);
  const lista = () => (datos ? datos.tarjetas : []);

  async function cargar() {
    if (datos) return datos;
    const r = await fetch('data/tarjetas.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    datos = await r.json();
    return datos;
  }

  /* ── Matematica del credito ─────────────────────────────
   * Cuota de una deuda en cuotas fijas (sistema frances):
   *   cuota = P * i / (1 - (1+i)^-n)
   * con i = tasa mensual equivalente de la TCEA: (1+TCEA)^(1/12) - 1.
   * Se usa TCEA y no TEA porque la TCEA ya incluye comisiones y seguros,
   * que es lo que realmente termina pagando el usuario.
   */
  function cuotaMensual(principal, tcea, meses) {
    const i = Math.pow(1 + tcea, 1 / 12) - 1;
    if (i <= 0) return principal / meses;
    return (principal * i) / (1 - Math.pow(1 + i, -meses));
  }

  function simular(tarjeta, monto, meses) {
    const tcea = tarjeta.tcea_ref;
    const cuota = cuotaMensual(monto, tcea, meses);
    const total = cuota * meses;
    return {
      tcea,
      cuota,
      total,
      interes: total - monto,
      sobrecosto: monto ? (total - monto) / monto : 0,
      conMembresia: total + (tarjeta.membresia || 0) * Math.ceil(meses / 12),
    };
  }

  /** Escenario de pago mínimo: por qué el revolving es caro. */
  function pagoMinimo(monto, tcea, pctMinimo = 0.05) {
    const i = Math.pow(1 + tcea, 1 / 12) - 1;
    let saldo = monto;
    let pagado = 0;
    let meses = 0;
    while (saldo > 1 && meses < 600) {
      const interes = saldo * i;
      const cuota = Math.max(saldo * pctMinimo, 20);
      const abono = Math.min(cuota, saldo + interes);
      saldo = saldo + interes - abono;
      pagado += abono;
      meses += 1;
    }
    return { meses, pagado, interes: pagado - monto };
  }

  /* ── Render ─────────────────────────────────────────── */

  function claseVerif(t) {
    return /leídas de su página oficial/i.test(t.verificacion || '') ? 'verde' : 'ambar';
  }

  function tarjetaHTML(t) {
    const url = Fmt.urlSegura(t.url);
    return `
    <article class="entidad">
     <div class="entidad-cabecera">
      <img class="entidad-logo" src="${Datos.logoDe(t.entidad)}" alt="" width="46" height="46" loading="lazy"
       onerror="this.style.visibility='hidden'">
      <div class="entidad-id">
       <div class="entidad-nombre">${Fmt.esc(t.entidad)}</div>
       <div class="entidad-producto">${Fmt.esc(t.tarjeta)}</div>
      </div>
     </div>
     <div class="entidad-tasa">
      <span class="tasa-valor tasa-costo">${Fmt.pct(t.tcea_ref)}</span>
      <span class="tasa-etiqueta">TCEA referencial</span>
     </div>
     <div class="etiquetas">
      ${!t.membresia ? '<span class="etiqueta verde">Sin membresía</span>' : `<span class="etiqueta ambar">Membresía ${Fmt.moneyCorto(t.membresia)}</span>`}
      <span class="etiqueta azul">${Fmt.esc(t.marca)}</span>
      <span class="etiqueta ${claseVerif(t)}">${claseVerif(t) === 'verde' ? 'Leído de fuente oficial' : 'Referencial'}</span>
     </div>
     <dl class="entidad-datos">
      <div class="dato"><dt>TEA de compras</dt><dd>${Fmt.pct(t.tea_min)} – ${Fmt.pct(t.tea_max)}</dd></div>
      <div class="dato"><dt>Línea mínima</dt><dd>${Fmt.moneyCorto(t.linea_min)}</dd></div>
      <div class="dato"><dt>Ingreso mínimo</dt><dd>${Fmt.moneyCorto(t.ingreso_min)}</dd></div>
      ${t.tcea_max_publicada ? `<div class="dato"><dt>TCEA máxima publicada</dt><dd class="alerta-tasa">${Fmt.pct(t.tcea_max_publicada)}</dd></div>` : ''}
     </dl>
     <p class="entidad-alerta">${Fmt.esc(t.beneficios)}</p>
     <details class="entidad-detalle">
      <summary>Ver verificación y fuente</summary>
      <dl class="detalle-cuerpo">
       <dt>Estado del dato</dt><dd>${Fmt.esc(t.verificacion)}</dd>
      </dl>
      <div class="entidad-acciones">
       ${url ? `<a class="btn-primario" href="${url}" target="_blank" rel="noopener">Página oficial</a>` : ''}
       <button type="button" class="btn-secundario" data-simular-tarjeta="${Fmt.esc(t.tarjeta)}">Simular</button>
      </div>
     </details>
    </article>`;
  }

  function filaHTML(t) {
    const url = Fmt.urlSegura(t.url);
    return `
    <article class="fila-entidad">
     <div class="fila-cabecera">
      <img class="entidad-logo" src="${Datos.logoDe(t.entidad)}" alt="" width="46" height="46" loading="lazy"
       onerror="this.style.visibility='hidden'">
      <div class="entidad-id">
       <div class="entidad-nombre">${Fmt.esc(t.entidad)}</div>
       <div class="entidad-producto">${Fmt.esc(t.tarjeta)} · ${Fmt.esc(t.marca)}</div>
      </div>
      <div class="fila-tasa">
       <span class="tasa-valor tasa-costo">${Fmt.pct(t.tcea_ref)}</span>
       <span class="tasa-etiqueta">TCEA</span>
      </div>
     </div>
     <div class="etiquetas">
      ${!t.membresia ? '<span class="etiqueta verde">Sin membresía</span>' : `<span class="etiqueta ambar">Membresía ${Fmt.moneyCorto(t.membresia)}</span>`}
      <span class="etiqueta ${claseVerif(t)}">${Fmt.esc(t.verificacion)}</span>
     </div>
     <dl class="fila-detalle">
      <div><dt>TEA de compras</dt><dd>${Fmt.pct(t.tea_min)} – ${Fmt.pct(t.tea_max)}</dd></div>
      <div><dt>TCEA referencial</dt><dd>${Fmt.pct(t.tcea_ref)}</dd></div>
      <div><dt>Membresía anual</dt><dd>${t.membresia ? Fmt.money(t.membresia) : 'Sin costo'}</dd></div>
      <div><dt>Línea mínima</dt><dd>${Fmt.moneyCorto(t.linea_min)}</dd></div>
      <div><dt>Ingreso mínimo</dt><dd>${Fmt.moneyCorto(t.ingreso_min)}</dd></div>
      <div><dt>Beneficios</dt><dd>${Fmt.esc(t.beneficios)}</dd></div>
     </dl>
     <div class="fila-acciones">
      ${url ? `<a class="btn-primario" href="${url}" target="_blank" rel="noopener">Ir a la página oficial</a>` : ''}
      <button type="button" class="btn-secundario" data-simular-tarjeta="${Fmt.esc(t.tarjeta)}">Simular con esta tarjeta</button>
      ${url ? `<a class="enlace-crudo" href="${url}" target="_blank" rel="noopener">${Fmt.esc(url)}</a>` : ''}
     </div>
    </article>`;
  }

  function pintarListado() {
    const cont = $('#rejilla-tarjetas');
    let items = [...lista()];

    const texto = $('#t-buscar').value.trim().toLowerCase();
    const tipo = $('#t-tipo').value;
    const orden = $('#t-orden').value;

    if (texto) items = items.filter((t) => `${t.entidad} ${t.tarjeta} ${t.marca}`.toLowerCase().includes(texto));
    if (tipo) items = items.filter((t) => t.tipo === tipo);
    if (tipo === 'sin_membresia') items = lista().filter((t) => !t.membresia);

    items.sort({
      tcea: (a, b) => a.tcea_ref - b.tcea_ref,
      tcea_desc: (a, b) => b.tcea_ref - a.tcea_ref,
      entidad: (a, b) => a.entidad.localeCompare(b.entidad, 'es'),
      linea: (a, b) => a.linea_min - b.linea_min,
    }[orden]);

    $('#t-conteo').textContent = `${items.length} de ${lista().length} tarjetas · ordenadas por TCEA (menor = más barata)`;
    cont.className = vista === 'lista' ? 'lista-entidades' : 'rejilla';
    cont.innerHTML = items.length
      ? items.map(vista === 'lista' ? filaHTML : tarjetaHTML).join('')
      : '<p class="vacio">Ninguna tarjeta coincide con esos filtros.</p>';

    cont.querySelectorAll('[data-simular-tarjeta]').forEach((b) => {
      b.addEventListener('click', () => {
        $('#t-sim-tarjeta').value = b.dataset.simularTarjeta;
        calcular();
        document.getElementById('sim-tarjetas').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function pintarKpis() {
    const l = lista();
    if (!l.length) return;
    const min = l.reduce((a, b) => (a.tcea_ref < b.tcea_ref ? a : b));
    const prom = l.reduce((s, t) => s + t.tcea_ref, 0) / l.length;
    const ahorro = Datos.ranking()[0];

    const veces = (prom / (ahorro.trea || 1)).toFixed(0);

    $('#tarjetas-kpis').innerHTML = [
      ['Tarjetas comparadas', l.length, `${l.filter((t) => !t.membresia).length} sin membresía`],
      ['TCEA más baja', Fmt.pct(min.tcea_ref), Fmt.esc(min.entidad)],
      ['TCEA promedio', Fmt.pct(prom), 'Incluye comisiones y seguros'],
      ['Deber vs. ahorrar', `${veces}×`,
        `Tarjeta ${Fmt.pct(prom)} frente al mejor ahorro ${Fmt.pct(ahorro.trea)}`],
    ].map(([et, val, nota]) => `
      <div class="kpi kpi-costo"><div class="kpi-etiqueta">${et}</div>
       <div class="kpi-valor">${val}</div><div class="kpi-nota">${nota}</div></div>`).join('');
  }

  function calcular() {
    const monto = Math.max(0, parseFloat($('#t-monto').value) || 0);
    const meses = parseInt($('#t-cuotas').value, 10) || 12;
    const t = lista().find((x) => x.tarjeta === $('#t-sim-tarjeta').value) || lista()[0];
    if (!t) return;

    $('#t-cuotas-txt').textContent = `${meses} ${meses === 1 ? 'cuota' : 'cuotas'}`;

    const r = simular(t, monto, meses);
    const min = pagoMinimo(monto, t.tcea_ref);

    $('#t-sim-kpis').innerHTML = [
      ['Cuota mensual', Fmt.money(r.cuota), `${meses} cuotas fijas`],
      ['Intereses y costos', Fmt.money(r.interes), `${(r.sobrecosto * 100).toFixed(1)}% sobre lo consumido`],
      ['Total a pagar', Fmt.money(r.total), `TCEA ${Fmt.pct(r.tcea)}`],
      ['Si pagas el mínimo', Fmt.money(min.interes), `${min.meses} meses en pagarla`],
    ].map(([et, val, nota]) => `
      <div class="kpi kpi-costo"><div class="kpi-etiqueta">${et}</div>
       <div class="kpi-valor">${val}</div><div class="kpi-nota">${nota}</div></div>`).join('');

    // Comparativa: el mismo consumo en todas las tarjetas.
    const filas = lista().map((x) => ({ x, r: simular(x, monto, meses) }))
      .sort((a, b) => a.r.total - b.r.total);
    $('#t-tabla-comparativa tbody').innerHTML = filas.map(({ x, r }, i) => `
      <tr class="${i === 0 ? 'destacada' : ''}">
       <td class="num">${i + 1}</td>
       <td><div class="celda-entidad">
         <img src="${Datos.logoDe(x.entidad)}" alt="" width="24" height="24" loading="lazy"
          onerror="this.style.visibility='hidden'">
         <span>${Fmt.esc(x.entidad)}<br><small class="sutil">${Fmt.esc(x.tarjeta)}</small></span></div></td>
       <td class="num">${Fmt.pct(x.tcea_ref)}</td>
       <td class="num">${Fmt.money(r.cuota)}</td>
       <td class="num">${Fmt.money(r.interes)}</td>
       <td class="num">${Fmt.money(r.total)}</td>
      </tr>`).join('');

    // Aviso comparando con el rendimiento del ahorro.
    const ahorro = Datos.ranking()[0];
    $('#t-sim-aviso').innerHTML = `<div class="aviso"><strong>Perspectiva.</strong>
      Financiar ${Fmt.money(monto)} a ${meses} cuotas con esta tarjeta cuesta
      <strong>${Fmt.money(r.interes)}</strong> en intereses y comisiones. Ese mismo monto ahorrado en
      ${Fmt.esc(ahorro.entidad)} a ${Fmt.pct(ahorro.trea)} rendiría alrededor de
      <strong>${Fmt.money(Fmt.proyectar(ahorro, { monto, meses, cumple: true }).interesTotal)}</strong>
      en el mismo plazo. Deber siempre cuesta bastante más de lo que rinde ahorrar.</div>`;

    Graficos.linea(
      document.getElementById('t-grafico'),
      Array.from({ length: meses }, (_, k) => ({ x: `M${k + 1}`, y: r.cuota * (k + 1) })),
      { fmtY: (v) => Fmt.moneyCorto(v) },
    );
  }

  function cambiarVista(nueva) {
    vista = nueva;
    try { localStorage.setItem('vista_tarjetas', nueva); } catch { /* modo privado */ }
    document.querySelectorAll('[data-vista-t]').forEach((b) => {
      const activo = b.dataset.vistaT === nueva;
      b.classList.toggle('activa', activo);
      b.setAttribute('aria-pressed', String(activo));
    });
    pintarListado();
  }

  function pintarAvisos() {
    $('#tarjetas-metodologia').innerHTML = `
     <p>${Fmt.esc(datos.metodologia)}</p>
     <p><strong>Compara por TCEA, no por TEA.</strong> ${Fmt.esc(datos.campos.tcea)}</p>
     <p><a href="${Fmt.urlSegura(datos.fuente_oficial)}" target="_blank" rel="noopener">
      Comparador oficial Retasas de la SBS</a> — la única fuente consolidada y vinculante.</p>`;
    $('#tarjetas-aviso').innerHTML = `<div class="aviso"><strong>Cifras referenciales.</strong>
      ${Fmt.esc(datos.aviso)}</div>`;
  }

  async function iniciar() {
    ['#t-buscar', '#t-tipo', '#t-orden'].forEach((s) => {
      const el = $(s);
      if (el) { el.addEventListener('input', pintarListado); el.addEventListener('change', pintarListado); }
    });
    ['#t-monto', '#t-cuotas', '#t-sim-tarjeta'].forEach((s) => {
      const el = $(s);
      if (el) { el.addEventListener('input', calcular); el.addEventListener('change', calcular); }
    });
    document.querySelectorAll('[data-vista-t]').forEach((b) => {
      b.addEventListener('click', () => cambiarVista(b.dataset.vistaT));
    });
  }

  async function render() {
    try {
      await cargar();
    } catch (e) {
      $('#tarjetas-aviso').innerHTML = `<div class="aviso error">No se pudo cargar el listado de tarjetas: ${Fmt.esc(e.message)}</div>`;
      return;
    }
    $('#t-sim-tarjeta').innerHTML = lista()
      .map((t) => `<option value="${Fmt.esc(t.tarjeta)}">${Fmt.esc(t.entidad)} — ${Fmt.pct(t.tcea_ref)}</option>`).join('');
    pintarKpis();
    pintarAvisos();
    cambiarVista(vista);
    calcular();
  }

  return { iniciar, render, simular, cuotaMensual, pagoMinimo };
})();
