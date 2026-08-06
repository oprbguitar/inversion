/* Pestaña Mercado: productos publicados por comparabien.com.pe.
 *
 * comparabien no expone API ni cabeceras CORS, asi que el navegador no puede
 * leerla directamente. La extraccion la hace GitHub Actions (tools/fetch_live.py)
 * y aqui solo se consume el snapshot ya publicado.
 */
const Mercado = (() => {
  /** Normaliza nombres para cruzar "Compartamos Banco" con "Compartamos Financiera". */
  const clave = (s) => (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(banco|financiera|caja|del|de|la|el|peru|s\.?a\.?a?\.?)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

  function render() {
    const cb = Datos.comparabien();
    const productos = cb.productos || [];
    const live = Datos.estado.live;
    const fuente = Fmt.urlSegura(cb.fuente);
    const estadoFuente = live && live.fuentes && live.fuentes.comparabien;

    document.getElementById('mercado-estado').innerHTML = !productos.length
      ? `<div class="aviso error"><strong>Sin datos de comparabien en este momento.</strong>
         ${estadoFuente && estadoFuente.error ? Fmt.esc(estadoFuente.error) : 'La última extracción automática no devolvió resultados.'}
         Puedes consultarlo directamente en <a href="${fuente}" target="_blank" rel="noopener">comparabien.com.pe/ahorros</a>.</div>`
      : `<div class="aviso info">${productos.length} producto(s) extraídos de
         <a href="${fuente}" target="_blank" rel="noopener">comparabien.com.pe/ahorros</a>.
         Última extracción: <strong>${Fmt.esc((live && live.actualizado_pe) || 'desconocida')}</strong>.
         Las tasas que publica ese comparador son <strong>TEA</strong>, no TREA, así que no son
         directamente comparables con el ranking verificado de este portal.</div>`;

    // KPIs de lo extraído.
    const roster = cb.entidades || [];
    const conTasa = productos.filter((p) => isFinite(p.tasa));
    document.getElementById('mercado-kpis').innerHTML = [
      ['Productos con tasa', productos.length, 'Extraídos de la portada'],
      ['Entidades que compara', roster.length, 'Bancos, cajas y financieras'],
      ['Tasa más alta publicada', conTasa.length ? Fmt.pct(Math.max(...conTasa.map((p) => p.tasa))) : '—', 'En TEA, no TREA'],
      ['Criterios comparados', (cb.columnas || []).length, 'Columnas de su tabla'],
    ].map(([et, val, nota]) => `
      <div class="kpi"><div class="kpi-etiqueta">${et}</div>
       <div class="kpi-valor">${val}</div><div class="kpi-nota">${nota}</div></div>`).join('');

    // Roster completo de entidades.
    document.getElementById('mercado-roster').innerHTML = roster.length
      ? roster.map((e) => `<span class="etiqueta">${Fmt.esc(e.entidad)}</span>`).join('')
      : '<p class="sutil">Sin datos de entidades en la última extracción.</p>';

    // Criterios comparados.
    document.getElementById('mercado-columnas').innerHTML =
      (cb.columnas || []).map((c) => `<li>${Fmt.esc(c)}</li>`).join('');

    const lim = cb.tabla_completa;
    document.getElementById('mercado-limite').innerHTML = lim && !lim.disponible
      ? `<div class="aviso"><strong>Por qué no se extrae la tabla completa.</strong>
         ${Fmt.esc(lim.motivo)} Puedes consultarla tú mismo introduciendo tu correo en
         <a href="${fuente}" target="_blank" rel="noopener">su formulario</a>.</div>`
      : '';

    document.getElementById('rejilla-mercado').innerHTML = productos.length ? productos.map((p) => {
      const logo = Fmt.urlSegura(p.logo);
      return `<article class="entidad">
        <div class="entidad-cabecera">
         ${logo ? `<img class="entidad-logo" src="${logo}" alt="" loading="lazy" width="46" height="46"
             style="object-fit:contain;background:#fff" referrerpolicy="no-referrer">` : ''}
         <div class="entidad-id">
          <div class="entidad-nombre">${Fmt.esc(p.entidad)}</div>
          <div class="entidad-producto">${Fmt.esc(p.producto)}</div>
         </div>
        </div>
        <div class="entidad-tasa">
         <span class="tasa-valor">${Fmt.esc(p.tasa_texto)}</span>
        </div>
        <div class="etiquetas">
         ${p.hasta ? '<span class="etiqueta ambar">Tasa máxima («hasta»)</span>' : ''}
         <span class="etiqueta">Fuente: comparabien</span>
        </div>
        <div class="entidad-datos"><p class="sutil" style="margin:0">${Fmt.esc(p.detalle)}</p></div>
       </article>`;
    }).join('') : '';

    // Contraste con el ranking verificado.
    const ranking = Datos.ranking();
    const filas = productos.map((p) => {
      const m = ranking.find((e) => {
        const a = clave(e.entidad); const b = clave(p.entidad);
        return a && b && (a.includes(b) || b.includes(a));
      });
      return { p, m };
    });

    document.getElementById('mercado-contraste').innerHTML = !filas.length
      ? '<p class="sutil">Sin productos que contrastar.</p>'
      : `<div class="tabla-envoltura"><table class="tabla">
          <thead><tr><th scope="col">Entidad</th><th scope="col">comparabien (TEA)</th>
           <th scope="col">Ranking verificado (TREA)</th><th scope="col">Diferencia</th></tr></thead>
          <tbody>${filas.map(({ p, m }) => {
            const d = (m && isFinite(p.tasa)) ? (m.trea - p.tasa) : null;
            return `<tr>
              <td>${Fmt.esc(p.entidad)}</td>
              <td class="num">${Fmt.esc(p.tasa_texto)}</td>
              <td class="num">${m ? `${Fmt.pct(m.trea)} <span class="sutil">(${Fmt.esc(m.entidad)})</span>` : '<span class="sutil">No está en el ranking</span>'}</td>
              <td class="num">${d === null ? '—' : Fmt.pp(d)}</td>
             </tr>`;
          }).join('')}</tbody></table></div>
         <p class="sutil">Una diferencia no implica que un dato esté mal: comparabien publica TEA y este
          portal TREA, y las campañas de cada canal (web, app, agencia) tienen condiciones distintas.</p>`;
  }

  return { render };
})();
