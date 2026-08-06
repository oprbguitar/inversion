/* Pestaña Seguridad / FSD: cobertura del Fondo de Seguro de Depositos. */
const Seguridad = (() => {
  const limite = () => (Datos.fsd().cobertura || 122000);

  function calcularCobertura() {
    const monto = Math.max(0, parseFloat(document.getElementById('fsd-monto').value) || 0);
    const tope = limite();
    const cubierto = Math.min(monto, tope);
    const exceso = Math.max(0, monto - tope);
    const pctCub = monto ? cubierto / monto : 1;

    document.getElementById('fsd-salida').innerHTML = [
      ['Monto cubierto', Fmt.money(cubierto), `${(pctCub * 100).toFixed(1)}% de tu depósito`],
      ['Exceso no cubierto', Fmt.money(exceso), exceso ? 'Fuera del seguro en esa entidad' : 'Todo tu saldo está cubierto'],
      ['Entidades necesarias', Math.max(1, Math.ceil(monto / tope)),
        exceso ? 'Para mantener el 100% bajo cobertura' : 'Basta con una entidad miembro'],
    ].map(([et, val, nota]) => `
      <div class="kpi"><div class="kpi-etiqueta">${et}</div>
       <div class="kpi-valor">${val}</div><div class="kpi-nota">${nota}</div></div>`).join('');

    const barra = document.getElementById('fsd-barra');
    barra.setAttribute('aria-label',
      `${(pctCub * 100).toFixed(0)}% del depósito está cubierto por el FSD`);
    barra.innerHTML = monto === 0 ? '' : `
      <span class="cubierto" style="flex:${cubierto}">${pctCub > 0.14 ? 'Cubierto' : ''}</span>
      ${exceso ? `<span class="excedido" style="flex:${exceso}">${(1 - pctCub) > 0.14 ? 'Sin cobertura' : ''}</span>` : ''}`;
  }

  function render() {
    const tope = limite();
    const r = Datos.ranking();

    document.getElementById('fsd-kpis').innerHTML = [
      ['Cobertura máxima vigente', Fmt.moneyCorto(tope), 'Por depositante y por institución'],
      ['Entidades miembro en el portal', `${r.filter((e) => e.fsd === 'Sí').length} de ${r.length}`, 'Todas declaran cobertura del FSD'],
      ['Verificadas en fuente oficial', r.filter((e) => /^verificado/i.test(e.verificacion || '')).length,
        'El resto requiere confirmación directa'],
    ].map(([et, val, nota]) => `
      <div class="kpi"><div class="kpi-etiqueta">${et}</div>
       <div class="kpi-valor">${val}</div><div class="kpi-nota">${nota}</div></div>`).join('');

    document.getElementById('tabla-fsd').querySelector('tbody').innerHTML = r.map((e) => {
      const u = Fmt.urlSegura(e.url);
      const cls = /^verificado/i.test(e.verificacion || '') ? 'verde'
        : /reserva|verificar antes/i.test(e.verificacion || '') ? 'rojo' : 'ambar';
      return `<tr>
        <td><div class="celda-entidad">
          <img src="${Datos.logoDe(e.entidad)}" alt="" width="24" height="24" loading="lazy">
          <span>${Fmt.esc(e.entidad)}</span></div></td>
        <td>${Fmt.esc(e.producto)}</td>
        <td><span class="etiqueta verde">${Fmt.esc(e.fsd || '—')}</span></td>
        <td><span class="etiqueta ${cls}">${Fmt.esc(e.verificacion || '—')}</span></td>
        <td>${u ? `<a href="${u}" target="_blank" rel="noopener">Ver</a>` : '—'}</td>
       </tr>`;
    }).join('');

    calcularCobertura();
  }

  const iniciar = () =>
    document.getElementById('fsd-monto').addEventListener('input', calcularCobertura);

  return { iniciar, render };
})();
