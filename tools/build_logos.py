"""Genera un logotipo SVG por entidad con su color corporativo y su nombre.

No se descargan los logotipos originales de cada banco: son marcas registradas y
el hotlinking a sus servidores se rompe (CORS/hotlink protection). Se usan
monogramas en el color oficial de cada marca, siempre acompanados del nombre.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets" / "logos"

# color de marca, monograma
MARCAS = {
    "Scotiabank Perú": ("#EC111A", "S"),
    "Financiera SURGIR": ("#EC0000", "SG"),
    "Financiera QAPAQ": ("#00953B", "Q"),
    "Financiera Confianza": ("#004481", "FC"),
    "Banco Falabella": ("#009A44", "F"),
    "Santander Consumer Bank": ("#EC0000", "SC"),
    "Banco Alfin": ("#00B2A9", "A"),
    "Caja Cusco": ("#C8102E", "CC"),
    "Compartamos Financiera": ("#00A0DF", "CF"),
    "Banco de Comercio": ("#003DA5", "BC"),
    "Banco Ripley": ("#5C2D91", "R"),
    "Financiera Efectiva (Efectibank)": ("#E4002B", "EF"),
    "Banco GNB Perú": ("#F5A800", "GNB"),
    "Caja Arequipa": ("#E4002B", "CA"),
    "Caja Piura": ("#0033A0", "CP"),
    "Financiera Oh! / SIP": ("#FF6900", "OH"),
}

TPL = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="{alt}">
 <title>{alt}</title>
 <rect width="64" height="64" rx="14" fill="{color}"/>
 <text x="32" y="32" fill="#fff" font-family="Segoe UI,Helvetica,Arial,sans-serif"
  font-size="{size}" font-weight="700" text-anchor="middle" dominant-baseline="central"
  letter-spacing="-0.5">{mono}</text>
</svg>
"""


def slug(nombre):
    s = (nombre.lower()
         .replace("á", "a").replace("é", "e").replace("í", "i")
         .replace("ó", "o").replace("ú", "u").replace("ñ", "n"))
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s)).strip("-")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    indice = {}
    for nombre, (color, mono) in MARCAS.items():
        s = slug(nombre)
        size = {1: 30, 2: 22, 3: 16}[len(mono)]
        (OUT / f"{s}.svg").write_text(
            TPL.format(alt=nombre, color=color, mono=mono, size=size), encoding="utf-8")
        indice[nombre] = {"slug": s, "color": color, "monograma": mono}

    (ROOT / "docs" / "data" / "marcas.json").write_text(
        json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(indice)} logotipos -> {OUT}")


if __name__ == "__main__":
    main()
