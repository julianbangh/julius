#!/bin/bash
# One-time setup for Geo Studio: node deps, python venv, open map data, fonts, synthesized SFX.
set -e
cd "$(dirname "$0")/.."
npm install --silent
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv; fi
.venv/bin/pip install -q faster-whisper==1.1.1 requests opencv-python-headless numpy
mkdir -p data assets/fonts assets/sfx
NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_50m_admin_0_countries ne_10m_admin_0_countries ne_50m_populated_places_simple ne_50m_land ne_50m_lakes ne_10m_lakes ne_50m_admin_1_states_provinces; do
  [ -s data/$f.geojson ] || curl -sSf -o data/$f.geojson $NE/$f.geojson
done
[ -s data/roman_provinces.geojson ] || curl -sSf -o data/roman_provinces.geojson https://raw.githubusercontent.com/klokantech/roman-empire/master/data/provinces.geojson
F=https://raw.githubusercontent.com/google/fonts/main/ofl
[ -s assets/fonts/Anton-Regular.ttf ] || curl -sSf -o assets/fonts/Anton-Regular.ttf $F/anton/Anton-Regular.ttf
[ -s assets/fonts/BebasNeue-Regular.ttf ] || curl -sSf -o assets/fonts/BebasNeue-Regular.ttf $F/bebasneue/BebasNeue-Regular.ttf
for w in ExtraBold Black Bold SemiBold; do
  [ -s assets/fonts/Montserrat-$w.ttf ] || curl -sSf -o assets/fonts/Montserrat-$w.ttf https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-$w.ttf
done
.venv/bin/python -I scripts/make_sfx.py > /dev/null
echo "Geo Studio ready."
