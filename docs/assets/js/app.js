/* Orquestador: pestañas, tema, carga de datos y refresco. */
const App = (() => {
  const paneles = ['ranking', 'simulador', 'bcrp', 'seguridad', 'mercado', 'videos', 'descargas'];

  function irA(nombre) {
    if (!paneles.includes(nombre)) nombre = 'ranking';

    document.querySelectorAll('.pestana').forEach((b) => {
      const activo = b.dataset.panel === nombre;
      b.classList.toggle('activa', activo);
      b.setAttribute('aria-selected', String(activo));
    });
    document.querySelectorAll('.panel').forEach((p) => {
      const activo = p.id === `p-${nombre}`;
      p.hidden = !activo;
      p.classList.toggle('activo', activo);
    });

    if (location.hash !== `#${nombre}`) history.replaceState(null, '', `#${nombre}`);
    if (nombre === 'videos') Videos.alAbrir();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-tema', tema);
    try { localStorage.setItem('tema', tema); } catch { /* modo privado */ }
  }

  function temaInicial() {
    let guardado = null;
    try { guardado = localStorage.getItem('tema'); } catch { /* modo privado */ }
    return guardado || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');
  }

  function marcarEstado(tipo, texto) {
    document.querySelector('#estado-datos .punto').dataset.estado = tipo;
    document.getElementById('estado-texto').textContent = texto;
  }

  function renderTodo() {
    Ranking.render();
    Simulador.render();
    Bcrp.render();
    Seguridad.render();
    Mercado.render();
    Descargas.render();

    const e = Datos.estado;
    const b = Datos.bcrp();
    const cuando = e.live && e.live.actualizado_pe;

    document.getElementById('pie-corte').textContent = e.base.corte;
    document.getElementById('pie-actualizacion').textContent = cuando
      ? `Datos de mercado actualizados automáticamente el ${cuando} · Tasa BCRP: ${Datos.etiquetaOrigen()}.`
      : `Tasa BCRP: ${Datos.etiquetaOrigen()}.`;

    const etiqueta = { api: 'BCRP en vivo', snapshot: 'Datos actualizados', excel: 'Datos base' }[b.origen];
    marcarEstado(e.errores.length ? 'error' : 'ok',
      e.errores.length ? `${etiqueta} (con avisos)` : etiqueta);
  }

  async function cargar({ manual = false } = {}) {
    const btn = document.getElementById('btn-refrescar');
    btn.classList.add('girando');
    marcarEstado('cargando', manual ? 'Actualizando…' : 'Cargando datos…');
    try {
      await Datos.cargar({ refrescar: manual });
      renderTodo();
    } catch (err) {
      marcarEstado('error', 'Error al cargar');
      document.getElementById('rejilla-entidades').innerHTML =
        `<p class="vacio">No se pudieron cargar los datos del portal.<br><small>${Fmt.esc(err.message)}</small></p>`;
    } finally {
      btn.classList.remove('girando');
    }
  }

  function iniciar() {
    aplicarTema(temaInicial());

    document.querySelectorAll('.pestana').forEach((b) => {
      b.addEventListener('click', () => irA(b.dataset.panel));
    });
    document.getElementById('btn-tema').addEventListener('click', () => {
      aplicarTema(document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'claro' : 'oscuro');
      renderTodo(); // los graficos SVG toman color del tema activo
    });
    document.getElementById('btn-refrescar').addEventListener('click', () => cargar({ manual: true }));
    window.addEventListener('hashchange', () => irA(location.hash.slice(1)));

    Ranking.iniciar();
    Simulador.iniciar();
    Seguridad.iniciar();
    Videos.iniciar();
    Descargas.iniciar();

    irA(location.hash.slice(1) || 'ranking');
    cargar();
  }

  return { iniciar, irA };
})();

document.addEventListener('DOMContentLoaded', App.iniciar);
