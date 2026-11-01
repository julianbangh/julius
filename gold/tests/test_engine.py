"""Tests for the backtest engine that lives inside index.html (<script id="engine-py">).

    python3 -m unittest discover -s gold/tests
"""
import json
import math
import re
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_engine():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    src = re.search(r'<script type="text/x-python" id="engine-py">\n(.*?)</script>', html, re.S).group(1)
    mod = types.ModuleType("engine")
    exec(compile(src, "engine-py", "exec"), mod.__dict__)
    return mod


def real_data():
    s = (ROOT / "data" / "gold-data.js").read_text(encoding="utf-8")
    return json.loads(s[s.index("{"):s.rstrip().rindex("}") + 1])


def synthetic(prices, start="2020-01-01", opens=None):
    """One bar per calendar day with the given closes."""
    import datetime as dt
    d0 = dt.date.fromisoformat(start)
    days = [(d0 + dt.timedelta(days=i)).isoformat() for i in range(len(prices))]
    o = list(opens) if opens else list(prices)
    return {"d": days, "o": o, "h": [max(a, b) for a, b in zip(o, prices)],
            "l": [min(a, b) for a, b in zip(o, prices)], "c": list(prices),
            "segments": [{"resolution": "day", "start": days[0], "end": days[-1]}]}


class Helpers(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.e = load_engine()

    def test_sma_and_friends(self):
        e = self.e
        v = [1, 2, 3, 4, 5]
        self.assertEqual(e.sma(v, 2), 4.5)
        self.assertEqual(e.sma(v), 3)
        self.assertIsNone(e.sma(v, 6))
        self.assertEqual(e.highest(v, 3), 5)
        self.assertEqual(e.lowest(v, 3), 3)
        self.assertAlmostEqual(e.change(v, 1), 0.25)
        self.assertAlmostEqual(e.stdev([2, 4, 4, 4, 5, 5, 7, 9]), 2.138089935299395)

    def test_ema_seeds_with_sma(self):
        self.assertEqual(self.e.ema([2, 4, 6], 3), 4)
        self.assertAlmostEqual(self.e.ema([2, 4, 6, 8], 3), 6)
        self.assertIsNone(self.e.ema([1, 2], 3))

    def test_rsi(self):
        e = self.e
        self.assertEqual(e.rsi(list(range(1, 30)), 14), 100.0)
        self.assertEqual(e.rsi(list(range(30, 1, -1)), 14), 0.0)
        r = e.rsi([44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
                   45.89, 46.03, 45.61, 46.28, 46.28], 14)
        self.assertAlmostEqual(r, 70.46, places=1)  # Wilder's worked example


class Accounting(unittest.TestCase):
    def setUp(self):
        self.e = load_engine()

    def run_code(self, code, data, **params):
        self.e.load_data(data)
        res = self.e.run(code, params)
        json.dumps(res, allow_nan=False)
        return res

    def test_buy_all_then_sell_all_with_fee(self):
        data = synthetic([100, 110, 121])
        code = """
def on_bar(bar, acct):
    if bar.index == 0: acct.buy_all()
    if bar.index == 2: acct.sell_all()
"""
        r = self.run_code(code, data, cash=1000, fee_pct=1)
        self.assertTrue(r["ok"], r["error"])
        buy, sell = r["trades"]
        oz = 1000 / (100 * 1.01)
        self.assertAlmostEqual(buy[2], oz, places=5)
        self.assertAlmostEqual(r["final"]["cash"], oz * 121 * 0.99, places=2)
        self.assertEqual(r["final"]["ounces"], 0)
        self.assertAlmostEqual(sell[5], oz * 121 * 0.99 - 1000, places=2)  # profit vs cost incl. fees

    def test_cannot_overspend_or_oversell(self):
        data = synthetic([50, 50])
        code = """
def on_bar(bar, acct):
    if bar.index == 0:
        acct.buy(dollars=1e9)
        acct.sell(ounces=1e9)
        acct.sell(ounces=1)
"""
        r = self.run_code(code, data, cash=500, fee_pct=0)
        self.assertEqual([t[1] for t in r["trades"]], ["buy", "sell"])
        self.assertAlmostEqual(r["trades"][0][2], 10)
        self.assertEqual(r["final"]["ounces"], 0)
        self.assertAlmostEqual(r["final"]["cash"], 500)
        self.assertTrue(any("too small" in w for w in r["warnings"]))

    def test_whole_ounces(self):
        r = self.run_code("def on_bar(b, a):\n    a.buy_all()\n", synthetic([300]), cash=1000, fractional=False)
        self.assertEqual(r["trades"][0][2], 3)
        self.assertAlmostEqual(r["final"]["cash"], 100)

    def test_next_open_fills_at_the_next_bars_open(self):
        data = synthetic([100, 200, 300], opens=[90, 150, 250])
        code = "def on_bar(b, a):\n    if b.index == 0:\n        a.buy(ounces=1)\n        assert a.ounces == 0 and len(a.pending) == 1\n"
        r = self.run_code(code, data, cash=1000, fill="next_open")
        self.assertTrue(r["ok"], r["error"])
        self.assertEqual(r["trades"][0][0], "2020-01-02")
        self.assertEqual(r["trades"][0][3], 150)

    def test_target(self):
        code = "def on_bar(b, a):\n    a.target(0.25)\n"
        r = self.run_code(code, synthetic([100, 100]), cash=1000)
        self.assertEqual(len(r["trades"]), 1)
        self.assertAlmostEqual(r["final"]["ounces"], 2.5)

    def test_history_reaches_before_start_and_stops_at_today(self):
        data = synthetic([1, 2, 3, 4, 5])
        code = """
seen = []
def on_bar(b, a):
    seen.append(a.history(3))
def on_finish(a):
    print(seen)
"""
        r = self.run_code(code, data, start="2020-01-03")
        self.assertEqual(r["logs"][0][1], "[[1, 2, 3], [2, 3, 4], [3, 4, 5]]")
        self.assertEqual(r["first"], "2020-01-03")

    def test_buy_and_hold_benchmark(self):
        r = self.run_code("def on_bar(b, a):\n    pass\n", synthetic([100, 150, 200]), cash=1000, fee_pct=0)
        self.assertEqual(r["hold"], [1000, 1500, 2000])
        self.assertEqual(r["equity"], [1000, 1000, 1000])
        self.assertAlmostEqual(r["bench"]["max_drawdown"], 0)

    def test_drawdown(self):
        code = "def on_bar(b, a):\n    if b.index == 0: a.buy_all()\n"
        r = self.run_code(code, synthetic([100, 120, 60, 90]), cash=100)
        self.assertAlmostEqual(r["stats"]["max_drawdown"], -0.5)
        self.assertEqual((r["stats"]["dd_peak"], r["stats"]["dd_trough"]), ("2020-01-02", "2020-01-03"))


class Errors(unittest.TestCase):
    def setUp(self):
        self.e = load_engine()
        self.e.load_data(synthetic([10] * 20))

    def test_runtime_error_points_at_the_users_line(self):
        r = self.e.run("def on_bar(b, a):\n    if b.index == 5:\n        1 / 0\n", {})
        self.assertFalse(r["ok"])
        self.assertEqual(r["error"]["line"], 3)
        self.assertEqual(r["error"]["date"], "2020-01-06")
        self.assertIn("ZeroDivisionError", r["error"]["message"])
        self.assertEqual(len(r["equity"]), 5)  # the bars before the error are kept

    def test_syntax_error(self):
        r = self.e.run("def on_bar(b, a)\n    pass\n", {})
        self.assertEqual(r["error"]["line"], 1)
        self.assertTrue(r["error"]["message"].startswith("SyntaxError on line 1"))

    def test_missing_on_bar_and_bad_orders(self):
        self.assertIn("on_bar", self.e.run("x = 1\n", {})["error"]["message"])
        r = self.e.run("def on_bar(b, a):\n    a.buy()\n", {})
        self.assertIn("exactly one of", r["error"]["message"])
        r = self.e.run("def on_bar(b, a):\n    a.sell(dollars=-1)\n", {})
        self.assertIn("zero or more", r["error"]["message"])

    def test_empty_range(self):
        r = self.e.run("def on_bar(b, a): pass\n", {"start": "1990-01-01", "end": "1990-02-01"})
        self.assertFalse(r["ok"])
        self.assertIn("No prices", r["error"]["message"])


class RealData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.e = load_engine()
        cls.data = real_data()
        cls.e.load_data(cls.data)

    def test_data_is_ordered_and_positive(self):
        d = self.data
        self.assertTrue(all(a < b for a, b in zip(d["d"], d["d"][1:])))
        self.assertTrue(all(x > 0 for x in d["c"]))
        self.assertTrue(all(lo <= c <= hi for lo, c, hi in zip(d["l"], d["c"], d["h"])))
        self.assertEqual(len({len(d[k]) for k in "dohlc"}), 1)

    def test_examples_from_the_page_run(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        codes = re.findall(r"code: `(.*?)` \}", html, re.S)
        self.assertGreaterEqual(len(codes), 5)
        for code in codes:
            for params in ({"start": "2017-01-01", "end": "2023-12-31"}, {"start": "2026-09-30"}, {},
                           {"bar": "week", "fill": "next_open", "start": "2000-01-01"}):
                r = json.loads(self.e.run_json(code, json.dumps(dict(params, cash=10000, fee_pct=0.1))))
                self.assertTrue(r["ok"], (code[:40], params, r["error"]))

    def test_buy_and_hold_matches_prices(self):
        r = self.e.run("def on_bar(b, a): pass\n", {"start": "2017-01-01", "end": "2023-12-31", "fee_pct": 0, "cash": 1000})
        d = self.data
        i0, i1 = d["d"].index(r["first"]), d["d"].index(r["last"])
        self.assertAlmostEqual(r["bench"]["return"], d["c"][i1] / d["c"][i0] - 1, places=4)
        self.assertTrue(math.isclose(r["bench"]["cagr"], (1 + r["bench"]["return"]) ** (1 / r["bench"]["years"]) - 1))

    def test_resampling(self):
        for size, key in (("week", None), ("month", 7), ("year", 4)):
            r = self.e.run("def on_bar(b, a): pass\n", {"bar": size, "start": "2001-01-01", "end": "2010-12-31"})
            if key:
                keys = [x[:key] for x in r["dates"]]
                self.assertEqual(len(keys), len(set(keys)), size)
        r = self.e.run("def on_bar(b, a): pass\n", {"bar": "month", "start": "2001-01-01", "end": "2001-12-31"})
        self.assertEqual(len(r["dates"]), 12)


if __name__ == "__main__":
    unittest.main()
