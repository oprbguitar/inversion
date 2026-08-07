# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/). Fechas en
hora de Perú.

## [2026-08-07] Rediseño del ranking guiado por el monto

### Añadido
- Ranking guiado por el monto del usuario: barra de decisión (monto, plazo,
  condiciones, aporte), resumen personalizado, 3 resultados destacados,
  comparación de hasta 3 productos y explicación de incompatibilidades.
- Filtros simplificados: chips rápidos + cajón de filtros avanzados con contador.
- `tools/validar.py`: validación de datasets; corre en el workflow antes de
  publicar y evita sobrescribir el snapshot verificado con datos malformados.
- Documentación: `RANKING_REDESIGN_REPORT.md`, `GITHUB_ONLY_ADMIN_GUIDE.md`.

### Cambiado
- Orden por defecto del ranking: **mayor ganancia estimada para tu monto**, ya no
  la TREA máxima publicada.
- Tarjeta de producto: el valor destacado es la ganancia estimada; se distingue
  TREA aplicable de TREA máxima publicada.
- Cabecera más compacta (menos relleno en cinta y relojes).
- Caché del service worker a `v20260807c` para servir la nueva interfaz.

### Reutilizado
- Motor financiero compartido (`Fmt.proyectar`, `Fmt.retornoReal`). El ranking no
  añade fórmulas propias.

## [2026-08-07] Uso sin conexión (PWA)
- Service worker (`docs/sw.js`) y manifest: el portal funciona offline tras la
  primera visita; aviso de "sin conexión"; las APIs externas fallan con gracia.

## [2026-08-07] Motor financiero con pruebas (Fase 0)
- Motor puro `docs/assets/js/motor.js` con 14 pruebas (`node --test`) y CI.
- Corrección: el saldo por encima del tope remunerado ya no desaparece del
  cálculo; se reporta el excedente (tasa regular `null` cuando no está verificada).

## [2026-08-06] Base del portal
- Ranking, simulador, tarjetas de crédito, entidades SBS, BCRP, FSD, comparabien,
  mercados (Twelve Data), tipo de cambio, relojes, videos y descargas. Excel
  reconstruido. Despliegue en GitHub Pages desde `main:/docs`.
