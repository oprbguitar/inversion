"""Valida los datasets curados antes de publicar. Uso: python tools/validar.py

Se ejecuta en GitHub Actions antes de confirmar cambios. Si falla, el paso
falla y NO se sobrescribe el snapshot verificado anterior; GitHub Pages sigue
sirviendo la ultima version buena desde main:/docs.

Rechaza: porcentajes imposibles, montos negativos, fechas invalidas, fin de
campana antes del inicio, URLs de fuente ausentes, estados de verificacion o de
FSD desconocidos, productos duplicados, nombres de entidad vacios y topes
promocionales negativos.
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "docs" / "data" / "dataset.json"
TARJETAS = ROOT / "docs" / "data" / "tarjetas.json"

FECHA = re.compile(r"(\d{2})/(\d{2})/(\d{4})")

errores = []


def err(donde, msg):
    errores.append(f"[{donde}] {msg}")


def pct_valido(v):
    return isinstance(v, (int, float)) and 0 <= v <= 3  # 0%..300% en fraccion


def validar_dataset():
    d = json.loads(DATASET.read_text(encoding="utf-8"))
    vistos = set()

    for i, e in enumerate(d.get("ranking", [])):
        donde = f"ranking[{i}] {e.get('entidad', '?')}"

        if not (e.get("entidad") or "").strip():
            err(donde, "nombre de entidad vacio")

        clave = (e.get("entidad"), e.get("producto"))
        if clave in vistos:
            err(donde, "producto duplicado")
        vistos.add(clave)

        if not pct_valido(e.get("trea")):
            err(donde, f"TREA fuera de rango: {e.get('trea')}")

        mm = e.get("monto_minimo")
        if mm is not None and (not isinstance(mm, (int, float)) or mm < 0):
            err(donde, f"monto_minimo negativo o invalido: {mm}")

        st = e.get("saldo_tasa_max")
        if st is not None and (not isinstance(st, (int, float)) or st < 0):
            err(donde, f"saldo_tasa_max negativo o invalido: {st}")

        if not Fmt_url(e.get("url")):
            err(donde, "falta URL de fuente valida (http/https)")

        if e.get("fsd") not in ("Sí", "Si", "No", "Parcial", None):
            err(donde, f"estado FSD desconocido: {e.get('fsd')}")

        # La verificacion es texto libre (el frontend lo clasifica en verde/ambar/
        # rojo). Solo se exige que, si esta presente, no este vacio.
        if "verificacion" in e and not (e.get("verificacion") or "").strip():
            err(donde, "estado de verificacion vacio")

        # Fin de campana no puede ser anterior al inicio.
        fechas = FECHA.findall(e.get("vigencia", "") or "")
        if len(fechas) >= 2:
            try:
                d0 = datetime(int(fechas[0][2]), int(fechas[0][1]), int(fechas[0][0]))
                d1 = datetime(int(fechas[-1][2]), int(fechas[-1][1]), int(fechas[-1][0]))
                if d1 < d0:
                    err(donde, "fin de campana anterior al inicio")
            except ValueError:
                err(donde, "fecha de vigencia invalida")

    for i, f in enumerate(d.get("fichas", [])):
        donde = f"ficha[{i}] {f.get('entidad', '?')}"
        sim = f.get("simulador") or {}
        tope = sim.get("tope_remunerado")
        if tope is not None and (not isinstance(tope, (int, float)) or tope < 0):
            err(donde, f"tope_remunerado negativo: {tope}")
        for t in f.get("tramos", []):
            if not pct_valido(t.get("trea")):
                err(donde, f"TREA de tramo fuera de rango: {t.get('trea')}")
            if not isinstance(t.get("desde"), (int, float)) or t["desde"] < 0:
                err(donde, f"'desde' de tramo negativo: {t.get('desde')}")


def validar_tarjetas():
    if not TARJETAS.exists():
        return
    d = json.loads(TARJETAS.read_text(encoding="utf-8"))
    vistos = set()
    for i, t in enumerate(d.get("tarjetas", [])):
        donde = f"tarjeta[{i}] {t.get('entidad', '?')}"
        if not (t.get("entidad") or "").strip():
            err(donde, "nombre de entidad vacio")
        clave = (t.get("entidad"), t.get("tarjeta"))
        if clave in vistos:
            err(donde, "tarjeta duplicada")
        vistos.add(clave)
        for campo in ("tea_min", "tea_max", "tcea_ref"):
            if not pct_valido(t.get(campo)):
                err(donde, f"{campo} fuera de rango: {t.get(campo)}")
        if t.get("tea_min") is not None and t.get("tea_max") is not None \
                and t["tea_min"] > t["tea_max"]:
            err(donde, "tea_min mayor que tea_max")
        if not Fmt_url(t.get("url")):
            err(donde, "falta URL de fuente valida")


def Fmt_url(u):
    return isinstance(u, str) and u.startswith(("http://", "https://"))


def main():
    if not DATASET.exists():
        print("No existe dataset.json", file=sys.stderr)
        return 1
    validar_dataset()
    validar_tarjetas()
    if errores:
        print(f"VALIDACION FALLIDA: {len(errores)} problema(s)", file=sys.stderr)
        for e in errores:
            print("  -", e, file=sys.stderr)
        return 1
    print("Validacion OK: datasets sin problemas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
