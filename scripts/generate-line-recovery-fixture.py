"""One-panel public synthetic line-recovery test. Requires Pillow; no market data."""
import base64
import io
import json
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

seed = 20261028
rng = random.Random(seed)
levels = sorted(rng.sample(range(9300, 10801, 25), 3))
levels = [value / 100 for value in levels]
canvas = Image.new("RGB", (1500, 1000), "#0b1018")
d = ImageDraw.Draw(canvas)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 22)
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 20)
d.text((25, 20), "SYNTHETIC TEST - NOT MARKET DATA", font=font, fill="#fbbf24")
labels = ["TESTBTC/USD | EXCHANGE: DEMO | TF: 4H",
          "CROSSHAIR CANDLE: 2026-01-05 00:00 UTC (HISTORICAL)",
          "O 100.00 H 110.00 L 95.00 C 105.00 | DISPLAYED PRICE 105.00 USD",
          "VOLUME: 1234 TESTBTC | VWAP Session hl2: 101.25 USD",
          "RSI 14 close: 63.50 | EMA 14 RSI: 61.20 | RSI MIDDLE REFERENCE: 50"]
for i, label in enumerate(labels):
    d.text((25, 75 + i * 34), label, font=small, fill="#e5edf8")
def y(price):
    return round(790 - (price - 90) / 25 * 460)
for price in [90, 95, 100, 105, 110, 115]:
    yy = y(price)
    d.line((50, yy, 1370, yy), fill="#2b384a")
    d.text((1385, yy - 12), f"{price:.2f}", font=small, fill="#a5b4ca")
for i in range(12):
    x = 110 + i * 90
    center = 98 + (i % 5) * 1.5
    d.line((x, y(center + 2.5), x, y(center - 1.5)), fill="#65d6ab", width=3)
    d.rectangle((x - 11, y(center + 1.5), x + 11, y(center)), fill="#65d6ab")
colors = ["#fbbf24", "#a78bfa", "#38bdf8"]
for index, price in enumerate(levels):
    yy = y(price)
    d.line((55, yy, 1365, yy), fill=colors[index], width=3)
    if index != 1:
        d.text((75, yy - 28), f"LINE {index + 1}: {price:.2f} USD", font=small, fill=colors[index])
d.text((25, 890), "Three manually drawn horizontal lines; not computed indicators.", font=small, fill="#d5dce7")
d.text((25, 930), "One line has no price label: any recovered price must be estimated.", font=small, fill="#d5dce7")
image = io.BytesIO()
canvas.save(image, "PNG", optimize=True)
fixture = {"synthetic": True, "seed": seed, "imagePngBase64": base64.b64encode(image.getvalue()).decode(),
           "expected": {"asset": "TESTBTC", "exchange": "DEMO", "pair": "TESTBTC/USD", "timeframe": "4H", "ohlc": {"open": 100, "high": 110, "low": 95, "close": 105}, "volume": 1234, "vwap": 101.25, "vwapAnchor": "Session", "rsi": 63.5,
                        "lines": [{"price": price, "labeled": index != 1, "color": colors[index]} for index, price in enumerate(levels)]}}
path = Path(__file__).parent / "fixtures" / "line-recovery.json"
path.write_text(json.dumps(fixture, indent=2) + "\n")
print(f"Generated synthetic fixture: {path.name}; seed={seed}; PNG bytes={len(image.getvalue())}")
