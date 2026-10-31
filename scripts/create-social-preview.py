"""Create Pocket's original, code-drawn social card. Requires Pillow only for asset regeneration."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
image = Image.new("RGB", (1200, 630), "#f5f5fc")
draw = ImageDraw.Draw(image)
font_path = ROOT / "public/fonts/DejaVuSans.ttf"

def font(size):
    return ImageFont.truetype(str(font_path), size)

draw.rounded_rectangle((30, 30, 1170, 600), radius=34, fill="#edeafa", outline="#dedaf1", width=2)
draw.rounded_rectangle((76, 72, 127, 126), radius=15, fill="#7770dc")
draw.polygon([(91, 82), (107, 82), (116, 92), (116, 115), (91, 115)], fill="white")
draw.line([(96, 101), (102, 107), (112, 96)], fill="#7770dc", width=3)
draw.text((143, 73), "Pocket.", font=font(37), fill="#29314b", stroke_width=1)
draw.text((79, 181), "A little less", font=font(65), fill="#303851", stroke_width=1)
draw.text((79, 257), "paperwork.", font=font(65), fill="#303851", stroke_width=1)
draw.text((82, 365), "Read. Draw. Scan. Merge. Sign. Convert.", font=font(22), fill="#727b96")
draw.rounded_rectangle((79, 426, 530, 476), radius=12, fill="#7770dc")
draw.text((99, 439), "Free • Open source • Vibe coded", font=font(19), fill="white")
draw.text((82, 531), "Made by Ramtin Neshatvar", font=font(17), fill="#828ba4")
draw.rounded_rectangle((793, 138, 1084, 501), radius=19, fill="#dedaf2")
draw.rounded_rectangle((762, 112, 1053, 475), radius=19, fill="white", outline="#dfddeb", width=2)
draw.rounded_rectangle((799, 147, 823, 172), radius=7, fill="#aaa2e3")
draw.text((838, 150), "pocket studio", font=font(13), fill="#9297ae")
for y, width in [(204, 204), (228, 158), (277, 190), (300, 160), (324, 183), (348, 117)]:
    draw.rounded_rectangle((800, y, 800 + width, y + 8), radius=4, fill="#e5e5ef")
draw.text((824, 398), "All sorted.", font=font(24), fill="#8f86c2")
draw.rounded_rectangle((1019, 170, 1104, 215), radius=10, fill="#e8a0a5")
draw.text((1042, 180), "PDF", font=font(20), fill="white")
image.save(ROOT / "public/og.png", optimize=True)
