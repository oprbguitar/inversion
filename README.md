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
| **Ranking** | 16 entidades ordenadas por TREA, con filtros por tasa, modo de apertura y monto mínimo. **Dos vistas**: cuadrícula (tarjetas compactas) o lista detallada (los 14 campos desplegados, con el enlace a la entidad visible). La preferencia se recuerda. |
| **Tarjetas de crédito** | 17 tarjetas comparadas por **TCEA** (tasa + comisiones + seguros), donde gana la **más baja**. Simulador de compra en cuotas con sistema francés y escenario de pago mínimo. |
| **Entidades SBS** | Relación completa de las **41 entidades autorizadas** a captar depósitos (bancos, financieras, cajas municipales y rurales), extraída automáticamente. |
| **Simulador** | Ingresas monto, aporte mensual y plazo. Aplica la **escala real de tasas por saldo** de cada entidad y sus **topes de saldo remunerado**. Compara el mismo monto en las 16 entidades. |
| **Tasas BCRP** | Serie mensual de la tasa de referencia (PD04722MM), con gráfico y el *spread* que paga cada cuenta sobre la tasa de política monetaria. |
| **Seguridad / FSD** | Cobertura del Fondo de Seguro de Depósitos, simulador de cuánto de tu saldo queda cubierto y enlaces a los reguladores para verificar por tu cuenta. |
| **Comparabien** | Todo lo que publica comparabien.com.pe sin pedir datos personales: productos con tasa, las **30 entidades** que declara comparar y sus criterios de comparación, contrastado con el ranking verificado. |
| **Mercados** | Dashboard de cotizaciones en vivo (Twelve Data): divisas, índices, empresas peruanas en NYSE y materias primas. Incluye el directorio de entidades financieras y enlace al proyecto BolsaVL. |
| **Videos** | Búsqueda en vivo en YouTube, acotada a finanzas en Perú o internacional. |
| **Descargas** | Excel mejorado (con la fecha de descarga en el nombre), CSV generado en el navegador y los datasets JSON. |

Además, en todas las pestañas: **cinta de cotizaciones** superior (con botón de pausa),
**relojes en vivo de Perú y Nueva York** con estado del mercado estadounidense, y el
**tipo de cambio del dólar** en vivo junto al oficial de SUNAT.

## Funciona sin conexión (PWA)

El portal es una **aplicación web progresiva**: un *service worker* ([docs/sw.js](docs/sw.js))
guarda la aplicación y los datos en el dispositivo, así que tras la primera visita **funciona
sin conexión**. Puedes incluso instalarlo como app desde el navegador (manifest en
[docs/manifest.webmanifest](docs/manifest.webmanifest)).

Qué funciona offline: ranking, simulador, tarjetas de crédito, entidades SBS, FSD, la serie del
BCRP y las descargas — todo se sirve desde la copia guardada. Qué no: las cotizaciones en vivo
(Twelve Data), los videos de YouTube y el tipo de cambio de mercado necesitan red; sin conexión
cada módulo muestra su estado de "no disponible" en vez de fallar, y un aviso ámbar indica que se
están mostrando los últimos datos guardados. Las cotizaciones **no se cachean**: serían datos
viejos disfrazados de actuales.

## Motor financiero con pruebas

El cálculo vive en un módulo puro y sin dependencias ([docs/assets/js/motor.js](docs/assets/js/motor.js))
con **14 pruebas automatizadas** ([tests/motor.test.js](tests/motor.test.js)) que corren con
`node --test` —sin `npm install`— y en CI en cada push
([.github/workflows/pruebas.yml](.github/workflows/pruebas.yml)).

```bash
node --test
```

Corrige un defecto real: el saldo por encima del **tope remunerado** ya no desaparece del cálculo.
Se separan interés promocional, interés del excedente, interés de aportes, mantenimiento e ITF.
Cuando la fuente no publica la tasa del excedente, se deja en `null` (no se inventa un número) y ese
saldo se reporta como "no verificado" en vez de ocultarse. Ver
[docs/technical/AUDIT_REPORT.md](docs/technical/AUDIT_REPORT.md).

---

## Cómo se actualizan los datos (esto es lo importante)

GitHub Pages sirve archivos estáticos: no hay servidor propio donde ejecutar código.
Y las fuentes se comportan distinto frente al navegador:

| Fuente | ¿Se puede llamar desde el navegador? | Cómo se resuelve aquí |
|---|---|---|
| **YouTube Data API v3** | **Sí.** Responde con CORS abierto. | Consulta **en vivo**, desde el navegador, cada vez que buscas. |
| **Twelve Data** | **Sí.** `Access-Control-Allow-Origin: *`. | Cotizaciones **en vivo** desde el navegador, con la clave que tú introduces. |
| **API del BCRP** | **No.** Devuelve JSON pero **sin** `Access-Control-Allow-Origin`, así que el navegador bloquea la respuesta. | GitHub Actions la consulta del lado del servidor y publica `docs/data/live.json`. El portal igual **intenta** la llamada directa en cada carga: si el BCRP habilita CORS algún día, pasa a usar el dato del minuto sin tocar el código. |
| **comparabien.com.pe** | **No.** Sin API ni CORS. | Se extrae del lado del servidor en el mismo workflow. Ver la limitación del formulario más abajo. |
| **open.er-api.com** | **Sí.** CORS abierto y sin clave. | Tipo de cambio USD/PEN de mercado, en vivo para todos los visitantes. |
| **apis.net.pe (SUNAT)** | **No.** Sin CORS. | Tipo de cambio oficial (compra/venta) por GitHub Actions. |
| **FSD (fsd.org.pe)** | **No.** Sin CORS. | Relación de entidades autorizadas, extraída del lado del servidor. |
| **SBS** | **No.** Su portal está tras protección anti-bot (Incapsula). | **No se scrapea.** Se usa la lista del FSD (organismo administrado por la SBS) y se enlaza al registro oficial para verificación manual. |

### Entidades autorizadas: por qué la lista viene del FSD y no de la SBS

La web de la SBS responde con un reto de Incapsula a cualquier petición automatizada. No se intenta
sortearlo. En su lugar se extrae la **relación de miembros del Fondo de Seguro de Depósitos**
(`fsd.org.pe/miembros/`), organismo administrado por la propia SBS: por ley, toda empresa autorizada a
captar depósitos del público es miembro del FSD, así que la lista es equivalente para este fin.

Son **41 entidades**: 20 bancos, 5 financieras, 11 cajas municipales y 5 cajas rurales.

**Las cooperativas de ahorro y crédito (COOPAC) no están en esa lista.** Están en el registro de la
SBS pero cuentan con un fondo de seguro propio y distinto del FSD. El portal lo advierte de forma
explícita para no dar a entender que tienen la misma cobertura.

### Tarjetas de crédito: dataset curado, no automatizado

Ninguna entidad peruana publica una API de tasas de tarjeta, y el comparador oficial (Retasas de la
SBS) está tras la misma protección anti-bot. El dataset (`docs/data/tarjetas.json`) es **curado** y
cada tarjeta declara su nivel de verificación y enlaza a la página oficial del producto. Solo las
cifras de Interbank pudieron leerse directamente de su web; el resto son **referenciales** y están
marcadas como tales en la interfaz. Sirven para comparar órdenes de magnitud y alimentar el
simulador, no para asumir la tasa que te van a aplicar.

### Qué se extrae de comparabien y qué no

Se extrae automáticamente todo lo que publican **sin pedir datos personales**: los productos
destacados con su tasa, las **30 entidades** que declaran comparar y los criterios de su tabla.

La **tabla completa de resultados no se extrae**, y es una decisión deliberada: su formulario exige
un **correo electrónico obligatorio** (campo `email`, `required`) con casilla de suscripción. Rellenarlo
automáticamente dos veces al día inyectaría contactos falsos en su sistema de captación de forma
indefinida. El portal enlaza a su formulario para que lo consultes tú con tu propio correo.

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

Ya está configurado: **Settings → Pages → Source: Deploy from a branch → `main` / `/docs`**.
El sitio se republica solo con cada commit a `main`, sin depender de GitHub Actions.

El workflow `.github/workflows/actualizar-datos.yml` se encarga únicamente de **refrescar los
datos** (BCRP + comparabien) dos veces al día y regenerar el Excel; al hacer commit, Pages se
reconstruye solo. Puedes lanzarlo a mano desde **Actions → Actualizar datos y publicar →
Run workflow**. Si esa acción falla o se retrasa, el sitio sigue en línea con los últimos datos
publicados.

### 2. Restringir la clave de YouTube ⚠️

La clave está **ofuscada** (XOR + base64) en `docs/assets/js/videos.js` para que no aparezca
como texto plano. **Eso no es cifrado.** Cualquier clave que use un sitio estático viaja al
navegador y puede recuperarse leyendo ese archivo — es una limitación de los sitios estáticos,
no de la ofuscación elegida. La protección real es del lado de Google:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → tu clave.
2. **Restricciones de aplicación → Sitios web (referrers HTTP)** → añade exactamente:
   ```
   https://oprbguitar.github.io/*
   ```
   ⚠️ **Sin la ruta `/inversion/`.** Los navegadores solo envían el **origen** en el referrer de
   peticiones entre dominios (política `strict-origin-when-cross-origin`), así que Google recibe
   `https://oprbguitar.github.io/` sin la ruta. Un patrón como
   `https://oprbguitar.github.io/inversion/*` **nunca llega a coincidir** y todas las peticiones
   se rechazan con `Requests from referer ... are blocked`.
3. **Restricciones de API** → deja habilitada **solo** *YouTube Data API v3*.

Como `oprbguitar.github.io` es tu subdominio personal de GitHub Pages, ese patrón limita la clave
a tus propios sitios.

Con esas dos restricciones, aunque alguien extraiga la clave, no puede usarla desde otro dominio
ni contra otras APIs de Google. **Hazlo antes de publicar el repositorio.**

La cuota gratuita es de 10,000 unidades/día y cada búsqueda cuesta 100, así que son ~100
búsquedas diarias. Por eso la pestaña Videos solo consulta al abrirse, no en cada visita.

### 3. Clave de Twelve Data (cotizaciones)

**No está en el repositorio**, por decisión expresa. Cada usuario la introduce una vez en la pestaña
**Mercados** y queda guardada solo en su navegador (`localStorage`); nunca se envía a otro sitio que
no sea la propia API de Twelve Data.

Límites del plan gratuito: **8 créditos por minuto y 800 al día**, y **cada instrumento cuesta 1
crédito** (no cada petición). Por eso el dashboard consulta 8 instrumentos y refresca cada 5 minutos.
Si superas la cuota, la interfaz lo explica y basta con esperar un minuto.

### 4. Clave de acceso al portal ⚠️

El portal se abre con una puerta de acceso. **Esto es una barrera de conveniencia, no seguridad
real**, y conviene tenerlo claro antes de confiar nada a esa clave:

- En GitHub Pages **todos los archivos son públicos**. Cualquiera puede abrir
  `docs/data/dataset.json` directamente, sin pasar por la puerta.
- El JavaScript de la puerta es visible; se puede desactivar el overlay desde las herramientas de
  desarrollo del navegador.
- Se guarda el **hash SHA-256** de la clave, no la clave en claro, para que no aparezca literal en el
  repositorio. Pero un hash sin sal de una clave corta se rompe por fuerza bruta en segundos.

Sirve para que el portal no quede abierto a quien llegue por casualidad. **No sirve para proteger
información confidencial.** Si hiciera falta control de acceso real: repositorio privado con GitHub
Pages de pago, o un backend que valide la sesión antes de servir los datos.

Para cambiar la clave, sustituye el hash en `docs/assets/js/acceso.js`:

```bash
python -c "import hashlib; print(hashlib.sha256('TU-NUEVA-CLAVE'.encode()).hexdigest())"
```

### 5. Desarrollo local

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
│  │  ├─ acceso.js           # puerta de acceso (barrera de conveniencia)
│  │  ├─ datos.js            # carga y unifica las fuentes
│  │  ├─ formato.js          # formato + motor financiero (TREA, tramos, topes)
│  │  ├─ graficos.js         # gráficos SVG sin librerías
│  │  ├─ ranking.js          # vistas cuadrícula y lista
│  │  ├─ simulador.js  bcrp.js  seguridad.js
│  │  ├─ mercado.js          # comparabien
│  │  ├─ mercados.js         # cotizaciones, cinta y relojes (Twelve Data)
│  │  ├─ videos.js  descargas.js
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
