/* Pestaña Videos: busqueda en vivo con la API de YouTube Data v3.
 *
 * Es la unica fuente que responde con CORS abierto, asi que aqui la consulta si
 * ocurre en el navegador, en tiempo real, cada vez que el usuario busca.
 *
 * ── SOBRE LA CLAVE ────────────────────────────────────────────────────────────
 * La clave esta ofuscada (XOR + base64) para que no aparezca como texto plano en
 * el repositorio ni en el codigo fuente de la pagina. Eso NO es cifrado: cualquier
 * clave que use un sitio estatico viaja al navegador y puede recuperarse leyendo
 * este archivo. La proteccion real es la restriccion del lado de Google:
 *   Google Cloud Console > Credenciales > la clave > Restricciones de aplicacion
 *   > Sitios web (referrers HTTP) > https://TU-USUARIO.github.io/*
 *   > Restricciones de API > solo "YouTube Data API v3"
 * Con eso, aunque alguien extraiga la clave, no puede usarla desde otro dominio.
 */
const Videos = (() => {
  const SEMILLA = 'ahorros-pe-2026-portal';
  const CLAVE_OFUSCADA = 'ICEVEyEWMXIJUmgFQFNjXwQAIhMkVA4/NjslKjFhJBZPeFtABRoT';

  function clave() {
    const bruto = atob(CLAVE_OFUSCADA);
    let out = '';
    for (let i = 0; i < bruto.length; i += 1) {
      out += String.fromCharCode(bruto.charCodeAt(i) ^ SEMILLA.charCodeAt(i % SEMILLA.length));
    }
    return out;
  }

  /* Terminos que acotan la busqueda al ambito financiero pedido. */
  const AMBITO = {
    peru: 'finanzas personales Perú ahorro banco SBS soles',
    internacional: 'finanzas personales inversión ahorro economía',
  };

  const el = (id) => document.getElementById(id);

  function estado(html, tipo = 'info') {
    el('yt-estado').innerHTML = html ? `<div class="aviso ${tipo}">${html}</div>` : '';
  }

  function fechaRelativa(iso) {
    const dias = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (dias < 1) return 'hoy';
    if (dias < 30) return `hace ${dias} día${dias === 1 ? '' : 's'}`;
    if (dias < 365) return `hace ${Math.floor(dias / 30)} mes(es)`;
    return `hace ${Math.floor(dias / 365)} año(s)`;
  }

  async function buscar() {
    const consulta = el('yt-consulta').value.trim();
    const ambito = el('yt-ambito').value;
    const dias = el('yt-fecha').value;
    const orden = el('yt-orden').value;

    estado('Buscando en YouTube…');
    el('rejilla-videos').innerHTML = '';

    const p = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: '24',
      q: `${consulta} ${AMBITO[ambito]}`.trim(),
      order: orden,
      relevanceLanguage: 'es',
      safeSearch: 'moderate',
      videoEmbeddable: 'true',
      key: clave(),
    });
    if (ambito === 'peru') p.set('regionCode', 'PE');
    if (dias) p.set('publishedAfter', new Date(Date.now() - dias * 86400000).toISOString());

    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${p}`);
      const j = await r.json();

      if (!r.ok) {
        const motivo = (((j.error || {}).errors || [])[0] || {}).reason || '';
        const mensaje = (j.error && j.error.message) || '';
        const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

        // La clave esta restringida por referrer al dominio publicado. En local
        // el bloqueo es la prueba de que la restriccion funciona, no un fallo.
        if (motivo === 'ipRefererBlocked' || /referer/i.test(mensaje)) {
          estado(local
            ? `<strong>Los videos solo funcionan en el sitio publicado.</strong> La clave de YouTube está
               restringida al dominio <code>oprbguitar.github.io</code>, así que Google bloquea las
               peticiones desde <code>${Fmt.esc(location.origin)}</code>. Eso es exactamente lo que debe
               pasar: significa que la restricción está bien puesta y que nadie puede usar tu clave desde
               otro sitio. Abre
               <a href="https://oprbguitar.github.io/inversion/#videos" target="_blank" rel="noopener">el portal publicado</a>
               para ver los videos.`
            : `<strong>La clave está restringida a otro dominio.</strong> Añade
               <code>${Fmt.esc(location.origin)}/*</code> en Google Cloud Console →
               Credenciales → Restricciones de aplicación → Sitios web.`,
            local ? 'info' : 'error');
          return;
        }

        const mensajes = {
          quotaExceeded: 'Se agotó la cuota diaria de la API de YouTube. Vuelve a intentarlo mañana o usa otra clave.',
          keyInvalid: 'La clave de la API de YouTube no es válida.',
          accessNotConfigured: 'La YouTube Data API v3 no está habilitada en el proyecto de Google Cloud.',
        };
        estado(`<strong>No se pudo buscar.</strong> ${Fmt.esc(mensajes[motivo] || mensaje || `Error HTTP ${r.status}`)}`, 'error');
        return;
      }

      const items = j.items || [];
      if (!items.length) {
        estado('No se encontraron videos con esos criterios. Prueba otro tema o amplía el rango de fechas.');
        return;
      }

      estado(`${items.length} videos encontrados · consulta en vivo a YouTube · ${new Date().toLocaleString('es-PE')}`);

      el('rejilla-videos').innerHTML = items.map((it) => {
        const id = it.id.videoId;
        const s = it.snippet;
        const mini = (s.thumbnails.medium || s.thumbnails.default || {}).url;
        return `<article class="video">
          <div class="video-miniatura">
           <a href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener">
            <img src="${Fmt.esc(mini)}" alt="Miniatura del video: ${Fmt.esc(s.title)}" loading="lazy">
           </a>
          </div>
          <div class="video-cuerpo">
           <h3 class="video-titulo">
            <a href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener">${Fmt.esc(s.title)}</a>
           </h3>
           <div class="sutil">${Fmt.esc(s.channelTitle)}</div>
           <div class="video-meta">Publicado ${fechaRelativa(s.publishedAt)}</div>
          </div>
         </article>`;
      }).join('');
    } catch (e) {
      estado(`<strong>Fallo de red al consultar YouTube.</strong> ${Fmt.esc(e.message)}`, 'error');
    }
  }

  let yaBuscado = false;

  function iniciar() {
    el('yt-buscar').addEventListener('click', buscar);
    el('yt-consulta').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') buscar(); });
    ['yt-ambito', 'yt-fecha', 'yt-orden'].forEach((id) => el(id).addEventListener('change', buscar));
  }

  /* Solo se consulta al abrir la pestaña: evita gastar cuota en cada visita. */
  function alAbrir() {
    if (yaBuscado) return;
    yaBuscado = true;
    buscar();
  }

  return { iniciar, alAbrir, buscar };
})();
