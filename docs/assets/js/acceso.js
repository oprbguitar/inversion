/* Puerta de acceso al portal (modelo tomado del repo bvl22072026).
 *
 * ── QUE PROTEGE Y QUE NO ────────────────────────────────────────────────────
 * Esto es una barrera de conveniencia, NO seguridad real. En un sitio estatico
 * de GitHub Pages todos los archivos son publicos: cualquiera puede abrir
 * docs/data/dataset.json directamente, leer este JS o desactivar el overlay
 * desde las herramientas de desarrollo, sin pasar por la clave.
 *
 * Se guarda el hash SHA-256 en vez de la clave en claro para que la clave no
 * aparezca literal en el repositorio, pero un hash sin sal de una clave corta
 * se rompe por fuerza bruta en segundos. Sirve para que el portal no quede
 * abierto a quien llegue por casualidad; no para proteger informacion sensible.
 *
 * Si hiciera falta control de acceso de verdad: repositorio privado con
 * GitHub Pages de pago, o un backend que valide la sesion antes de servir datos.
 */
const Acceso = (() => {
  // SHA-256 de la clave acordada. La clave en claro no aparece en el repositorio.
  const HASH = '103147728c15498a1f17227dc695253943faf5e48c7a7f82ab8b24805135406a';
  const LS = 'portal_acceso';

  async function sha256(texto) {
    const datos = new TextEncoder().encode(texto);
    const buf = await crypto.subtle.digest('SHA-256', datos);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const abrir = () => {
    document.getElementById('puerta').hidden = true;
    document.body.classList.remove('bloqueado');
    document.dispatchEvent(new CustomEvent('acceso-concedido'));
  };

  const cerrar = () => {
    document.getElementById('puerta').hidden = false;
    document.body.classList.add('bloqueado');
  };

  async function intentar() {
    const campo = document.getElementById('puerta-clave');
    const error = document.getElementById('puerta-error');
    const valor = campo.value.trim();
    if (!valor) return;

    if (await sha256(valor) === HASH) {
      try { sessionStorage.setItem(LS, '1'); } catch { /* modo privado */ }
      error.textContent = '';
      abrir();
    } else {
      error.textContent = 'Clave incorrecta.';
      campo.value = '';
      campo.focus();
    }
  }

  function iniciar() {
    let concedido = false;
    try { concedido = sessionStorage.getItem(LS) === '1'; } catch { /* modo privado */ }

    if (concedido) { abrir(); return true; }

    cerrar();
    document.getElementById('puerta-entrar').addEventListener('click', intentar);
    document.getElementById('puerta-clave').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') intentar();
    });
    setTimeout(() => document.getElementById('puerta-clave').focus(), 60);
    return false;
  }

  return { iniciar, sha256 };
})();
