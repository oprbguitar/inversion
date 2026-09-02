# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/). Fechas en
hora de Perú.

## [2026-09-02] Revisión de tasas y corte de setiembre

### Cambiado
- Corte de los datos base al **02/09/2026**: las 16 tasas se revisaron una a una en la web y los
  tarifarios oficiales de cada entidad.
- **Financiera SURGIR**: TREA máxima de 5.60% a **5.25%**.
- **Banco Falabella**: TREA corregida de 5.00% a **3.75%**. El 5.00% es la condición de cuenta
  sueldo, no la tasa de la Cuenta Ahorro Clásico; antes hacía que la TREA aplicable superara a la
  TREA máxima publicada en la propia tarjeta del ranking.
- **Financiera Confianza**: escala completa del tarifario de campaña de setiembre (T008-028,
  01/09–30/09/2026), de 0.75% hasta 5.00% según saldo promedio mensual, en lugar de un único tramo.
- **Scotiabank**: el tope remunerado pasa de S/500 a **S/3,000**, que es el saldo al que realmente
  se aplica el 9.70%; el exceso paga 0%.
- **Bancom**: las tasas de campaña rigen hasta el 31/01/2027 (antes se indicaba 31/12/2026).
- Entidades renombradas según el FSD y sus propias webs: **Efectibank (Banco Efectiva)**,
  **Compartamos Banco**, **Bancom (Banco de Comercio)** y **Financiera SURGIR (Santander
  Financiamientos)**. `marcas.json` conserva los logotipos bajo las nuevas denominaciones.
- El Excel descargable pasa a llamarse `Ranking_Cuentas_Ahorro_Peru_MEJORADO.xlsx`, sin el mes en
  el nombre, para que no quede desfasado en cada corte.
- Snapshot en vivo regenerado: tasa de referencia del BCRP **4.25%** (Ago.2026) y tipo de cambio
  SUNAT del 02/09/2026.

### Corregido
- Las fechas de verificación ya no se escriben dentro del campo de vigencia. La aplicación deduce
  el fin de campaña de la última fecha del texto, así que un "verificado el 02/09/2026" hacía que
  productos sin campaña aparecieran como "Vence en 0 días" y que la campaña vencida de Scotiabank
  se mostrara como vigente.

### Notas
- **Caja Cusco** y **Financiera Oh! / SIP** no se pudieron revalidar y quedan marcados como no
  verificados en su ficha.

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
