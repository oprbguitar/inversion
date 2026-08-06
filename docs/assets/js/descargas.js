/* Pestaña Descargas: metadatos del Excel y generacion del CSV en el navegador. */
const Descargas = (() => {
  const COLUMNAS = [
    ['Puesto', (e, i) => i + 1],
    ['Entidad', (e) => e.entidad],
    ['Producto', (e) => e.producto],
    ['TREA', (e) => (e.trea !== null ? (e.trea * 100).toFixed(2) : '')],
    ['Modo de apertura', (e) => e.apertura],
    ['Monto minimo (S/)', (e) => e.monto_minimo ?? ''],
    ['Saldo para tasa maxima (S/)', (e) => e.saldo_tasa_max ?? ''],
    ['Condicion clave', (e) => e.condicion],
    ['Vigencia', (e) => e.vigencia],
    ['Estado de verificacion', (e) => e.verificacion],
    ['Calificacion SBS', (e) => e.calificacion],
    ['Grupo economico', (e) => e.grupo],
    ['FSD', (e) => e.fsd],
    ['Abono de intereses', (e) => e.abono],
    ['Capitalizacion', (e) => e.capitalizacion],
    ['Mantenimiento', (e) => e.mantenimiento],
    ['Retiros', (e) => e.retiros],
    ['Transferencias', (e) => e.transferencias],
    ['Alertas', (e) => e.alertas],
    ['URL del producto', (e) => e.url],
  ];

  const celda = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function descargarCSV() {
    const filas = [COLUMNAS.map(([t]) => t).join(';')];
    Datos.ranking().forEach((e, i) => {
      filas.push(COLUMNAS.map(([, fn]) => celda(fn(e, i))).join(';'));
    });
    // BOM para que Excel en Windows respete los acentos.
    const blob = new Blob(['﻿', filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ranking_ahorros_peru_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function render() {
    const r = Datos.ranking();
    document.getElementById('meta-xlsx').innerHTML = [
      `${r.length} entidades comparadas`,
      `${(Datos.estado.base.fichas || []).length} fichas individuales con simulador`,
      `${(Datos.bcrp().serie || []).length} meses de serie del BCRP`,
      `Corte de los datos: ${Datos.estado.base.corte}`,
    ].map((t) => `<li>${Fmt.esc(t)}</li>`).join('');
  }

  const iniciar = () =>
    document.getElementById('dl-csv').addEventListener('click', descargarCSV);

  return { iniciar, render };
})();
