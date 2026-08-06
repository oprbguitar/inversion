/* Pestaña Simulador: proyeccion mes a mes por entidad + comparativa de las 16. */
const Simulador = (() => {
  const $ = (s) => document.querySelector(s);

  const parametros = () => ({
    monto: Math.max(0, parseFloat($('#s-monto').value) || 0),
    aporte: Math.max(0, parseFloat($('#s-aporte').value) || 0),
    meses: parseInt($('#s-plazo').value, 10) || 12,
    cumple: $('#s-condicion').checked,
    itf: $('#s-itf').checked,
  });

  const entidadActual = () =>
    Datos.ranking().find((e) => e.entidad === $('#s-entidad').value) || Datos.ranking()[0];

  function llenarSelector() {
    const sel = $('#s-entidad');
    const previo = sel.value;
    sel.innerHTML = Datos.ranking()
      .map((e) => `<option value="${Fmt.esc(e.entidad)}">${Fmt.esc(e.entidad)} — ${Fmt.pct(e.trea)}</option>`)
      .join('');
    if (previo) sel.value = previo;
  }

  function pintarCabecera(e) {
    const ficha = Datos.fichaDe(e.entidad);
    const url = Fmt.urlSegura(e.url);
    $('#sim-cabecera').innerHTML = `
     <div class="sim-cabecera">
      <img src="${Datos.logoDe(e.entidad)}" alt="Logotipo de ${Fmt.esc(e.entidad)}" width="44" height="44">
      <div>
       <h2 style="margin:0">${Fmt.esc(e.entidad)}</h2>
       <div class="sutil">${Fmt.esc((ficha && ficha.producto) || e.producto)}
        ${url ? ` · <a href="${url}" target="_blank" rel="noopener">página oficial</a>` : ''}</div>
      </div>
     </div>`;
  }

  function pintarAvisos(e, res, p) {
    const avisos = [];
    const ficha = Datos.fichaDe(e.entidad);
    const tope = ficha && ficha.simulador && ficha.simulador.tope_remunerado;

    if (isFinite(tope) && tope > 0 && p.monto > tope) {
      avisos.push(`<div class="aviso"><strong>Tope de saldo remunerado.</strong> Esta campaña paga
        ${Fmt.pct(res.treaAplicada)} solo hasta ${Fmt.money(tope)}. Los ${Fmt.money(p.monto - tope)} restantes
        no generan la tasa promocional en esta simulación.</div>`);
    }
    if (e.monto_minimo && p.monto < e.monto_minimo) {
      avisos.push(`<div class="aviso"><strong>Monto por debajo del mínimo.</strong> Esta cuenta exige
        ${Fmt.money(e.monto_minimo)} para abrirse.</div>`);
    }
    if (e.saldo_tasa_max && p.monto < e.saldo_tasa_max) {
      avisos.push(`<div class="aviso"><strong>No alcanzas la tasa máxima.</strong> Se requiere un saldo de
        ${Fmt.money(e.saldo_tasa_max)} para ${Fmt.pct(e.trea)}; con tu monto aplica ${Fmt.pct(res.treaAplicada)}.</div>`);
    }
    if (!p.cumple) {
      avisos.push(`<div class="aviso"><strong>Sin la condición de campaña.</strong> Se está simulando con la
        tasa no promocional. Marca la casilla si cumples los requisitos.</div>`);
    }
    if (e.alertas) avisos.push(`<div class="aviso info">${Fmt.esc(e.alertas)}</div>`);
    if (/reserva|verificar antes/i.test(e.verificacion || '')) {
      avisos.push(`<div class="aviso error"><strong>Dato por confirmar.</strong> ${Fmt.esc(e.verificacion)}.
        Verifica la tasa en la entidad antes de tomar cualquier decisión.</div>`);
    }
    $('#sim-avisos').innerHTML = avisos.join('');
  }

  function pintarComparativa(p) {
    const filas = Datos.ranking().map((e) => {
      const r = Fmt.proyectar(e, p);
      return { e, r };
    }).sort((a, b) => b.r.interesTotal - a.r.interesTotal);

    $('#tabla-comparativa tbody').innerHTML = filas.map(({ e, r }, i) => `
     <tr class="${i === 0 ? 'destacada' : ''}">
      <td class="num">${i + 1}</td>
      <td><div class="celda-entidad">
        <img src="${Datos.logoDe(e.entidad)}" alt="" width="24" height="24" loading="lazy">
        <span>${Fmt.esc(e.entidad)}</span></div></td>
      <td class="num">${Fmt.pct(r.treaAplicada)}</td>
      <td class="num">${Fmt.money(r.saldoRemunerado)}</td>
      <td class="num">${Fmt.money(r.interesTotal)}</td>
      <td class="num">${Fmt.money(r.saldoFinal)}</td>
     </tr>`).join('');
  }

  function calcular() {
    const p = parametros();
    const e = entidadActual();
    if (!e) return;

    $('#s-plazo-txt').textContent = `${p.meses} ${p.meses === 1 ? 'mes' : 'meses'}`;

    const res = Fmt.proyectar(e, p);
    pintarCabecera(e);

    const mejor = Datos.ranking()
      .map((x) => ({ x, r: Fmt.proyectar(x, p) }))
      .sort((a, b) => b.r.interesTotal - a.r.interesTotal)[0];
    const diferencia = mejor.r.interesTotal - res.interesTotal;

    $('#sim-kpis').innerHTML = [
      ['Interés del periodo', Fmt.money(res.interesTotal), `TREA aplicada: ${Fmt.pct(res.treaAplicada)}`],
      ['Saldo final', Fmt.money(res.saldoFinal), `Aportado: ${Fmt.money(res.aportadoTotal)}`],
      ['Rendimiento sobre lo aportado', Fmt.pct(res.aportadoTotal ? res.interesTotal / res.aportadoTotal : 0),
        `En ${p.meses} ${p.meses === 1 ? 'mes' : 'meses'}`],
      diferencia > 0.5
        ? ['Podrías ganar más', `+${Fmt.money(diferencia)}`, `Con ${Fmt.esc(mejor.x.entidad)}`]
        : ['Mejor opción del ranking', 'Esta entidad', 'Con estos parámetros'],
    ].map(([et, val, nota]) => `
      <div class="kpi"><div class="kpi-etiqueta">${et}</div>
       <div class="kpi-valor">${val}</div><div class="kpi-nota">${nota}</div></div>`).join('');

    pintarAvisos(e, res, p);

    Graficos.linea(
      document.getElementById('sim-grafico'),
      [{ x: 'Inicio', y: p.monto }].concat(res.filas.map((f) => ({ x: `M${f.mes}`, y: f.saldo }))),
      { fmtY: (v) => Fmt.moneyCorto(v) },
    );

    $('#sim-tabla tbody').innerHTML = res.filas.map((f) => `
     <tr>
      <td class="num">${f.mes}</td>
      <td class="num">${Fmt.money(f.aportado)}</td>
      <td class="num">${Fmt.money(f.interes)}</td>
      <td class="num">${Fmt.money(f.acumulado)}</td>
      <td class="num">${Fmt.money(f.saldo)}</td>
     </tr>`).join('');

    pintarComparativa(p);
  }

  function seleccionar(entidad) {
    const sel = $('#s-entidad');
    if ([...sel.options].some((o) => o.value === entidad)) {
      sel.value = entidad;
      calcular();
    }
  }

  function iniciar() {
    ['#s-monto', '#s-aporte', '#s-plazo', '#s-entidad', '#s-condicion', '#s-itf'].forEach((s) => {
      const el = $(s);
      el.addEventListener('input', calcular);
      el.addEventListener('change', calcular);
    });
    $('#form-simulador').addEventListener('submit', (ev) => ev.preventDefault());
  }

  const render = () => { llenarSelector(); calcular(); };

  return { iniciar, render, seleccionar };
})();
