# AUDIT_REPORT — Portal de Ahorros Perú

Fecha de auditoría: 2026-08-07 · Rama: `main` · Commit base: `01040b2`

Este informe cubre la **Fase 0** del programa de transformación: auditoría del estado
actual y estabilización del motor de cálculo. Es un documento vivo; las fases 1–6
(backend, administración, portafolio, mercados ampliados) se describen como plan, no
como trabajo ya ejecutado.

---

## 1. Arquitectura existente

Sitio **estático** servido por GitHub Pages desde `main:/docs`. Sin backend. Sin framework.
HTML + CSS + JavaScript modular por IIFE global (`App`, `Datos`, `Fmt`, `Ranking`, …).

```
docs/
├─ index.html                 # una sola página, 10 pestañas conmutadas por JS
├─ assets/css/estilos.css      # ~1000 líneas, tema claro/oscuro, responsive
├─ assets/js/
│  ├─ acceso.js    puerta de acceso (SHA-256; barrera de conveniencia)
│  ├─ datos.js     carga y unifica dataset.json + live.json + intentos en vivo
│  ├─ motor.js     ◀ NUEVO: motor financiero puro (con pruebas)
│  ├─ formato.js   formato + envoltura del motor para el navegador
│  ├─ graficos.js  gráficos SVG sin librerías
│  ├─ ranking.js   simulador.js  bcrp.js  seguridad.js
│  ├─ mercado.js   (comparabien)  mercados.js (Twelve Data + relojes + TC)
│  ├─ tarjetas.js  entidades.js  videos.js  descargas.js
│  └─ app.js       orquestación: pestañas, tema, carga
├─ data/  dataset.json · live.json · tarjetas.json · marcas.json
└─ descargas/  Excel mejorado (10 hojas)

tools/   extract.py · fetch_live.py · build_logos.py · build_xlsx.py
tests/   motor.test.js  ◀ NUEVO
```

## 2. Funciones que operan correctamente (verificadas en navegador)

- **Ranking** de 16 cuentas, filtros y dos vistas (cuadrícula/lista), preferencia recordada.
- **Simulador** de ahorro con escala de tasas por tramo y tope remunerado.
- **Tarjetas de crédito**: 17 productos por TCEA, simulador de cuotas (sistema francés
  verificado: S/3,000 a 39.29% / 12 = S/297.80/mes).
- **Entidades SBS**: 41 entidades autorizadas extraídas de la lista de miembros del FSD.
- **BCRP**: serie de 36 meses con degradación elegante cuando la API bloquea por CORS.
- **FSD**, **Comparabien** (30 entidades), **Mercados** (Twelve Data en vivo, 8 instrumentos),
  **tipo de cambio** (open.er-api en vivo + SUNAT oficial), **relojes** PE/EE.UU., **Videos**
  (YouTube en vivo), **Descargas** (Excel/CSV/JSON).

## 3. Módulos reutilizables desde `bvl22072026`

Inspeccionado (`index.html`, 55 KB monolítico). Reutilizable, **previa refactorización a
módulos** (no copiar el monolito):

| Función | Estado en este portal | Acción |
|---|---|---|
| Cinta de cotizaciones (`#tape`) | Ya integrada (`mercados.js`) | Hecho |
| Puerta de acceso (`#gate`, SHA-256) | Ya integrada (`acceso.js`) | Hecho |
| Tipo de cambio (open.er-api) | Ya integrado | Hecho |
| CoinGecko (cripto + histórico) | No integrado | Fase 3 — módulo `markets/cripto` |
| Finnhub (acciones/noticias) | No integrado | Fase 3 — requiere clave del usuario |
| Material educativo BVL / fondos mutuos | No integrado | Fase 3 — módulos `funds/`, `aprende/` |
| Calculadora de interés compuesto | Sustituida por `motor.js` | Consolidar |
| Guía de intermediarios y checklist | No integrado | Fase 3 — `aprende/` |

## 4. Defecto de cálculo corregido en esta fase

**Síntoma:** el saldo por encima del tope remunerado desaparecía del cálculo. En
`formato.js` (versión anterior), `proyectar()` calculaba interés solo sobre
`saldoRemunerado = min(saldo, tope)`; el excedente no aparecía por ningún lado.

**Corrección:** motor nuevo (`motor.js`) que separa explícitamente interés promocional,
interés del excedente, interés de aportes, mantenimiento e ITF. El excedente se
**reporta** siempre (`excedenteInicial`, `excedentePromedio`, `excedenteNoVerificado`) y
gana la tasa regular cuando esté verificada.

**Decisión de honestidad:** la fuente no publica un número verificado para la tasa del
excedente, así que `tasaRegular = null` y el excedente rinde 0 **pero visible**, en vez de
inventar una cifra (principio 18: no fabricar tasas). Resultado backward-compatible:
Scotiabank S/10,000 / 12 meses sigue dando S/278.81, ahora con el excedente de S/7,000 a
la vista y marcado como no verificado.

Cobertura de pruebas: `tests/motor.test.js`, 14 casos, `node --test`, sin dependencias.
Cubre monto bajo el mínimo, en el umbral, en el tope, sobre el tope, campaña no cumplida,
aportes, mantenimiento, ITF, retorno real negativo/positivo y datos incompletos.

## 5. Riesgos identificados (pendientes por fase)

**Seguridad**
- La puerta de acceso (`acceso.js`) **no es seguridad**: en Pages todo archivo es público.
  Adecuada solo como barrera de conveniencia. Cualquier dato privado (portafolio, usuarios,
  administración) exige backend con autorización server-side → **Fase 4**.
- Claves de terceros: YouTube va ofuscada + restringida por dominio; Twelve Data la
  introduce el usuario y queda solo en su navegador. Ninguna clave privada en el repo.

**Calidad de datos**
- `dataset.json` mezcla conceptos en campos ambiguos (`saldo_tasa_max` = umbral mínimo en
  unos casos, tope en otros). La estructura normalizada explícita (Sección 5 del encargo)
  está definida en el motor pero **aún no propagada a todo el dataset** → Fase 1.
- Tarjetas de crédito: 16 de 17 tasas son **referenciales** (solo Interbank leída de fuente
  oficial). Ya marcadas como tales en la interfaz.
- Sin estados de frescura por dato (`LIVE`/`STALE`/`DEMO`…) → Fase 1.

**UI / accesibilidad**
- Sin auditoría Lighthouse formal aún. Responsive verificado a 375px sin desbordes.
- Falta home guiado (arranca en tabla de ranking) → Fase 2.

**Despliegue**
- GitHub Actions en esta cuenta encola builds durante horas. Mitigado sirviendo Pages desde
  `main:/docs` directamente; la acción solo refresca datos.

## 6. Arquitectura objetivo y estrategia

Se conserva el frontend estático como capa pública con *snapshots* de respaldo. El backend
(Fase 4) se introduce **solo** para lo que lo exige de verdad: autenticación real,
portafolios persistentes, panel de administración, ingesta programada y credenciales
protegidas. Decisión de proveedor pendiente de confirmación del usuario (Supabase +
Cloudflare Workers es la recomendación; requiere cuentas).

## 7. Fases

- **Fase 0 (esta) — hecho:** auditoría, motor corregido + pruebas, CI de pruebas.
- **Fase 1:** normalizar el modelo de datos, estados de frescura, procedencia por dato.
- **Fase 2:** home guiado, cuestionario de compatibilidad, navegación unificada.
- **Fase 3:** depósitos a plazo, fondos mutuos, renta fija, BVL, mercado global (reutiliza bvl22072026).
- **Fase 4:** backend, autenticación, roles, administración, ingesta (requiere cuentas/credenciales).
- **Fase 5:** portafolio, calendario, alertas, exportaciones.
- **Fase 6:** pruebas completas, QA, accesibilidad, rendimiento, seguridad, despliegue.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Reescritura total rompe lo que funciona | Motor nuevo es aditivo; `proyectar` conserva claves; verificado en navegador |
| Fabricar tasas no verificadas | `null` explícito + marca "no verificado"; nunca un número inventado |
| Fuentes oficiales tras anti-bot (SBS) | No se evade; se usa fuente equivalente (FSD) y se enlaza al registro oficial |
| Builds de Pages encolados | Pages sirve `main:/docs`; la acción solo refresca datos |
| Secretos en frontend | Ninguna clave privada en repo; backend futuro con variables de entorno |
