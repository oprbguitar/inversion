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

  const sello = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return {
      archivo: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
      legible: d.toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' }),
    };
  };

  /* El .xlsx es un archivo estatico: no puede saber cuando lo descargas. Por eso
     la fecha de descarga se estampa en el nombre del archivo y se muestra aqui;
     dentro del libro figura la fecha de generacion de los datos. */
  async function descargarXLSX(ev) {
    ev.preventDefault();
    const boton = ev.currentTarget;
    const origen = boton.getAttribute('href');
    boton.textContent = 'Preparando…';
    try {
      const r = await fetch(origen, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Ranking_Ahorros_Peru_${sello().archivo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      document.getElementById('dl-sello').textContent = `Descargado el ${sello().legible}`;
    } catch {
      window.location.href = origen; // si algo falla, descarga directa del navegador
    } finally {
      boton.textContent = 'Descargar Excel mejorado';
    }
  }

  function render() {
    const r = Datos.ranking();
    document.getElementById('meta-xlsx').innerHTML = [
      `8 hojas · ${r.length} entidades comparadas`,
      `${(Datos.estado.base.fichas || []).length} fichas con escalas de tasa`,
      `${(Datos.bcrp().serie || []).length} meses de serie del BCRP`,
      `Corte de los datos: ${Datos.estado.base.corte}`,
      `Gráficos, barras de datos y semáforo de verificación`,
    ].map((t) => `<li>${Fmt.esc(t)}</li>`).join('');
  }

  function iniciar() {
    document.getElementById('dl-csv').addEventListener('click', descargarCSV);
    document.getElementById('dl-xlsx').addEventListener('click', descargarXLSX);
  }

  return { iniciar, render };
})();
