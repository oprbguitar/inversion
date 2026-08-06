/* Pestaña Ranking: KPIs, filtros y tarjetas por entidad. */
const Ranking = (() => {
  let filtrados = [];

  const $ = (s) => document.querySelector(s);

  const esDigital = (e) => /digital|web|app/i.test(e.apertura || '');
  const esPresencial = (e) => /presencial|agencia/i.test(e.apertura || '');

  function claseVerificacion(txt = '') {
    if (/^verificado/i.test(txt)) return 'verde';
    if (/reserva|verificar antes/i.test(txt)) return 'rojo';
    return 'ambar';
  }

  function pintarKpis() {
    const r = Datos.ranking();
    if (!r.length) return;
    const mejor = r[0];
    const bcrp = Datos.bcrp();
    const sinMinimo = r.filter((e) => !e.monto_minimo).length;
    const promedio = r.reduce((s, e) => s + (e.trea || 0), 0) / r.length;

    $('#resumen-kpis').innerHTML = [
      ['Entidades comparadas', r.length, 'Todas supervisadas por la SBS y miembros del FSD'],
      ['TREA más alta', Fmt.pct(mejor.trea), Fmt.esc(mejor.entidad)],
      ['TREA promedio', Fmt.pct(promedio), `Tasa BCRP: ${Fmt.pct(bcrp.vigente)}`],
      ['Sin monto mínimo', sinMinimo, 'Cuentas que abren desde S/0'],
    ].map(([et, val, nota]) => `
      <div class="kpi">
       <div class="kpi-etiqueta">${et}</div>
       <div class="kpi-valor">${val}</div>
       <div class="kpi-nota">${nota}</div>
      </div>`).join('');
  }

  function aplicarFiltros() {
    const texto = $('#f-texto').value.trim().toLowerCase();
    const treaMin = parseFloat($('#f-trea').value) || 0;
    const apertura = $('#f-apertura').value;
    const minimo = $('#f-minimo').value;
    const orden = $('#f-orden').value;

    filtrados = Datos.ranking().filter((e) => {
      if ((e.trea || 0) < treaMin) return false;
      if (apertura === 'digital' && !esDigital(e)) return false;
      if (apertura === 'presencial' && !esPresencial(e)) return false;
      if (minimo !== '' && (e.monto_minimo || 0) > parseFloat(minimo)) return false;
      if (texto) {
        const heno = `${e.entidad} ${e.producto} ${e.grupo} ${e.condicion}`.toLowerCase();
        if (!heno.includes(texto)) return false;
      }
      return true;
    });

    const orden_fn = {
      trea: (a, b) => (b.trea || 0) - (a.trea || 0),
      minimo: (a, b) => (a.monto_minimo || 0) - (b.monto_minimo || 0),
      entidad: (a, b) => a.entidad.localeCompare(b.entidad, 'es'),
    }[orden];
    filtrados.sort(orden_fn);

    pintarTarjetas();
  }

  function tarjeta(e, i) {
    const ficha = Datos.fichaDe(e.entidad);
    const url = Fmt.urlSegura(e.url);
    const puesto = Datos.ranking().findIndex((x) => x.entidad === e.entidad) + 1;

    const etiquetas = [
      e.fsd === 'Sí' ? '<span class="etiqueta verde">Cubierto por FSD</span>' : '',
      esDigital(e) ? '<span class="etiqueta azul">Apertura digital</span>' : '',
      !e.monto_minimo ? '<span class="etiqueta verde">Sin monto mínimo</span>' : '',
      e.calificacion && !/no visible/i.test(e.calificacion)
        ? `<span class="etiqueta">SBS ${Fmt.esc(e.calificacion.replace(/\s*\(.*\)/, ''))}</span>` : '',
      `<span class="etiqueta ${claseVerificacion(e.verificacion)}">${Fmt.esc(e.verificacion || '')}</span>`,
    ].filter(Boolean).join('');

    const tramos = (ficha && ficha.tramos || []).length > 1
      ? `<dt>Escala de tasas por saldo</dt><dd><ul class="tramos">${
          ficha.tramos.map((t) => `<li><span>${Fmt.esc(t.desc || `Desde ${Fmt.moneyCorto(t.desde)}`)}</span><b>${Fmt.pct(t.trea)}</b></li>`).join('')
        }</ul></dd>` : '';

    const detalle = [
      ['Condición clave', e.condicion],
      ['Vigencia de la campaña', e.vigencia],
      ['Abono de intereses', e.abono],
      ['Capitalización', e.capitalizacion],
      ['Mantenimiento', e.mantenimiento],
      ['Retiros y cajeros', e.retiros],
      ['Transferencias', e.transferencias],
      ['Grupo económico', e.grupo],
    ].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${Fmt.esc(v)}</dd>`).join('');

    return `
    <article class="entidad">
     <div class="entidad-cabecera">
      <img class="entidad-logo" src="${Datos.logoDe(e.entidad)}" alt="Logotipo de ${Fmt.esc(e.entidad)}" loading="lazy" width="46" height="46">
      <div class="entidad-id">
       <div class="entidad-nombre">${Fmt.esc(e.entidad)}</div>
       <div class="entidad-producto">${Fmt.esc(e.producto)}</div>
      </div>
      <div class="entidad-puesto" data-top="${puesto === 1 ? 1 : 0}" title="Puesto ${puesto} por TREA">${puesto}</div>
     </div>

     <div class="entidad-tasa">
      <span class="tasa-valor">${Fmt.pct(e.trea)}</span>
      <span class="tasa-etiqueta">TREA verificada</span>
     </div>

     <div class="etiquetas">${etiquetas}</div>

     <dl class="entidad-datos">
      <div class="dato"><dt>Monto mínimo de apertura</dt><dd>${e.monto_minimo ? Fmt.moneyCorto(e.monto_minimo) : 'S/0'}</dd></div>
      <div class="dato"><dt>Saldo para la tasa máxima</dt><dd>${e.saldo_tasa_max ? Fmt.moneyCorto(e.saldo_tasa_max) : 'Sin condición'}</dd></div>
      <div class="dato"><dt>Modo de apertura</dt><dd>${Fmt.esc(e.apertura || '—')}</dd></div>
     </dl>

     ${e.alertas ? `<p class="entidad-alerta">${Fmt.esc(e.alertas)}</p>` : ''}

     <details class="entidad-detalle">
      <summary>Ver condiciones completas y fuentes</summary>
      <dl class="detalle-cuerpo">${detalle}${tramos}</dl>
      <div class="entidad-acciones">
       ${url ? `<a class="btn-primario" href="${url}" target="_blank" rel="noopener">Página oficial</a>` : ''}
       <button type="button" class="btn-secundario" data-simular="${Fmt.esc(e.entidad)}">Simular</button>
      </div>
     </details>
    </article>`;
  }

  function pintarTarjetas() {
    const cont = document.getElementById('rejilla-entidades');
    const total = Datos.ranking().length;

    document.getElementById('conteo-resultados').textContent =
      filtrados.length === total
        ? `Mostrando las ${total} entidades del ranking.`
        : `${filtrados.length} de ${total} entidades coinciden con los filtros.`;

    cont.innerHTML = filtrados.length
      ? filtrados.map(tarjeta).join('')
      : '<p class="vacio">Ninguna entidad coincide con esos filtros. Prueba a limpiarlos.</p>';

    cont.querySelectorAll('[data-simular]').forEach((b) => {
      b.addEventListener('click', () => {
        App.irA('simulador');
        Simulador.seleccionar(b.dataset.simular);
      });
    });
  }

  function pintarMetodologia() {
    const notas = (Datos.estado.base && Datos.estado.base.notas) || [];
    const cab = notas.findIndex((f) => f[0] === 'Entidad/tema');
    let html = `
     <p><strong>TREA, no TEA.</strong> La TREA (Tasa de Rendimiento Efectivo Anual) ya incluye comisiones y
      gastos del producto, así que es la única cifra realmente comparable entre entidades. Una TEA alta con
      mantenimiento mensual puede rendir menos que una TREA menor sin comisiones.</p>
     <p><strong>Casi todas las tasas altas tienen condiciones.</strong> Suelen exigir cliente nuevo, apertura
      100% digital, abono de sueldo o un saldo mínimo, y muchas limitan el saldo remunerado
      (por ejemplo, pagan la tasa promocional solo hasta S/3,000 y el exceso a tasa regular).</p>
     <p><strong>Las campañas caducan.</strong> Cada tarjeta indica la vigencia declarada. Verifica el tarifario
      el día que abras la cuenta: la tasa vigente es la del contrato que firmas, no la de este portal.</p>
     <p><strong>Estado de verificación.</strong> Verde = confirmado en fuente oficial. Ámbar = tasa confirmada
      con algún dato pendiente. Rojo = requiere verificación directa antes de contratar.</p>`;

    if (cab >= 0) {
      const filas = notas.slice(cab + 1).filter((f) => f[0] && f[2]);
      html += `<div class="tabla-envoltura"><table class="tabla">
        <caption>Registro de fuentes consultadas</caption>
        <thead><tr><th scope="col">Entidad / tema</th><th scope="col">Tipo</th><th scope="col">Nivel de confianza</th><th scope="col">Fuente</th></tr></thead>
        <tbody>${filas.map((f) => {
          const u = Fmt.urlSegura(f[2]);
          return `<tr><td>${Fmt.esc(f[0])}</td><td>${Fmt.esc(f[1] || '')}</td><td>${Fmt.esc(f[4] || '')}</td>
            <td>${u ? `<a href="${u}" target="_blank" rel="noopener">Abrir</a>` : '—'}</td></tr>`;
        }).join('')}</tbody></table></div>`;
    }
    document.getElementById('notas-metodologia').innerHTML = html;
  }

  function iniciar() {
    ['#f-texto', '#f-trea', '#f-apertura', '#f-minimo', '#f-orden'].forEach((s) => {
      const el = $(s);
      el.addEventListener('input', aplicarFiltros);
      el.addEventListener('change', aplicarFiltros);
    });
    $('#f-limpiar').addEventListener('click', () => {
      $('#f-texto').value = ''; $('#f-trea').value = '0';
      $('#f-apertura').value = ''; $('#f-minimo').value = ''; $('#f-orden').value = 'trea';
      aplicarFiltros();
    });
  }

  const render = () => { pintarKpis(); aplicarFiltros(); pintarMetodologia(); };

  return { iniciar, render, get filtrados() { return filtrados; } };
})();
