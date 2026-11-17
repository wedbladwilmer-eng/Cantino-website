"""Gör webbfoton av originalen i /foton/original med samma varma, dämpade behandling.

   python3 tools/foton.py

Byta ett foto: lägg det nya fotot i foton/original med samma namn (t.ex. lunch.jpg),
kör skriptet och publicera mappen site/. Listan över bilderna finns i README.
"""
import pathlib
from PIL import Image, ImageEnhance

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'foton/original', ROOT / 'site/assets/foto'

# roll: (bildformat bredd/höjd, beskärning i andelar (vänster, topp, höger, botten), bredder)
FOTON = {
    'hero':  (16 / 9, (0, 0, 1, 1), [960, 1600]),
    # Används precis som beställaren skickade den: ingen beskärning, färgjustering eller korn (se ORORDA)
    'lunch': (4 / 5, (0, 0, 1, 1), [480, 921]),
    # Raden med fyra matfoton (kvadratiska). AI-bilderna beskärs nertill (vattenstämpel).
    'mat-1': (1, (0, 0.15, 1, 0.9), [400, 720]),
    'mat-2': (1, (0, 0.1, 1, 0.9), [400, 720]),
    'mat-3': (1, (0.1, 0, 0.9, 1), [400, 720]),
    # Bara tallriken: den AI-genererade matsalen i bakgrunden ska inte synas
    'mat-4': (1, (0, 0.5, 1, 0.97), [400, 720]),
    'quiz':     (5 / 4, (0, 0, 1, 1), [640, 1100]),
    'sallskap': (5 / 4, (0, 0, 1, 1), [640, 1100]),
}

def grade(im):
    """Något varmare, något mörkare, lätt dämpad mättnad."""
    im = ImageEnhance.Color(im).enhance(0.82)
    im = ImageEnhance.Brightness(im).enhance(0.88)
    im = ImageEnhance.Contrast(im).enhance(0.94)
    r, g, b = im.split()
    r = r.point(lambda v: min(255, v * 1.05 + 4))
    g = g.point(lambda v: min(255, v * 1.01 + 1))
    b = b.point(lambda v: v * 0.90)
    return Image.merge('RGB', (r, g, b))

def crop_to(im, ratio, box):
    w, h = im.size
    im = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
    w, h = im.size
    if w / h > ratio:
        nw = int(h * ratio); x = (w - nw) // 2; im = im.crop((x, 0, x + nw, h))
    else:
        nh = int(w / ratio); y = (h - nh) // 2; im = im.crop((0, y, w, y + nh))
    return im

OUT.mkdir(parents=True, exist_ok=True)
# Lätt filmkorn på AI-bilder som ser för släta ut
KORN = set()
# Bilder som inte ska behandlas alls
ORORDA = {'lunch'}

def grain(im, amount=3):
    import random
    noise = Image.effect_noise(im.size, 40).point(lambda v: 128 + (v - 128) * amount / 40)
    n = Image.merge('RGB', (noise, noise, noise))
    from PIL import ImageChops
    return ImageChops.add(im, n, scale=1, offset=-128)

for roll, (ratio, box, widths) in FOTON.items():
    src = next(SRC.glob(roll + '.*'))
    im = crop_to(Image.open(src).convert('RGB'), ratio, box)
    if roll not in ORORDA: im = grade(im)
    if roll in KORN: im = grain(im)
    for w in widths:
        w = min(w, im.width)
        out = im.resize((w, round(w / ratio)), Image.LANCZOS)
        # Orörda bilder komprimeras mindre, så att de inte blir suddigare än originalet
        out.save(OUT / f'{roll}-{w}.webp', 'WEBP', quality=92 if roll in ORORDA else 80, method=6)
        print(f'{roll}-{w}.webp', out.size)

# Delningsbild för sociala medier (1200 × 630): hero-fotot + logga + rubrik
from PIL import ImageDraw, ImageFont
og = grade(crop_to(Image.open(next(SRC.glob('hero.*'))).convert('RGB'), 1200 / 630, (0, 0, 1, 1))).resize((1200, 630), Image.LANCZOS).convert('RGBA')
shade = Image.new('RGBA', og.size)
sd = ImageDraw.Draw(shade)
for x in range(1200):
    sd.line([(x, 0), (x, 630)], fill=(10, 16, 30, int(225 - 190 * x / 1200)))
og.alpha_composite(shade)
logo = Image.open(ROOT / 'site/assets/img/logo-cantino.png').convert('RGBA'); logo.thumbnail((240, 110), Image.LANCZOS)
og.alpha_composite(logo, (80, 64))
jost = ROOT / 'site/assets/fonts/jost.woff2'
d = ImageDraw.Draw(og)
h1 = ImageFont.truetype(str(jost), 68); h1.set_variation_by_axes([600])
lab = ImageFont.truetype(str(jost), 22); lab.set_variation_by_axes([500])
d.text((80, 300), 'HUSMAN PÅ DAGEN.', font=h1, fill=(245, 240, 230))
d.text((80, 378), 'GRILL PÅ KVÄLLEN.', font=h1, fill=(245, 240, 230))
x = 82
for ch in 'PRÄSTGÅRDSÄNGEN 1, ÖRGRYTE':  # versaler med bokstavsavstånd
    d.text((x, 500), ch, font=lab, fill=(205, 180, 135)); x += d.textlength(ch, font=lab) + 4
og.convert('RGB').save(ROOT / 'site/assets/img/og-cantino.jpg', quality=86)
print('og-cantino.jpg')
