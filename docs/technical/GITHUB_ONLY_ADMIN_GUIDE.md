# GITHUB_ONLY_ADMIN_GUIDE

Administración del portal sin backend. Todo se gestiona editando archivos y
ejecutando herramientas Python; GitHub Pages publica desde `main:/docs`.

> No existe panel de administración web, y es deliberado: en GitHub Pages no hay
> autorización server-side. La administración es por commits revisables en Git.

## Archivos que se editan

| Archivo | Contenido |
|---|---|
| `docs/data/dataset.json` | Ranking de ahorro, fichas, tramos, FSD, notas (base verificada). |
| `docs/data/tarjetas.json` | Tarjetas de crédito (curado). |
| `docs/data/live.json` | Snapshot automático (BCRP, comparabien, FSD, tipo de cambio). **No editar a mano.** |
| Excel fuente | Origen del dataset; se procesa con `tools/extract.py`. |

Siempre **validar** antes de confirmar:

```bash
python tools/validar.py
```

Rechaza porcentajes imposibles, montos negativos, fechas inválidas, fin de
campaña antes del inicio, URLs de fuente ausentes, estados de FSD desconocidos,
productos duplicados, nombres vacíos y topes negativos. En GitHub Actions corre
antes de publicar: si falla, no se hace commit y se conserva el snapshot bueno.

## 1. Actualizar un producto

1. Edita el objeto correspondiente en `docs/data/dataset.json` (dentro de `ranking`
   y su ficha en `fichas`).
2. `python tools/validar.py` → debe decir "Validacion OK".
3. `python tools/build_xlsx.py` para regenerar el Excel.
4. Commit describiendo el cambio y `git push`. Pages se reconstruye solo.

## 2. Añadir una institución

1. Añade una entrada a `ranking` con todos los campos (usa una existente como
   plantilla) y su ficha en `fichas` (con `tramos` y `simulador.tope_remunerado`).
2. Añade el logo/monograma: `python tools/build_logos.py` regenera los SVG y
   `marcas.json` a partir de la lista de entidades.
3. Valida, regenera Excel, commit, push.

## 3. Marcar un producto como verificado

Pon en `verificacion` un texto que empiece por **"Verificado"** (el frontend lo
pinta en verde). "Verificación parcial" → ámbar; "Requiere confirmación" → rojo.
Añade la fecha de verificación dentro del propio texto.

## 4. Marcar una campaña como vencida

El estado de campaña se deduce de las fechas `dd/mm/aaaa` en `vigencia`. Para que
figure como vencida, deja una fecha de fin anterior a hoy. El ranking la marca
"Campaña vencida" y la trata como incompatible (con motivo visible).

## 5. Lanzar GitHub Actions a mano

Pestaña **Actions → "Actualizar datos y publicar" → Run workflow**. Consulta BCRP,
comparabien, FSD y tipo de cambio, valida, regenera el Excel y hace commit solo si
algo cambió.

## 6. Revisar los cambios generados

Cada actualización automática es un commit `datos: actualizacion automatica ...`.
Revísalo con `git show <hash>` o en el historial de GitHub. Si un cambio no
convence, revierte ese commit: `git revert <hash>`.

## 7. Regenerar los descargables

```bash
python tools/build_xlsx.py   # Excel (10 hojas)
```

El CSV y los JSON se generan en el navegador / ya están en `docs/data`.

## 8. Restaurar el snapshot verificado anterior

`docs/data/live.json` está versionado en Git. Para volver a una versión buena:

```bash
git log --oneline -- docs/data/live.json     # localiza el commit bueno
git checkout <hash> -- docs/data/live.json    # restaura ese archivo
python tools/validar.py && git commit -am "datos: restaura snapshot verificado"
git push
```

El validador en el workflow ya evita que un `fetch_live` fallido sobrescriba el
snapshot: si los datos salen malformados, el paso falla y no se confirma nada.

## Reglas de seguridad (GitHub-only)

- No se comprometen claves privadas. Las que necesite Actions van en **GitHub
  Secrets**, no en el repositorio.
- La clave de YouTube va ofuscada + restringida por dominio; la de Twelve Data la
  introduce cada usuario en su navegador.
- No se guardan contraseñas, DNI, tarjetas ni datos personales.
