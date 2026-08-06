/* Pestaña Tasas BCRP: serie de politica monetaria y spread frente a cada TREA. */
const Bcrp = (() => {
  function render() {
    const b = Datos.bcrp();
    const serie = b.serie || [];
    if (!serie.length) return;

    const ultimo = serie[serie.length - 1];
    const hace12 = serie[Math.max(0, serie.length - 13)];
    const variacion = ultimo.tasa - hace12.tasa;
    const maxTrea = Math.max(...Datos.ranking().map((e) => e.trea || 0));

    const origen = {
      api: 'Consultado en vivo a la API del BCRP',
      snapshot: 'Actualización automática programada',
      excel: 'Archivo base (sin conexión)',
    }[b.origen] || '';

    document.getElementById('bcrp-kpis').innerHTML = [
      ['Tasa de referencia vigente', Fmt.pct(b.vigente), Fmt.esc(b.etiqueta_vigente || Fmt.mesLargo(ultimo.mes))],
      ['Variación en 12 meses', Fmt.pp(variacion), `Desde ${Fmt.mesLargo(hace12.mes)}`],
      ['Mejor TREA del ranking', Fmt.pct(maxTrea), `${Fmt.pp(maxTrea - b.vigente)} sobre la tasa BCRP`],
      ['Origen del dato', origen.split(' ')[0], origen],
    ].map(([et, val, nota]) => `
      <div class="kpi"><div class="kpi-etiqueta">${et}</div>
       <div class="kpi-valor">${val}</div><div class="kpi-nota">${nota}</div></div>`).join('');

    Graficos.linea(
      document.getElementById('bcrp-grafico'),
      serie.map((p) => ({ x: Fmt.mesLargo(p.mes), y: p.tasa })),
      { fmtY: (v) => `${(v * 100).toFixed(2)}%`, maxEtiquetas: 10 },
    );

    // Spread: cuanto paga cada cuenta por encima de la tasa de politica monetaria.
    const entidades = [...Datos.ranking()].sort((a, b2) => (b2.trea || 0) - (a.trea || 0));
    const maxSpread = Math.max(...entidades.map((e) => (e.trea || 0) - b.vigente), 0.001);
    document.getElementById('bcrp-spread').innerHTML = `<div class="barras-spread">${
      entidades.map((e) => {
        const sp = (e.trea || 0) - b.vigente;
        const ancho = Math.max(0, (sp / maxSpread) * 100);
        return `<div class="fila-spread">
          <span>${Fmt.esc(e.entidad)}</span>
          <span class="pista"><span class="relleno" style="width:${ancho.toFixed(1)}%"></span></span>
          <span class="valor">${Fmt.pp(sp)}</span>
        </div>`;
      }).join('')
    }</div>`;

    document.getElementById('bcrp-tabla').querySelector('tbody').innerHTML =
      [...serie].reverse().map((p, i, arr) => {
        const prev = arr[i + 1];
        const d = prev ? p.tasa - prev.tasa : null;
        return `<tr>
          <td>${Fmt.mesLargo(p.mes)}</td>
          <td class="num">${Fmt.pct(p.tasa)}</td>
          <td class="num">${d === null ? '—' : (d === 0 ? 'sin cambio' : Fmt.pp(d))}</td>
         </tr>`;
      }).join('');
  }

  return { render };
})();
