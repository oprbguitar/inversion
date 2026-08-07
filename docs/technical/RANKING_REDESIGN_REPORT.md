# RANKING_REDESIGN_REPORT

Rediseño del ranking guiado por el monto del usuario · 2026-08-07

## Problema de usabilidad anterior

El ranking funcionaba como un catálogo técnico: encabezaba con la **TREA máxima
publicada** y ordenaba por ella, aunque esa tasa casi nunca aplica a todo el saldo.
Un usuario con S/10,000 veía a Scotiabank (9.70%) en el primer puesto sin saber que
esa tasa solo cubre S/3,000, y que un producto al 5.00% sobre todo el saldo le
rinde más (S/500 frente a S/279). No usaba el monto de la persona, no distinguía
la tasa aplicable de la publicada, y las condiciones estaban repartidas en
insignias y párrafos.

## Mejoras implementadas

- **Barra de decisión** con monto (input + botones rápidos), plazo (3/6/12/24),
  modo de condiciones (sí / sin condiciones / ambos) y aporte mensual opcional.
  Recalcula con *debounce* y persiste en `localStorage`.
- **Resumen personalizado**: "Para S/X durante N meses — 16 analizados, 14
  compatibles, 2 requieren verificar, ganancia máxima estimada". Distingue TREA
  aplicable de TREA máxima publicada.
- **Resultados destacados** (hasta 3 tarjetas): mayor rendimiento estimado, menos
  condiciones, alternativa digital. Redacción no prescriptiva.
- **Tarjeta rediseñada**: el valor grande es la **ganancia estimada para tu monto**,
  no la TREA. Muestra TREA aplicable vs. máxima, saldo final, tope remunerado,
  excedente (marcado "no verificado" cuando corresponde), condiciones en una sola
  caja, estado de verificación y de campaña, y acciones Comparar / Simular /
  Ver fuente oficial siempre visibles.
- **Orden por defecto: mayor ganancia estimada** para el monto, no la TREA
  publicada. Ocho criterios de orden.
- **Compatibilidad explicada**: los incompatibles no se ocultan a la fuerza; se
  puede mostrarlos con el motivo (monto bajo el mínimo, campaña vencida, requiere
  condiciones, apertura presencial…).
- **Filtros simplificados**: fila principal (buscar + ordenar + Filtros con
  contador), chips rápidos (Digital, Sin mínimo, Sin mantenimiento, Verificado,
  FSD, Sin condiciones, Vigente) y cajón de filtros avanzados plegable.
- **Bandeja de comparación** pegajosa (hasta 3) y **diálogo de comparación** con
  13 criterios; en móvil se apila en tarjetas en vez de tabla ancha.
- **Cabecera más compacta** (menos relleno en cinta y relojes).

## Archivos modificados / creados

- `docs/index.html` — sección `#p-ranking` reescrita; SW/manifest ya presentes.
- `docs/assets/js/ranking.js` — reescrito (estado, compatibilidad, comparación).
- `docs/assets/css/estilos.css` — variables semánticas + componentes del rediseño.
- `docs/sw.js` — versión de caché a `v20260807c`.
- `tools/validar.py` — **nuevo**: validación de datasets (Sección 17).
- `.github/workflows/actualizar-datos.yml` — paso de validación antes de publicar.
- `docs/technical/GITHUB_ONLY_ADMIN_GUIDE.md` — **nuevo**.

## Motor financiero reutilizado (no se creó otro)

`Fmt.proyectar`, `Fmt.retornoReal` y, a través de ellos, `Motor.*`. El ranking no
contiene fórmulas financieras propias: solo lee entradas, clasifica y pinta.

## Comportamiento verificado (navegador local)

- Monto S/10,000: primer puesto = producto al 5.00% con **S/500** estimados,
  por encima de Scotiabank 9.70% (capado, ~S/279). El orden responde al monto.
- Monto S/3,000: Scotiabank sube al #1 (S/278.81), porque ya no hay excedente.
- Comparación: diálogo con 13 criterios × 2–3 columnas; en móvil, apilada.
- Filtros rápidos con contador; incompatibles con motivo ("La promoción venció").
- 360 px: sin desborde horizontal; una columna; tablas de comparación apiladas.
- Modo oscuro: superficie #17202c, acento verde adaptado.
- Sin errores de consola propios (solo CORS del BCRP y cuota de Twelve Data,
  ambos con degradación esperada).

## Accesibilidad

Roles y `aria-pressed` en segmentados y chips; `aria-live="polite"` en resumen y
conteo; foco no se mueve al cambiar el monto; diálogo con `dialog` nativo
(Escape cierra); objetivos táctiles amplios; información no transmitida solo por
color (texto + icono en estados). Pendiente: auditoría Lighthouse formal.

## Rendimiento

Sin framework ni librerías. Delegación de eventos en la rejilla; *debounce* en
monto y búsqueda; comparación sin re-render de la lista. Iconos inline/emoji.

## Limitaciones de GitHub Pages (conocidas)

- La puerta de acceso no es seguridad real (datos públicos).
- Sin panel de administración web: la administración es por edición de JSON +
  Python + Actions (ver `GITHUB_ONLY_ADMIN_GUIDE.md`).
- El rendimiento real usa un **supuesto** de inflación (2.0%, meta del BCRP),
  etiquetado como tal; no es una medición en vivo.

## Diferido (requiere backend, fuera de esta fase)

Portafolio persistente por usuario, autenticación real con roles, cola de
revisión de cambios con aprobación, alertas por email/Telegram. Todo marcado como
diferido en `AUDIT_REPORT.md`.

## Capturas antes/después

Pendientes de captura manual (el panel del navegador no estaba visible al generar
el informe). Reproducibles abriendo `#ranking` y variando el monto entre S/3,000
y S/10,000 para ver el reordenamiento.
