"""Bygger /site från /src.
   python3 tools/build.py            -> riktig sajt (Netlify)
   python3 tools/build.py --preview  -> startsidan som Claude Artifact i /preview

Sidorna i src/ (index, meny, sallskap) har markörer som fylls i här:
<!--FONTS--> <!--STYLE--> <!--HEADER--> <!--FOOTER--> <!--MAP--> <!--SCRIPT-->
Delarna ligger i src/_delar/. Sidans egen kod står i <script type="text/x-page">.
"""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, SITE, PARTS = ROOT / 'src', ROOT / 'site', ROOT / 'src/_delar'
SITE_URL = 'https://cantino-restaurang.netlify.app'
preview = '--preview' in sys.argv
read = lambda p: p.read_text(encoding='utf-8')

if preview:
    fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
             '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&family=Figtree:wght@400..700&family=Jost:wght@400..700&display=swap">')
    mapblock = '<div class="map-fallback"><p>Prästgårdsängen 1, Göteborg.<br>Kartan visas på den publicerade sajten.</p></div>'
else:
    fonts = ('<link rel="preload" href="/assets/fonts/jost.woff2" as="font" type="font/woff2" crossorigin>\n'
             '<link rel="preload" href="/assets/fonts/figtree.woff2" as="font" type="font/woff2" crossorigin>\n'
             '<style>' + read(SITE / 'assets/fonts/fonts.css') + '</style>')
    mapblock = ('<iframe src="https://www.google.com/maps?q=Pr%C3%A4stg%C3%A5rds%C3%A4ngen+1,+412+71+G%C3%B6teborg&amp;output=embed" '
                'title="Karta: Cantino Restaurang, Prästgårdsängen 1, Göteborg" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>')

def mincss(c):
    c = re.sub(r'/\*.*?\*/', '', c, flags=re.S)
    c = re.sub(r'\s+', ' ', c)
    c = re.sub(r'\s*([{};,>])\s*', r'\1', c)
    return c.strip()

STYLE = '<style>' + mincss(read(PARTS / 'style.css')) + '</style>'
COMMON_JS = read(PARTS / 'common.js')

def render(html):
    page_js = '\n'.join(re.findall(r'<script type="text/x-page">(.*?)</script>\n?', html, flags=re.S))
    html = re.sub(r'<script type="text/x-page">.*?</script>\n?', '', html, flags=re.S)
    script = '<script>\n(function () {\n' + COMMON_JS + page_js + '})();\n</script>'
    for k, v in {'FONTS': fonts, 'STYLE': STYLE, 'HEADER': read(PARTS / 'header.html'),
                 'FOOTER': read(PARTS / 'footer.html'), 'MAP': mapblock, 'SCRIPT': script}.items():
        html = html.replace(f'<!--{k}-->', v)
    html = html.replace('%%SITE_URL%%', SITE_URL)
    if preview:
        html = re.sub(r'(src|href|srcset|imagesrcset)="/(?!/)', r'\1="', html)
        html = re.sub(r'(, )/assets', r'\1assets', html)
        html = html.replace('fetch("/data/', 'fetch("data/')
        for pat in [r'<!doctype html>\s*', r'</?html[^>]*>\s*', r'<meta charset="utf-8">\s*', r'<meta name="viewport"[^>]*>\s*', r'</?head>\s*', r'</?body[^>]*>\s*', r'<link rel="manifest"[^>]*>\s*']:
            html = re.sub(pat, '', html, flags=re.I)
    return html

if preview:
    out = ROOT / 'preview'; out.mkdir(exist_ok=True)
    (out / 'index.html').write_text(render(read(SRC / 'index.html')), encoding='utf-8')
else:
    for name in ['index', 'meny', 'sallskap']:
        (SITE / f'{name}.html').write_text(render(read(SRC / f'{name}.html')), encoding='utf-8')

    # 404 och tack: fullskärmsfoto + text, samma stil som heron
    head = read(SRC / 'meny.html').split('<body', 1)[0]
    def page(title, label, h1, text, href, link):
        h = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', head)
        h = re.sub(r'<link rel="canonical"[^>]*>\n', '', h)
        h = re.sub(r'<meta (name="description"|property="og:title")[^>]*>\n', '', h)
        return render(h + '<body>\n'
            '<main class="hero">\n<div class="hero-img"><img src="/assets/foto/hero-1600.webp" alt=""></div>\n'
            '<div class="wrap"><div class="hero-copy">\n'
            '<a href="/" style="display:inline-block;margin-bottom:48px"><img src="/assets/img/logo-cantino-320.webp" alt="Cantino Restaurang" width="320" height="131" style="width:150px;height:auto"></a>\n'
            f'<p class="label">{label}</p>\n<h1>{h1}</h1>\n<p class="hero-lead">{text}</p>\n'
            f'<a class="textlink" href="{href}">{link}</a>\n'
            '</div></div>\n</main>\n</body>\n</html>\n')
    (SITE / '404.html').write_text(page('Sidan finns inte · Cantino Restaurang', 'Fel 404',
        'Här finns ingen lunch.', 'sidan du letar efter har flyttat eller finns inte. köket är kvar på Prästgårdsängen 1 i Örgryte.',
        '/#lunch', 'Till veckans lunch'), encoding='utf-8')
    (SITE / 'tack.html').write_text(page('Tack · Cantino Restaurang', 'Förfrågan skickad',
        'Tack!', 'vi har tagit emot din förfrågan och svarar inom ett dygn. har du bråttom, ring 076-029 26 26.',
        '/', 'Tillbaka till startsidan'), encoding='utf-8')
print('byggt', 'preview' if preview else 'site')
