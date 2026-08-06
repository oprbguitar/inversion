# Portal de Ahorros Perú

Comparador de cuentas de ahorro en soles de bancos, financieras y cajas peruanas
supervisadas por la **SBS** y cubiertas por el **Fondo de Seguro de Depósitos (FSD)**.
Incluye ranking por TREA verificada, simulador de intereses por entidad, la serie de la
tasa de referencia del **BCRP**, contraste con **comparabien.com.pe**, búsqueda en vivo de
videos de finanzas en YouTube y descarga del Excel corregido.

> **Aviso.** Herramienta informativa y educativa. No es asesoría financiera ni recomendación
> para contratar ningún producto. Las tasas y condiciones cambian sin previo aviso: antes de
> abrir una cuenta o transferir fondos, verifica el contrato, la cartilla de información y el
> tarifario vigentes en la página oficial de la entidad.

---

## Secciones del portal

| Pestaña | Qué hace |
|---|---|
| **Ranking** | 16 entidades ordenadas por TREA, con filtros por tasa, modo de apertura y monto mínimo. Cada tarjeta muestra condiciones, vigencia de campaña, alertas y enlace a la fuente oficial. |
| **Simulador** | Ingresas monto, aporte mensual y plazo. Aplica la **escala real de tasas por saldo** de cada entidad y sus **topes de saldo remunerado**. Compara el mismo monto en las 16 entidades. |
| **Tasas BCRP** | Serie mensual de la tasa de referencia (PD04722MM), con gráfico y el *spread* que paga cada cuenta sobre la tasa de política monetaria. |
| **Seguridad / FSD** | Cobertura del Fondo de Seguro de Depósitos, simulador de cuánto de tu saldo queda cubierto y enlaces a los reguladores para verificar por tu cuenta. |
| **Mercado** | Productos publicados por comparabien.com.pe, extraídos automáticamente y contrastados con el ranking verificado. |
| **Videos** | Búsqueda en vivo en YouTube, acotada a finanzas en Perú o internacional. |
| **Descargas** | Excel mejorado, CSV generado en el navegador y los datasets JSON. |

---

## Cómo se actualizan los datos (esto es lo importante)

GitHub Pages sirve archivos estáticos: no hay servidor propio donde ejecutar código.
Y las fuentes se comportan distinto frente al navegador:

| Fuente | ¿Se puede llamar desde el navegador? | Cómo se resuelve aquí |
|---|---|---|
| **YouTube Data API v3** | **Sí.** Responde con CORS abierto. | Consulta **en vivo**, desde el navegador, cada vez que buscas. |
| **API del BCRP** | **No.** Devuelve JSON pero **sin** `Access-Control-Allow-Origin`, así que el navegador bloquea la respuesta. | GitHub Actions la consulta del lado del servidor y publica `docs/data/live.json`. El portal igual **intenta** la llamada directa en cada carga: si el BCRP habilita CORS algún día, pasa a usar el dato del minuto sin tocar el código. |
| **comparabien.com.pe** | **No.** Sin API ni CORS. | Se extrae del lado del servidor en el mismo workflow. |
| **SBS / FSD** | No publican una API abierta de tasas pasivas. | Se enlaza a los buscadores oficiales para verificación manual. |

El flujo es este:

```
GitHub Actions (2 veces al día + manual)
   └─ tools/fetch_live.py  → consulta BCRP + comparabien
   └─ tools/build_xlsx.py  → regenera el Excel descargable
   └─ commit + push        → despliega GitHub Pages

Navegador del usuario (en cada visita)
   └─ dataset.json          (base verificada)
   └─ live.json?t=<ahora>   (cache-busting: siempre la última versión publicada)
   └─ API del BCRP          (intento directo; falla por CORS y degrada en silencio)
   └─ YouTube API           (en vivo, al abrir la pestaña)
```

El indicador de la cabecera dice siempre de dónde salió cada dato: **BCRP en vivo**,
**Datos actualizados** (snapshot automático) o **Datos base** (archivo del Excel).
El botón ⟳ fuerza una recarga sin caché.

**Sobre "tiempo real":** ninguna entidad peruana publica una API de tasas de ahorro,
así que nadie puede leer la tasa de Scotiabank o Caja Piura en el segundo en que cambia
—ni este portal ni comparabien. Lo que sí se garantiza es que **cada visita trae la última
información publicada** y que cada tasa enlaza a la página oficial de la entidad para que
la contrastes antes de decidir. Ese enlace, y no la cifra en pantalla, es la fuente de verdad.

---

## Puesta en marcha

### 1. Publicar en GitHub Pages

En el repositorio: **Settings → Pages → Source: GitHub Actions**.
El workflow `.github/workflows/actualizar-datos.yml` despliega la carpeta `docs/` en cada push
y dos veces al día. También puedes lanzarlo a mano desde la pestaña **Actions → Actualizar datos
y publicar → Run workflow**.

Si prefieres el modo clásico sin workflow: **Settings → Pages → Source: Deploy from a branch →
`main` / carpeta `/docs`**.

### 2. Restringir la clave de YouTube ⚠️

La clave está **ofuscada** (XOR + base64) en `docs/assets/js/videos.js` para que no aparezca
como texto plano. **Eso no es cifrado.** Cualquier clave que use un sitio estático viaja al
navegador y puede recuperarse leyendo ese archivo — es una limitación de los sitios estáticos,
no de la ofuscación elegida. La protección real es del lado de Google:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → tu clave.
2. **Restricciones de aplicación → Sitios web (referrers HTTP)** → añade `https://oprbguitar.github.io/inversion/*`.
3. **Restricciones de API** → deja habilitada **solo** *YouTube Data API v3*.

Con esas dos restricciones, aunque alguien extraiga la clave, no puede usarla desde otro dominio
ni contra otras APIs de Google. **Hazlo antes de publicar el repositorio.**

La cuota gratuita es de 10,000 unidades/día y cada búsqueda cuesta 100, así que son ~100
búsquedas diarias. Por eso la pestaña Videos solo consulta al abrirse, no en cada visita.

### 3. Desarrollo local

```bash
pip install openpyxl
python tools/extract.py       # Excel original → docs/data/dataset.json
python tools/build_logos.py   # genera los logotipos SVG
python tools/fetch_live.py    # BCRP + comparabien → docs/data/live.json
python tools/build_xlsx.py    # genera el Excel mejorado
python -m http.server 8765 --directory docs
```

Ábrelo en `http://localhost:8765`. La pestaña BCRP mostrará "Datos actualizados" en vez de
"BCRP en vivo" porque el navegador bloquea la llamada directa por CORS: es el comportamiento
esperado, no un fallo.

---

## Estructura

```
docs/                        # raíz de GitHub Pages
├─ index.html
├─ assets/
│  ├─ css/estilos.css        # tema claro/oscuro, responsive
│  ├─ js/
│  │  ├─ datos.js            # carga y unifica las 3 fuentes
│  │  ├─ formato.js          # formato + motor financiero (TREA, tramos, topes)
│  │  ├─ graficos.js         # gráficos SVG sin librerías
│  │  ├─ ranking.js  simulador.js  bcrp.js
│  │  ├─ seguridad.js  mercado.js  videos.js  descargas.js
│  │  └─ app.js              # pestañas, tema, orquestación
│  └─ logos/*.svg            # un logotipo por entidad
├─ data/
│  ├─ dataset.json           # base verificada (del Excel)
│  ├─ live.json              # snapshot automático ← lo actualiza Actions
│  └─ marcas.json
└─ descargas/*.xlsx          # Excel mejorado ← lo regenera Actions

tools/
├─ extract.py      # Excel → JSON, corrigiendo las celdas dañadas
├─ fetch_live.py   # BCRP + comparabien (server-side)
├─ build_logos.py
└─ build_xlsx.py   # JSON → Excel mejorado

.github/workflows/actualizar-datos.yml
```

---

## Qué se corrigió del Excel original

El archivo original tenía defectos que impedían usarlo como fuente de datos:

1. **Celdas numéricas guardadas con formato de fecha.** El monto mínimo de SURGIR (S/20,000)
   se leía como `1954-10-03`; el de Caja Arequipa (S/50,000) como `2036-11-21`. Se revirtió el
   serial de Excel al número original en `tools/extract.py`.
2. **Fórmulas rotas.** Varias celdas devolvían `#VALUE!` porque operaban sobre esas fechas.
3. **Ranking transpuesto.** Estaba en horizontal, una columna por entidad — imposible de filtrar
   u ordenar. Ahora es una fila por entidad.
4. **Sin orden.** Ahora va por TREA descendente y numerado.
5. **Sin autofiltro ni formato condicional.** Se añadieron escalas de color en las TREA y
   semáforo en el estado de verificación.
6. **Escalas de tasa dispersas** en 16 hojas: consolidadas en una sola hoja filtrable.

El Excel mejorado (8 hojas) incluye además un **simulador con fórmulas vivas**: cambias el monto
y el plazo y recalcula las 16 entidades, respetando los topes de saldo remunerado.

---

## Notas metodológicas

- **TREA, no TEA.** La TREA ya incluye comisiones y gastos del producto, así que es la única
  cifra comparable entre entidades. comparabien publica TEA, por eso la pestaña Mercado advierte
  que las cifras no son directamente comparables.
- **Casi todas las tasas altas tienen condiciones**: cliente nuevo, apertura 100% digital, abono
  de sueldo o saldo mínimo. Y muchas limitan el saldo remunerado — Scotiabank paga 9.70% solo
  hasta S/3,000, y el exceso va a tasa regular. El simulador lo modela.
- **Tasa mensual equivalente**: `(1 + TREA)^(1/12) − 1`, con capitalización mensual.
- **Estado de verificación**: verde = confirmado en fuente oficial; ámbar = tasa confirmada con
  algún dato pendiente; rojo = requiere verificación directa antes de contratar.
- Los datos base tienen corte al **06/08/2026**. Tres entidades (Caja Cusco, Compartamos y Banco
  de Comercio) provienen de una reconstrucción del video de referencia y están marcadas
  explícitamente: verifícalas en la entidad antes de decidir.

## Logotipos

Se generan como monogramas SVG en el color corporativo de cada marca, siempre acompañados del
nombre de la entidad. No se descargan ni se enlazan los logotipos originales: son marcas
registradas de sus titulares y el hotlinking a los servidores de cada banco se rompe con
frecuencia. Los colores y nombres se usan solo con fines identificativos.

## Fuentes oficiales

- [SBS — Compara y elige](https://www.sbs.gob.pe/usuarios/aprende-con-la-sbs/compara-y-elige)
- [SBS — Entidades supervisadas](https://www.sbs.gob.pe/supervisados-y-registros/entidades-supervisadas)
- [Fondo de Seguro de Depósitos](https://fsd.org.pe/)
- [BCRP — Serie PD04722MM](https://estadisticas.bcrp.gob.pe/estadisticas/series/mensuales/resultados/PD04722MM/html)
- [comparabien.com.pe/ahorros](https://comparabien.com.pe/ahorros)

## Licencia

Código bajo licencia MIT. Los datos provienen de fuentes públicas de cada entidad y de los
organismos reguladores; las marcas pertenecen a sus respectivos titulares.
