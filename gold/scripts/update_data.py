#!/usr/bin/env python3
"""Download the gold price history and write it to gold/data/gold-data.js.

The history is spliced from three sources, each used where it is best:

  1791-1959  yearly   MeasuringWorth, New York market price (USD per fine ounce)
  1960-2000  monthly  World Bank commodity prices (via the datasets/gold-prices package)
  2000-today daily    Yahoo Finance, COMEX gold futures front month (GC=F), OHLC

Run it again any time to bring the data up to date:

    python3 gold/scripts/update_data.py

Standard library only. The page loads the output with a plain <script> tag, so it
works when index.html is opened straight from disk.
"""
from __future__ import annotations

import csv
import datetime as dt
import html
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "gold-data.js"
UA = "Mozilla/5.0 (gold-backtester data updater)"

MW_URL = "https://www.measuringworth.com/datasets/gold/result.php"
WB_URL = "https://raw.githubusercontent.com/datasets/gold-prices/main/data/monthly.csv"
YH_URL = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?period1=0&period2={end}&interval=1d"

YEARLY_FROM, YEARLY_TO = 1791, 1959
MONTHLY_FROM = "1960-01"


def fetch(url: str, data: bytes | None = None, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def num(s: str) -> float | None:
    s = s.replace("$", "").replace("£", "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def yearly_measuringworth() -> list[tuple[str, float]]:
    form = urllib.parse.urlencode(
        {"newyork": "on", "year_source": YEARLY_FROM, "year_result": YEARLY_TO}
    ).encode()
    page = fetch(MW_URL, form).decode("utf-8", "replace")
    rows = []
    for tr in re.findall(r"<tr.*?</tr>", page, flags=re.S | re.I):
        cells = [
            html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
            for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, flags=re.S | re.I)
        ]
        if len(cells) < 2 or not re.fullmatch(r"\d{4}", cells[0]):
            continue
        year = int(cells[0])
        # Columns depend on which boxes were ticked; with only New York ticked the
        # market price is the last numeric cell of the row.
        values = [num(c) for c in cells[1:]]
        values = [v for v in values if v is not None]
        if YEARLY_FROM <= year <= YEARLY_TO and values:
            rows.append((f"{year}-01-01", values[-1]))
    if len(rows) < (YEARLY_TO - YEARLY_FROM) * 0.9:
        raise RuntimeError(f"MeasuringWorth returned only {len(rows)} yearly rows")
    return rows


def monthly_worldbank(until: str) -> list[tuple[str, float]]:
    text = fetch(WB_URL).decode("utf-8")
    rows = []
    for r in csv.DictReader(io.StringIO(text)):
        month = r["Date"][:7]
        price = num(r["Price"])
        if price is None or month < MONTHLY_FROM or month >= until:
            continue
        rows.append((f"{month}-01", price))
    if len(rows) < 400:
        raise RuntimeError(f"World Bank monthly data has only {len(rows)} rows")
    return rows


def daily_yahoo() -> list[tuple[str, float, float, float, float]]:
    end = int(dt.datetime.now(dt.timezone.utc).timestamp()) + 86400
    doc = json.loads(fetch(YH_URL.format(end=end)))
    res = doc["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    by_day: dict[str, tuple[float, float, float, float]] = {}
    for i, ts in enumerate(res["timestamp"]):
        c = q["close"][i]
        if c is None or c <= 0:
            continue
        o = q["open"][i] or c
        h = q["high"][i] or c
        lo = q["low"][i] or c
        # Bars are stamped at midnight New York time (04:00/05:00 UTC), so the UTC
        # date is the trading date.
        day = dt.datetime.fromtimestamp(ts, dt.timezone.utc).date().isoformat()
        by_day[day] = (o, max(o, h, lo, c), min(o, h, lo, c), c)
    rows = [(d, *v) for d, v in sorted(by_day.items())]
    if len(rows) < 5000:
        raise RuntimeError(f"Yahoo returned only {len(rows)} daily rows")
    return rows


def r2(x: float) -> float:
    return round(x, 2)


def main() -> int:
    print("Downloading yearly prices (MeasuringWorth)...", flush=True)
    yearly = yearly_measuringworth()
    print(f"  {len(yearly)} years, {yearly[0][0][:4]}-{yearly[-1][0][:4]}")

    print("Downloading daily prices (Yahoo Finance GC=F)...", flush=True)
    daily = daily_yahoo()
    print(f"  {len(daily)} days, {daily[0][0]} to {daily[-1][0]}")

    print("Downloading monthly prices (World Bank)...", flush=True)
    monthly = monthly_worldbank(until=daily[0][0][:7])
    print(f"  {len(monthly)} months, {monthly[0][0][:7]} to {monthly[-1][0][:7]}")

    d, o, h, lo, c = [], [], [], [], []
    for day, p in yearly + monthly:
        d.append(day)
        o.append(r2(p)); h.append(r2(p)); lo.append(r2(p)); c.append(r2(p))
    for day, *ohlc in daily:
        d.append(day)
        o.append(r2(ohlc[0])); h.append(r2(ohlc[1])); lo.append(r2(ohlc[2])); c.append(r2(ohlc[3]))

    data = {
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "unit": "USD per troy ounce",
        "segments": [
            {
                "resolution": "year", "start": yearly[0][0], "end": yearly[-1][0],
                "source": "MeasuringWorth, New York market price",
                "url": "https://www.measuringworth.com/datasets/gold/",
            },
            {
                "resolution": "month", "start": monthly[0][0], "end": monthly[-1][0],
                "source": "World Bank commodity prices (datasets/gold-prices)",
                "url": "https://github.com/datasets/gold-prices",
            },
            {
                "resolution": "day", "start": daily[0][0], "end": daily[-1][0],
                "source": "Yahoo Finance, COMEX gold futures (GC=F)",
                "url": "https://finance.yahoo.com/quote/GC%3DF/",
            },
        ],
        "d": d, "o": o, "h": h, "l": lo, "c": c,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data, separators=(",", ":"))
    OUT.write_text(
        "// Generated by gold/scripts/update_data.py - do not edit by hand.\n"
        f"window.GOLD_DATA = {body};\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(d)} prices to {OUT.relative_to(ROOT.parent)} ({OUT.stat().st_size / 1e3:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
