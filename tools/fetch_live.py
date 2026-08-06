"""Refresca los datos que si tienen fuente consultable de forma automatica.

Se ejecuta desde GitHub Actions (server-side) porque ni la API del BCRP ni
comparabien.com.pe envian cabecera Access-Control-Allow-Origin, asi que el
navegador no puede llamarlas directamente desde GitHub Pages.

Salida: docs/data/live.json
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "data" / "live.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) portal-ahorros-pe/1.0"

BCRP_SERIE = "PD04722MM"  # Tasa de referencia de la politica monetaria (mensual)
BCRP_API = "https://estadisticas.bcrp.gob.pe/estadisticas/series/api/{s}/json/{d}/{h}/esp"
COMPARABIEN = "https://comparabien.com.pe/ahorros"

MESES = {
    "Ene": "01", "Feb": "02", "Mar": "03", "Abr": "04", "May": "05", "Jun": "06",
    "Jul": "07", "Ago": "08", "Set": "09", "Sep": "09", "Oct": "10", "Nov": "11", "Dic": "12",
    "Jan": "01", "Apr": "04", "Aug": "08", "Dec": "12",
}


def get(url, timeout=45):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es-PE,es"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def fetch_bcrp():
    """Serie mensual de la tasa de referencia del BCRP."""
    hoy = datetime.now(timezone.utc)
    desde = f"{hoy.year - 3}-{hoy.month:02d}"
    url = BCRP_API.format(s=BCRP_SERIE, d=desde, h=f"{hoy.year}-{hoy.month:02d}")
    data = json.loads(get(url))

    serie = []
    for p in data.get("periods", []):
        nombre = p.get("name", "")
        vals = [v for v in p.get("values", []) if v not in (None, "n.d.", "")]
        if not vals:
            continue
        m = re.match(r"([A-Za-z]{3})\.?(\d{4})", nombre)
        if not m:
            continue
        mes = MESES.get(m.group(1).capitalize())
        if not mes:
            continue
        try:
            serie.append({"mes": f"{m.group(2)}-{mes}", "tasa": round(float(vals[0]) / 100, 6),
                          "etiqueta": nombre})
        except ValueError:
            continue

    serie.sort(key=lambda x: x["mes"])
    if not serie:
        raise RuntimeError("BCRP devolvio una serie vacia")
    return {
        "vigente": serie[-1]["tasa"],
        "mes_vigente": serie[-1]["mes"],
        "etiqueta_vigente": serie[-1]["etiqueta"],
        "serie": serie,
        "serie_id": BCRP_SERIE,
        "fuente": f"https://estadisticas.bcrp.gob.pe/estadisticas/series/mensuales/resultados/{BCRP_SERIE}/html",
        "api": url,
    }


CARD = re.compile(
    r'<img[^>]*?src="(?P<logo>[^"]*?)"[^>]*?alt="(?P<comp>[^"]*?)"'
    r'.*?<div class="prod-title">(?P<prod>.*?)</div>'
    r'.*?<div class="card-title">(?P<tasa>.*?)</div>'
    r'.*?<div class="card-text">(?P<desc>.*?)</div>',
    re.S,
)
# Cada producto vive en su propio <div class="card ...">; separar primero evita
# que el .*? del regex cruce de una tarjeta a la siguiente y mezcle logo y nombre.
BLOQUE = re.compile(r'<div class="card [^"]*">')


def limpiar(s):
    return unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def fetch_comparabien():
    """Productos de ahorro destacados publicados en comparabien.com.pe."""
    html = get(COMPARABIEN)
    productos = []
    for bloque in BLOQUE.split(html)[1:]:
        m = CARD.search(bloque)
        if not m:
            continue
        tasa_txt = limpiar(m.group("tasa"))
        num = re.search(r"([\d.,]+)\s*%", tasa_txt)
        productos.append({
            "entidad": limpiar(m.group("comp")),
            "producto": limpiar(m.group("prod")),
            "tasa_texto": tasa_txt,
            "tasa": round(float(num.group(1).replace(",", ".")) / 100, 6) if num else None,
            "hasta": tasa_txt.lower().startswith("hasta"),
            "detalle": limpiar(m.group("desc")),
            "logo": m.group("logo"),
        })
    # De-duplicar conservando el orden de aparicion.
    vistos, unicos = set(), []
    for p in productos:
        clave = (p["entidad"], p["producto"])
        if clave not in vistos:
            vistos.add(clave)
            unicos.append(p)
    return {"fuente": COMPARABIEN, "productos": unicos}


def main():
    ahora = datetime.now(timezone.utc)
    salida = {
        "actualizado": ahora.isoformat(timespec="seconds"),
        "actualizado_pe": ahora.astimezone().strftime("%d/%m/%Y %H:%M"),
        "fuentes": {},
    }
    fallos = 0

    for nombre, fn in (("bcrp", fetch_bcrp), ("comparabien", fetch_comparabien)):
        try:
            salida[nombre] = fn()
            salida["fuentes"][nombre] = {"estado": "ok", "error": None}
            print(f"[ok] {nombre}")
        except Exception as e:  # la web de origen puede caerse o cambiar
            fallos += 1
            salida[nombre] = None
            salida["fuentes"][nombre] = {"estado": "error", "error": f"{type(e).__name__}: {e}"}
            print(f"[error] {nombre}: {e}", file=sys.stderr)

    # Si todo falla, conservar el snapshot anterior antes que publicar un archivo vacio.
    if fallos == 2 and OUT.exists():
        print("Ambas fuentes fallaron: se conserva live.json anterior", file=sys.stderr)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"-> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
