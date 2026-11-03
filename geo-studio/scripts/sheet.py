"""Contact sheet of stills: python -I scripts/sheet.py out/<slug>/stills out.jpg [cols] [width]"""
import glob, sys
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
w = int(sys.argv[4]) if len(sys.argv) > 4 else 300
fs = sorted(glob.glob(d + '/*.jpg'))
h = int(w * 16 / 9)
rows = (len(fs) + cols - 1) // cols
o = Image.new('RGB', (cols * w, rows * (h + 26)), (20, 20, 20))
dr = ImageDraw.Draw(o)
for i, f in enumerate(fs):
    im = Image.open(f).resize((w, h))
    x, y = (i % cols) * w, (i // cols) * (h + 26)
    o.paste(im, (x, y + 26)); dr.text((x + 6, y + 6), f.split('/')[-1], fill=(255, 255, 0))
o.save(out, quality=86)
