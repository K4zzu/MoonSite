"""Shared helpers: the data contract lives here so both scripts write the same shape."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "data"
FORMAT_VERSION = 1


def load_sites():
    return json.loads((ROOT / "sites.json").read_text(encoding="utf-8"))["sites"]


def flat_horizon():
    # Placeholder until the LOLA step replaces it: smooth sphere, horizon at 0 deg.
    return {"step_deg": 1, "el": [0.0] * 360, "source": "sphere"}


def write_site(site, start_iso, step_min, sun, earth, source, horizon=None):
    """sun / earth are lists of (az_deg, el_deg), one per time step."""
    assert len(sun) == len(earth), "Sun and Earth series differ in length"
    path = OUT_DIR / f"{site['id']}.json"
    terrain = None
    if horizon is None:
        # Keep a terrain horizon (and LOLA terrain grid) that a previous run already computed.
        if path.exists():
            prev = json.loads(path.read_text(encoding="utf-8"))
            old = prev.get("horizon")
            horizon = old if old and old.get("source") != "sphere" else flat_horizon()
            terrain = prev.get("terrain")
        else:
            horizon = flat_horizon()
    doc = {
        "version": FORMAT_VERSION,
        "id": site["id"],
        "source": source,
        "start_utc": start_iso,
        "step_min": step_min,
        "n": len(sun),
        "sun": {"az": [round(a, 2) for a, _ in sun], "el": [round(e, 2) for _, e in sun]},
        "earth": {"az": [round(a, 2) for a, _ in earth], "el": [round(e, 2) for _, e in earth]},
        "horizon": horizon,
    }
    if terrain:
        doc["terrain"] = terrain
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
    return path


def write_index(sites, start_iso, step_min, n, source):
    doc = {"version": FORMAT_VERSION, "source": source, "start_utc": start_iso,
           "step_min": step_min, "n": n, "sites": sites}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "sites.json").write_text(json.dumps(doc, indent=1), encoding="utf-8")
