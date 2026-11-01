# Bullion Lab

The price of gold since 1791 on one zoomable chart, plus a Python sandbox where you write a trading script and run it against history with a pretend balance.

- **Chart.** Every price from 1791 to the latest close. Presets from one month to all of history, a log-scale switch, drag to pan, pinch or Ctrl + scroll to zoom, and a full-history strip underneath to drag out any range. Hover for the price on any day. **Yearly table** lists each year's closing price, change, high and low.
- **Strategy.** A Python editor with five examples (golden cross, buy the dip, RSI swing, monthly dollar-cost averaging, 50/50 rebalancing). Pick dates (or click **Last month**, **2017–2023**, **All history**…), a starting balance and a fee, then **Run backtest** or press Ctrl+Enter.
- **Results.** Final balance against simply buying and holding, yearly return, worst drop, trade count and win rate, an equity curve of your strategy against buy-and-hold, every trade (also marked on the price chart), and anything your script printed. Errors point at the line in your script.

Python runs in your browser through [Pyodide](https://pyodide.org) in a background worker, so a slow script never freezes the page and **Stop** ends an endless loop. No real money or brokerage is involved.

## Run it

Open `gold/index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000 --directory gold
```

Then open <http://localhost:8000>. The first run downloads Python (about 14 MB) from the Pyodide CDN. To keep a local copy so it works offline, run `python3 gold/scripts/build_artifact.py` once; it saves Pyodide in `gold/pyodide/`, which the page uses when served over HTTP.

## Writing a strategy

```python
FAST, SLOW = 50, 200

def on_bar(bar, acct):                 # runs once per bar, oldest first
    closes = acct.history(SLOW)        # last 200 closes, today last
    if len(closes) < SLOW:
        return
    if sma(closes, FAST) > sma(closes, SLOW) and acct.ounces == 0:
        acct.buy_all(note="golden cross")
    elif sma(closes, FAST) < sma(closes, SLOW) and acct.ounces > 0:
        acct.sell_all(note="death cross")
```

| You get | What it is |
| --- | --- |
| `bar.date`, `bar.price`, `bar.open`, `bar.high`, `bar.low`, `bar.index` | Today's bar. `bar.date` is a `datetime.date`; `bar.index` counts from 0 at the start date. |
| `acct.cash`, `acct.ounces`, `acct.value`, `acct.price`, `acct.avg_cost`, `acct.gold_share`, `acct.profit`, `acct.start_cash` | The account right now, valued at today's price. |
| `acct.history(n, field="close")` | The last `n` prices (`"open"`, `"high"`, `"low"` also work), oldest first. It reaches back before the start date, so indicators are ready on day one. |
| `acct.buy(dollars=…)`, `acct.buy(ounces=…)`, `acct.buy_all()` | Buy. Capped at the cash you have. |
| `acct.sell(ounces=…)`, `acct.sell(dollars=…)`, `acct.sell_all()` | Sell. Capped at what you hold; no shorting or leverage. |
| `acct.target(0.6)` | Buy or sell so 60% of the account is in gold. |
| `note="…"` | Any order can carry a note for the trades list and the chart. |
| `acct.trades`, `acct.last_trade`, `acct.pending`, `acct.cancel_orders()` | Fills so far and orders waiting for the next bar. |
| `sma`, `ema`, `rsi`, `stdev`, `highest`, `lowest`, `change` | Indicator helpers, no import needed. They return `None` until there are enough values. |
| `setup(acct)`, `on_finish(acct)` | Optional hooks before the first bar and after the last. |
| `print(...)` | Shows under **Output**, stamped with the bar's date. |

The standard library works, and `import numpy` loads numpy on first use.

**How fills work.** Orders fill at the bar's closing price by default, or at the next bar's open if you choose **Next bar's open**. The fee is a percentage of each trade's value, paid in cash. **Buy & hold** spends all the starting cash on the first bar and never sells, and is the benchmark every run is compared with.

## The data

| Years | Prices | Source |
| --- | --- | --- |
| 1791–1959 | yearly | [MeasuringWorth](https://www.measuringworth.com/datasets/gold/), New York market price |
| 1960–Jul 2000 | monthly averages | World Bank commodity prices, via [datasets/gold-prices](https://github.com/datasets/gold-prices) |
| Aug 30, 2000–today | daily open, high, low, close | [Yahoo Finance](https://finance.yahoo.com/quote/GC%3DF/), COMEX gold futures (GC=F) |

All prices are US dollars per troy ounce. A backtest that starts before August 2000 uses the longer bars until daily data begins (the results say so), or choose **One bar is: a week / a month / a year** to use one bar size throughout.

Refresh the prices with:

```bash
python3 gold/scripts/update_data.py
```

It writes `gold/data/gold-data.js` using only the Python standard library.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The whole app: chart, editor, worker and, in `<script id="engine-py">`, the Python backtest engine. |
| `data/gold-data.js` | The price history (generated). |
| `scripts/update_data.py` | Downloads the three sources and writes the data file. |
| `scripts/build_artifact.py` | Builds `dist/artifact/` (page, data, Pyodide and numpy) for publishing as a claude.ai artifact. |
| `tests/test_engine.py` | Engine tests, run against the engine inside `index.html`: `python3 -m unittest discover -s gold/tests` |

This is a learning tool. Past results don't predict future ones, and nothing here is investment advice.
