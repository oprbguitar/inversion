/* Relacion de entidades autorizadas a captar depositos del publico.
 *
 * Fuente: lista de miembros del Fondo de Seguro de Depositos (fsd.org.pe),
 * organismo administrado por la SBS. Se usa esta y no la web de la SBS porque
 * esta ultima esta detras de proteccion anti-bot (Incapsula) y no admite
 * consulta automatizada; la relacion del FSD es equivalente para este fin,
 * porque toda empresa autorizada a captar depositos es miembro por ley.
 *
 * Las cooperativas de ahorro y credito (COOPAC) NO aparecen: estan en el
 * registro de la SBS pero cuentan con un fondo de seguro propio y distinto.
 */
const Entidades = (() => {
  const ICONOS = {
    bancos: '🏦',
    financieras: '💼',
    cajas_municipales: '🏛️',
    cajas_rurales: '🌾',
  };

  /** Cruza el nombre del FSD con las entidades que este portal ya analiza. */
  const clave = (s) => (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(banco|financiera|caja|municipal|rural|de|del|la|el|ahorro|credito|y|peru|cmac|crac|s\.?a\.?a?\.?)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

  function enElPortal(nombre) {
    const k = clave(nombre);
    if (!k) return null;
    return Datos.ranking().find((e) => {
      const a = clave(e.entidad);
      return a && (a.includes(k) || k.includes(a));
    }) || null;
  }

  function render() {
    const live = Datos.estado.live || {};
    const fsd = live.fsd_miembros;
    const cont = document.getElementById('entidades-contenido');
    if (!cont) return;

    const estado = (live.fuentes || {}).fsd_miembros;
    if (!fsd || !fsd.grupos) {
      cont.innerHTML = `<div class="aviso error"><strong>No se pudo cargar la relación de entidades.</strong>
        ${Fmt.esc((estado && estado.error) || 'La última extracción automática no devolvió datos.')}
        Consulta directamente el <a href="https://fsd.org.pe/miembros/" target="_blank" rel="noopener">listado del FSD</a>.</div>`;
      return;
    }

    const grupos = Object.entries(fsd.grupos);
    const enPortal = grupos.reduce((n, [, g]) =>
      n + g.entidades.filter((e) => enElPortal(e)).length, 0);

    document.getElementById('entidades-kpis').innerHTML = [
      ['Entidades autorizadas', fsd.total, 'Miembros del FSD, administrado por la SBS'],
      ['Bancos', (fsd.grupos.bancos || { entidades: [] }).entidades.length, 'Empresas bancarias'],
      ['Cajas municipales y rurales',
        ((fsd.grupos.cajas_municipales || { entidades: [] }).entidades.length
         + (fsd.grupos.cajas_rurales || { entidades: [] }).entidades.length), 'CMAC y CRAC'],
      ['Analizadas en este portal', enPortal, 'Con cuenta de ahorro y ficha completa'],
    ].map(([et, val, nota]) => `
      <div class="kpi"><div class="kpi-etiqueta">${et}</div>
       <div class="kpi-valor">${val}</div><div class="kpi-nota">${nota}</div></div>`).join('');

    cont.innerHTML = grupos.map(([id, g]) => `
      <div class="tarjeta">
       <h2>${ICONOS[id] || ''} ${Fmt.esc(g.titulo)}
        <span class="sutil">(${g.entidades.length})</span></h2>
       <div class="rejilla-entidades-sbs">
        ${g.entidades.map((nombre) => {
          const m = enElPortal(nombre);
          return `<div class="entidad-sbs ${m ? 'analizada' : ''}">
            <span class="visto" aria-hidden="true">✓</span>
            <span class="nombre">${Fmt.esc(nombre)}</span>
            ${m ? `<button type="button" class="chip-trea" data-ver-entidad="${Fmt.esc(m.entidad)}"
                    title="Ver en el ranking">${Fmt.pct(m.trea)}</button>` : ''}
           </div>`;
        }).join('')}
       </div>
      </div>`).join('');

    cont.querySelectorAll('[data-ver-entidad]').forEach((b) => {
      b.addEventListener('click', () => {
        App.irA('ranking');
        const f = document.getElementById('f-texto');
        f.value = b.dataset.verEntidad;
        f.dispatchEvent(new Event('input'));
      });
    });

    document.getElementById('entidades-nota').innerHTML = `
      <div class="aviso info"><strong>Qué significa esta lista.</strong> ${Fmt.esc(fsd.nota)}
       Se extrae automáticamente de <a href="${Fmt.urlSegura(fsd.fuente)}" target="_blank" rel="noopener">fsd.org.pe</a>.
       El check verde marca las entidades que además analizamos con ficha completa en el ranking.</div>
      <div class="aviso"><strong>Por qué no se lee directo de la SBS.</strong> El portal de la SBS está
       protegido contra consultas automatizadas, así que no se puede refrescar solo. Verifica cualquier
       entidad en el
       <a href="https://www.sbs.gob.pe/supervisados-y-registros/entidades-supervisadas" target="_blank" rel="noopener">
       registro oficial de entidades supervisadas</a> antes de contratar. Si una entidad no aparece en
       ese registro, no está autorizada a captar tu dinero.</div>`;
  }

  return { render };
})();
