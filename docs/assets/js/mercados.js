/* Cinta de cotizaciones + panel de mercados (modelo tomado del repo bvl22072026).
 *
 * Twelve Data si responde con CORS abierto (Access-Control-Allow-Origin: *), asi
 * que estas cotizaciones son consulta en vivo desde el navegador.
 *
 * ── SOBRE LA CLAVE ──────────────────────────────────────────────────────────
 * La clave de Twelve Data NO esta en el repositorio, por decision expresa.
 * El usuario la introduce una vez y se guarda solo en su navegador
 * (localStorage). Nunca se envia a ningun sitio salvo a la propia API.
 */
const Mercados = (() => {
  const LS_CLAVE = 'td_api_key';

  /* Limites del plan gratuito de Twelve Data: 8 creditos por minuto y 800 al dia,
     y cada SIMBOLO cuesta 1 credito (no cada peticion). Por eso la lista se queda
     en 8 y el refresco automatico es de 5 minutos: asi una sesion larga no agota
     la cuota diaria. El boton de actualizar permite forzarlo cuando haga falta. */
  const REFRESCO = 300000;
  const MAX_SIMBOLOS = 8;

  const SIMBOLOS = [
    { s: 'USD/PEN', n: 'Dólar / Sol', g: 'divisas', dec: 4 },
    { s: 'EUR/USD', n: 'Euro / Dólar', g: 'divisas', dec: 4 },
    { s: 'SPY', n: 'S&P 500 (ETF)', g: 'indices', dec: 2 },
    { s: 'EPU', n: 'MSCI Perú (ETF)', g: 'indices', dec: 2 },
    { s: 'BAP', n: 'Credicorp (NYSE)', g: 'peruanas', dec: 2 },
    { s: 'BVN', n: 'Buenaventura (NYSE)', g: 'peruanas', dec: 2 },
    { s: 'SCCO', n: 'Southern Copper (NYSE)', g: 'peruanas', dec: 2 },
    { s: 'XAU/USD', n: 'Oro (onza)', g: 'materias', dec: 2 },
  ].slice(0, MAX_SIMBOLOS);

  const GRUPOS = {
    divisas: 'Divisas',
    indices: 'Índices y ETF',
    peruanas: 'Empresas peruanas en NYSE',
    materias: 'Materias primas',
  };

  let cotizaciones = {};
  let temporizador = null;

  const clave = () => { try { return localStorage.getItem(LS_CLAVE) || ''; } catch { return ''; } };
  const guardarClave = (v) => { try { localStorage.setItem(LS_CLAVE, v.trim()); } catch { /* modo privado */ } };
  const borrarClave = () => { try { localStorage.removeItem(LS_CLAVE); } catch { /* modo privado */ } };

  const el = (id) => document.getElementById(id);

  /* ── Relojes Perú / EE. UU. ─────────────────────────────── */

  function pintarRelojes() {
    const ahora = new Date();
    const fmt = (tz) => ({
      hora: ahora.toLocaleTimeString('es-PE', { timeZone: tz, hour12: false }),
      fecha: ahora.toLocaleDateString('es-PE', {
        timeZone: tz, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      }),
    });
    const pe = fmt('America/Lima');
    const us = fmt('America/New_York');

    const destino = el('relojes');
    if (destino) {
      destino.innerHTML = `
       <div class="reloj"><span class="reloj-lugar">Perú (Lima)</span>
        <span class="reloj-hora">${pe.hora}</span><span class="reloj-fecha">${pe.fecha}</span></div>
       <div class="reloj"><span class="reloj-lugar">EE. UU. (Nueva York)</span>
        <span class="reloj-hora">${us.hora}</span><span class="reloj-fecha">${us.fecha}</span>
        <span class="reloj-mercado ${mercadoAbierto() ? 'abierto' : 'cerrado'}">
         ${mercadoAbierto() ? 'Mercado abierto' : 'Mercado cerrado'}</span></div>`;
    }
  }

  /** NYSE: 09:30–16:00 hora de Nueva York, de lunes a viernes (sin feriados). */
  function mercadoAbierto() {
    const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dia = ny.getDay();
    if (dia === 0 || dia === 6) return false;
    const min = ny.getHours() * 60 + ny.getMinutes();
    return min >= 570 && min < 960;
  }

  /* ── Cotizaciones ───────────────────────────────────────── */

  async function cargarCotizaciones() {
    const k = clave();
    if (!k) { pintarSinClave(); return; }

    const lista = SIMBOLOS.map((x) => x.s).join(',');
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(lista)}&apikey=${encodeURIComponent(k)}`;

    try {
      const r = await fetch(url);
      const j = await r.json();

      // Twelve Data responde 200 con {code, message} cuando la clave falla.
      if (j.code && j.code >= 400) throw new Error(j.message || `Error ${j.code}`);

      cotizaciones = {};
      SIMBOLOS.forEach(({ s }) => {
        const d = j[s] !== undefined ? j[s] : (SIMBOLOS.length === 1 ? j : null);
        if (d && !d.code && d.close !== undefined) cotizaciones[s] = d;
      });

      if (!Object.keys(cotizaciones).length) throw new Error('La API no devolvió cotizaciones válidas.');
      pintarCinta();
      pintarPanel();
      estadoPanel(`En vivo · Twelve Data · ${Object.keys(cotizaciones).length} instrumentos ·
        actualizado ${new Date().toLocaleTimeString('es-PE')} · próxima actualización en 5 min`, 'info');
    } catch (e) {
      // El plan gratuito cobra 1 credito por simbolo: el aviso lo explica.
      const cuota = /credit|limit/i.test(e.message);
      estadoPanel(`<strong>No se pudieron obtener las cotizaciones.</strong> ${Fmt.esc(e.message)}
        ${cuota ? '<br>El plan gratuito de Twelve Data permite 8 créditos por minuto y 800 al día, y cada instrumento cuesta 1 crédito. Espera un minuto y vuelve a intentarlo.' : ''}`, 'error');
      const cinta = el('cinta-interior');
      if (cinta) cinta.innerHTML = '<span class="cinta-item sutil">Cotizaciones no disponibles</span>';
    }
  }

  const flecha = (ch) => (ch >= 0 ? '▲' : '▼');
  const claseCh = (ch) => (ch >= 0 ? 'sube' : 'baja');

  function pintarCinta() {
    const cinta = el('cinta-interior');
    if (!cinta) return;
    const items = SIMBOLOS.filter((x) => cotizaciones[x.s]).map((x) => {
      const d = cotizaciones[x.s];
      const ch = parseFloat(d.percent_change);
      const precio = parseFloat(d.close).toFixed(x.dec);
      return `<span class="cinta-item"><span class="cinta-simbolo">${Fmt.esc(x.s)}</span>
        ${precio} <span class="${claseCh(ch)}">${flecha(ch)}${Math.abs(ch).toFixed(2)}%</span></span>`;
    }).join('');
    // Se duplica el contenido para que el desplazamiento no deje hueco.
    cinta.innerHTML = items + items;
  }

  function estadoPanel(html, tipo) {
    const d = el('mercados-estado');
    if (d) d.innerHTML = html ? `<div class="aviso ${tipo}">${html}</div>` : '';
  }

  function pintarSinClave() {
    const cinta = el('cinta-interior');
    if (cinta) {
      cinta.innerHTML = '<span class="cinta-item sutil">Introduce tu clave de Twelve Data para ver cotizaciones en vivo →</span>';
    }
    estadoPanel(`<strong>Falta la clave de Twelve Data.</strong> Esta clave no se guarda en el repositorio:
      la introduces una vez y queda solo en tu navegador. Consíguela gratis en
      <a href="https://twelvedata.com/pricing" target="_blank" rel="noopener">twelvedata.com</a>.`, 'info');
    const panel = el('paneles-mercado');
    if (panel) panel.innerHTML = '';
  }

  function pintarPanel() {
    const cont = el('paneles-mercado');
    if (!cont) return;

    cont.innerHTML = Object.entries(GRUPOS).map(([g, titulo]) => {
      const filas = SIMBOLOS.filter((x) => x.g === g && cotizaciones[x.s]).map((x) => {
        const d = cotizaciones[x.s];
        const ch = parseFloat(d.percent_change);
        const cam = parseFloat(d.change);
        return `<tr>
          <td><strong>${Fmt.esc(x.s)}</strong><div class="sutil">${Fmt.esc(x.n)}</div></td>
          <td class="num">${parseFloat(d.close).toFixed(x.dec)}</td>
          <td class="num ${claseCh(ch)}">${flecha(ch)} ${Math.abs(cam).toFixed(x.dec)}</td>
          <td class="num ${claseCh(ch)}">${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(2)}%</td>
         </tr>`;
      }).join('');
      if (!filas) return '';
      return `<div class="tarjeta">
        <h2>${titulo}</h2>
        <div class="tabla-envoltura"><table class="tabla tabla-mercado">
         <thead><tr><th scope="col">Instrumento</th><th scope="col">Último</th>
          <th scope="col">Variación</th><th scope="col">%</th></tr></thead>
         <tbody>${filas}</tbody></table></div>
       </div>`;
    }).join('');
  }

  /* ── Entidades financieras cubiertas ────────────────────── */

  function pintarEntidades() {
    const cont = el('mercados-entidades');
    if (!cont) return;
    const propias = Datos.ranking();
    const cb = (Datos.comparabien().entidades || []);

    cont.innerHTML = `
     <div class="tarjeta">
      <h2>Entidades financieras del portal</h2>
      <p class="sutil">${propias.length} entidades con cuenta de ahorro verificada y ficha completa.</p>
      <div class="fichas-entidades">
       ${propias.map((e) => `<a class="ficha-entidad" href="#ranking" data-ir-ranking="${Fmt.esc(e.entidad)}">
         <img src="${Datos.logoDe(e.entidad)}" alt="" width="32" height="32" loading="lazy">
         <span><strong>${Fmt.esc(e.entidad)}</strong><em>${Fmt.pct(e.trea)} TREA</em></span></a>`).join('')}
      </div>
     </div>
     ${cb.length ? `<div class="tarjeta">
      <h2>Entidades que compara comparabien.com.pe</h2>
      <p class="sutil">${cb.length} entidades declaradas en su portada, extraídas automáticamente.</p>
      <div class="nubes-entidades">
       ${cb.map((e) => `<span class="etiqueta">${Fmt.esc(e.entidad)}</span>`).join('')}
      </div>
     </div>` : ''}`;
  }

  /* ── Arranque ───────────────────────────────────────────── */

  function guardarDesdeFormulario() {
    const v = el('td-clave').value.trim();
    if (!v) return;
    guardarClave(v);
    el('td-clave').value = '';
    pintarEstadoClave();
    cargarCotizaciones();
  }

  function pintarEstadoClave() {
    const d = el('td-estado');
    if (!d) return;
    const k = clave();
    d.innerHTML = k
      ? `<span class="etiqueta verde">Clave guardada en este navegador</span>
         <button type="button" class="btn-secundario" id="td-borrar">Quitar clave</button>`
      : '<span class="etiqueta ambar">Sin clave: cotizaciones desactivadas</span>';
    const b = el('td-borrar');
    if (b) {
      b.addEventListener('click', () => {
        borrarClave();
        pintarEstadoClave();
        pintarSinClave();
      });
    }
  }

  /* Control de la cinta. Si el sistema pide movimiento reducido, arranca
     detenida; el boton permite ponerla en marcha de todos modos. */
  function iniciarCinta() {
    const cinta = el('cinta');
    const boton = el('cinta-control');
    if (!cinta || !boton) return;

    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let enMarcha = !reducido;
    try {
      const guardado = localStorage.getItem('cinta_en_marcha');
      if (guardado !== null) enMarcha = guardado === '1';
    } catch { /* modo privado */ }

    const aplicar = () => {
      cinta.classList.toggle('en-marcha', enMarcha);
      cinta.classList.toggle('detenida', !enMarcha);
      boton.textContent = enMarcha ? '⏸' : '▶';
      boton.setAttribute('aria-pressed', String(!enMarcha));
      boton.setAttribute('aria-label', enMarcha
        ? 'Pausar el desplazamiento de cotizaciones'
        : 'Reanudar el desplazamiento de cotizaciones');
    };

    boton.addEventListener('click', () => {
      enMarcha = !enMarcha;
      try { localStorage.setItem('cinta_en_marcha', enMarcha ? '1' : '0'); } catch { /* modo privado */ }
      aplicar();
    });
    aplicar();
  }

  function iniciar() {
    pintarRelojes();
    setInterval(pintarRelojes, 1000);
    iniciarCinta();

    const guardar = el('td-guardar');
    if (guardar) guardar.addEventListener('click', guardarDesdeFormulario);
    const refrescar = el('td-refrescar');
    if (refrescar) refrescar.addEventListener('click', cargarCotizaciones);
    const campo = el('td-clave');
    if (campo) campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') guardarDesdeFormulario(); });

    pintarEstadoClave();
    cargarCotizaciones();
    temporizador = setInterval(cargarCotizaciones, REFRESCO);
  }

  function render() {
    pintarEntidades();
    document.querySelectorAll('[data-ir-ranking]').forEach((a) => {
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        App.irA('ranking');
        const f = document.getElementById('f-texto');
        f.value = a.dataset.irRanking;
        f.dispatchEvent(new Event('input'));
      });
    });
  }

  return { iniciar, render, cargarCotizaciones, get temporizador() { return temporizador; } };
})();
