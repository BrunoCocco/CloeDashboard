"""Synthetic, public test fixture only. Requires Pillow; never reads user images.
Usage: python scripts/generate-vision-fixture.py --output /tmp/cloe-vision-fixture
The PNG is NOT market data, and expected.json is ground truth, not model output.
"""
import argparse
import json
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path)
args = parser.parse_args()
folder = args.output or Path(tempfile.mkdtemp(prefix="cloe-vision-fixture-"))
folder.mkdir(parents=True, exist_ok=True)
image = Image.new("RGB", (1700, 1600), "#0b1018")
draw = ImageDraw.Draw(image)
font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
font = ImageFont.truetype(font_path, 20)
large = ImageFont.truetype(font_path, 26)
draw.text((24, 18), "SYNTHETIC TEST ONLY - NOT MARKET DATA", fill="#fbbf24", font=large)
frames = [
    {"position": "top", "timeframe": "1W", "ohlc": [100, 110, 95, 105], "displayedPrice": 105, "volume": 1234,
     "indicatorLabels": ["VWAP Session hl2: 101.25 USD", "RSI 14 close: 63.50  |  EMA 14 RSI: 61.20"],
     "mark": "SUPPORT ZONE: 98.00 - 100.00 USD"},
    {"position": "middle", "timeframe": "1D", "ohlc": [104, 108, 101, 106], "displayedPrice": 106, "volume": 2345,
     "indicatorLabels": ["SMA 20 close: 102.40 USD", "RSI 14 hl2: 37.25  |  EMA 14 RSI: 40.10"],
     "mark": "RESISTANCE: 109.00 USD"},
    {"position": "bottom", "timeframe": "4H", "ohlc": [105, 107, 104, 106.25], "displayedPrice": 106.25, "volume": 3456,
     "indicatorLabels": ["BOLLINGER 20 close 2: MID 105.00 UPPER 110.00 LOWER 100.00 USD"],
     "mark": "REFERENCE: 103.00 USD"},
]
for index, panel in enumerate(frames):
    top = 78 + index * 500
    draw.rectangle((15, top, 1685, top + 480), outline="#45556d", width=2)
    lines = [f"TESTBTC/USD | EXCHANGE: DEMO | TF: {panel['timeframe']}",
             "CROSSHAIR CANDLE: 2026-01-05 00:00 UTC (HISTORICAL)",
             "O %.2f H %.2f L %.2f C %.2f | DISPLAYED PRICE %.2f USD" % (*panel["ohlc"], panel["displayedPrice"]),
             f"VOLUME: {panel['volume']} TESTBTC", *panel["indicatorLabels"]]
    for line_index, line in enumerate(lines):
        draw.text((32, top + 14 + line_index * 30), line, fill="#e5edf8", font=font)
    chart_top = top + 235
    for value, y in [(110, chart_top + 10), (105, chart_top + 60), (100, chart_top + 110), (95, chart_top + 160)]:
        draw.line((32, y, 1580, y), fill="#283448")
        draw.text((1588, y - 10), str(value), fill="#a5b4ca", font=font)
    for candle in range(12):
        x = 80 + candle * 110
        y = chart_top + 95 - (candle % 4) * 16
        draw.line((x, y - 20, x, y + 45), fill="#65d6ab", width=3)
        draw.rectangle((x - 12, y, x + 12, y + 25), fill="#65d6ab")
    if index == 0:
        draw.rectangle((40, chart_top + 110, 1530, chart_top + 130), outline="#fbbf24", width=2)
    else:
        y = chart_top + (20 if index == 1 else 80)
        draw.line((40, y, 1530, y), fill="#fbbf24", width=2)
    draw.text((45, top + 430), panel["mark"], fill="#fbbf24", font=font)
    if panel["timeframe"] != "4H":
        draw.text((860, top + 430), "RSI MIDDLE REFERENCE: 50", fill="#ff69b4", font=font)
image.save(folder / "synthetic-widget.png", optimize=True)
truth = {"synthetic": True, "isModelOutput": False, "asset": "TESTBTC", "exchange": "DEMO", "pair": "TESTBTC/USD", "volumeUnit": "TESTBTC", "panels": frames,
         "checks": ["VWAP must read Session, never copy Quarter from app configuration.", "RSI reference 50 is not the RSI value.", "OHLC belongs to the historical crosshair candle, not a verified current quote.", "Include every visible indicator and visible parameter; preserve price and volume units.", "Drawn locations without explicit labels are estimates, not exact coordinates."]}
(folder / "expected.json").write_text(json.dumps(truth, indent=2) + "\n")
print(str(folder / "synthetic-widget.png"))
print(str(folder / "expected.json"))
