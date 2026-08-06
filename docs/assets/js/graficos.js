/* Graficos SVG minimos, sin librerias externas (la CSP de GitHub Pages y el
   requisito de portal autocontenido descartan CDNs). Se dibuja con el mismo
   viewBox del HTML y los colores salen de las variables CSS del tema. */
const Graficos = (() => {
  const SVG = 'http://www.w3.org/2000/svg';

  const crear = (tag, attrs = {}) => {
    const el = document.createElementNS(SVG, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  function limpiar(svg) {
    // Conserva el <title> accesible declarado en el HTML.
    [...svg.childNodes].forEach((n) => { if (n.nodeName !== 'title') n.remove(); });
  }

  /**
   * Grafico de linea con area, rejilla y eje. `puntos` = [{x: etiqueta, y: numero}]
   * `fmtY` formatea las etiquetas del eje vertical.
   */
  function linea(svg, puntos, { fmtY = (v) => v.toFixed(2), maxEtiquetas = 8, segunda = null } = {}) {
    limpiar(svg);
    if (!puntos.length) return;

    const [, , W, H] = svg.getAttribute('viewBox').split(' ').map(Number);
    const m = { t: 14, r: 14, b: 34, l: 52 };
    const ancho = W - m.l - m.r;
    const alto = H - m.t - m.b;

    const ys = puntos.map((p) => p.y).concat(segunda ? segunda.map((p) => p.y) : []);
    let min = Math.min(...ys);
    let max = Math.max(...ys);
    const pad = (max - min) * 0.15 || Math.abs(max * 0.1) || 1;
    min -= pad; max += pad;

    const X = (i) => m.l + (puntos.length === 1 ? ancho / 2 : (i / (puntos.length - 1)) * ancho);
    const Y = (v) => m.t + alto - ((v - min) / (max - min)) * alto;

    // Rejilla horizontal + etiquetas del eje Y
    for (let i = 0; i <= 4; i += 1) {
      const v = min + ((max - min) * i) / 4;
      const y = Y(v);
      svg.appendChild(crear('line', { class: 'g-rejilla', x1: m.l, y1: y, x2: W - m.r, y2: y }));
      const t = crear('text', { class: 'g-texto', x: m.l - 8, y: y + 4, 'text-anchor': 'end' });
      t.textContent = fmtY(v);
      svg.appendChild(t);
    }

    // Eje X
    svg.appendChild(crear('line', { class: 'g-eje', x1: m.l, y1: m.t + alto, x2: W - m.r, y2: m.t + alto }));

    const paso = Math.max(1, Math.ceil(puntos.length / maxEtiquetas));
    puntos.forEach((p, i) => {
      if (i % paso && i !== puntos.length - 1) return;
      const t = crear('text', { class: 'g-texto', x: X(i), y: m.t + alto + 18, 'text-anchor': 'middle' });
      t.textContent = p.x;
      svg.appendChild(t);
    });

    const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
    svg.appendChild(crear('path', {
      class: 'g-area',
      d: `${d} L${X(puntos.length - 1).toFixed(1)},${m.t + alto} L${X(0).toFixed(1)},${m.t + alto} Z`,
    }));
    svg.appendChild(crear('path', { class: 'g-linea', d }));

    if (segunda && segunda.length) {
      const d2 = segunda.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
      svg.appendChild(crear('path', { class: 'g-linea-2', d: d2 }));
    }

    // Puntos con tooltip nativo (<title>): funciona con teclado y lector de pantalla.
    puntos.forEach((p, i) => {
      const c = crear('circle', { class: 'g-punto', cx: X(i), cy: Y(p.y), r: puntos.length > 40 ? 2 : 3.5 });
      const t = crear('title');
      t.textContent = `${p.x}: ${fmtY(p.y)}`;
      c.appendChild(t);
      svg.appendChild(c);
    });
  }

  /** Barras verticales. `datos` = [{x, y}] */
  function barras(svg, datos, { fmtY = (v) => v.toFixed(2), color = null } = {}) {
    limpiar(svg);
    if (!datos.length) return;

    const [, , W, H] = svg.getAttribute('viewBox').split(' ').map(Number);
    const m = { t: 14, r: 14, b: 46, l: 52 };
    const ancho = W - m.l - m.r;
    const alto = H - m.t - m.b;
    const max = Math.max(...datos.map((d) => d.y)) * 1.12 || 1;

    for (let i = 0; i <= 4; i += 1) {
      const v = (max * i) / 4;
      const y = m.t + alto - (v / max) * alto;
      svg.appendChild(crear('line', { class: 'g-rejilla', x1: m.l, y1: y, x2: W - m.r, y2: y }));
      const t = crear('text', { class: 'g-texto', x: m.l - 8, y: y + 4, 'text-anchor': 'end' });
      t.textContent = fmtY(v);
      svg.appendChild(t);
    }

    const paso = ancho / datos.length;
    const w = Math.min(paso * 0.62, 46);
    datos.forEach((d, i) => {
      const h = (d.y / max) * alto;
      const x = m.l + paso * i + (paso - w) / 2;
      const r = crear('rect', {
        class: 'g-barra', x, y: m.t + alto - h, width: w, height: Math.max(h, 1), rx: 3,
      });
      if (color) r.setAttribute('fill', color(d, i));
      const t = crear('title');
      t.textContent = `${d.x}: ${fmtY(d.y)}`;
      r.appendChild(t);
      svg.appendChild(r);
    });

    svg.appendChild(crear('line', { class: 'g-eje', x1: m.l, y1: m.t + alto, x2: W - m.r, y2: m.t + alto }));
  }

  return { linea, barras };
})();
