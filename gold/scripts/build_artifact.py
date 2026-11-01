#!/usr/bin/env python3
"""Build gold/dist/artifact: the page plus everything it needs to run as a claude.ai artifact.

Artifact pages may only fetch their own files, so Python (Pyodide) is published next to
the page instead of coming from a CDN:

    dist/artifact/index.html          the page, without its <html>/<head>/<body> skeleton
    dist/artifact/data/gold-data.js   the price history
    dist/artifact/pyodide/...         Pyodide core files and the numpy wheel

Pyodide is downloaded once into gold/pyodide/ (git-ignored), which also lets the page run
offline when you serve the gold/ folder locally.

    python3 gold/scripts/build_artifact.py
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "artifact"
PYODIDE_VERSION = "0.27.7"
CDN = f"https://cdn.jsdelivr.net/pyodide/v{PYODIDE_VERSION}/full/"
CORE = ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]
EXTRA_PACKAGES = ["numpy"]
CACHE = ROOT / "pyodide"
SERVED = {".js", ".mjs", ".wasm", ".json"}


def download(name: str) -> Path:
    dest = CACHE / name
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    CACHE.mkdir(parents=True, exist_ok=True)
    print(f"  downloading {name}", flush=True)
    req = urllib.request.Request(CDN + name, headers={"User-Agent": "bullion-lab build"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(data)
    tmp.replace(dest)
    return dest


def strip_skeleton(html: str) -> str:
    """Drop the document skeleton the artifact host adds itself (see the <!--skel--> marks)."""
    first = html.index("<!--/skel-->")
    html = html[first + len("<!--/skel-->"):]
    html = re.sub(r"<!--skel-->.*?<!--/skel-->", "", html, flags=re.S)
    return html.strip() + "\n"


def main() -> int:
    print(f"Pyodide {PYODIDE_VERSION}:")
    files = [download(n) for n in CORE]
    lock = json.loads((CACHE / "pyodide-lock.json").read_text())
    for pkg in EXTRA_PACKAGES:
        info = lock["packages"][pkg]
        for dep in info.get("depends", []):
            if dep not in EXTRA_PACKAGES:
                raise SystemExit(f"{pkg} depends on {dep}; add it to EXTRA_PACKAGES")
        f = download(info["file_name"])
        digest = hashlib.sha256(f.read_bytes()).hexdigest()
        if digest != info["sha256"]:
            f.unlink()
            raise SystemExit(f"{f.name}: checksum mismatch, deleted; run again")
        files.append(f)

    shutil.rmtree(OUT, ignore_errors=True)
    (OUT / "data").mkdir(parents=True)
    (OUT / "pyodide").mkdir()
    page = strip_skeleton((ROOT / "index.html").read_text(encoding="utf-8"))
    (OUT / "index.html").write_text(page, encoding="utf-8")
    shutil.copy2(ROOT / "data" / "gold-data.js", OUT / "data" / "gold-data.js")
    renames = {}
    for f in files:
        name = f.name
        if f.suffix not in SERVED:
            # Artifact hosting serves web file types only; ship the bytes under a .wasm
            # name (served as plain binary) and let the page's worker map the real name.
            name = f.name + ".wasm"
            renames[f.name] = name
        shutil.copy2(f, OUT / "pyodide" / name)
    (OUT / "pyodide" / "renames.json").write_text(json.dumps(renames, indent=2) + "\n")

    total = 0
    for p in sorted(OUT.rglob("*")):
        if p.is_file():
            size = p.stat().st_size
            total += size
            print(f"{size / 1e6:8.2f} MB  {p.relative_to(OUT)}")
            if size > 15e6:
                print("  ^ larger than the 15 MB artifact file limit", file=sys.stderr)
    print(f"{total / 1e6:.1f} MB in {OUT.relative_to(ROOT.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
