# Skapar en förhandsversion för Claude Artifact (utan <html>/<head>/<body> och utan inbäddad karta).
import re, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
s = re.sub(r'<!doctype html>\s*', '', s, flags=re.I)
s = re.sub(r'</?html[^>]*>\s*', '', s)
s = re.sub(r'<meta charset="utf-8">\s*', '', s)
s = re.sub(r'<meta name="viewport"[^>]*>\s*', '', s)
s = re.sub(r'</?head>\s*', '', s)
s = re.sub(r'</?body>\s*', '', s)
s = re.sub(r'<!--MAP-EMBED-->.*?<!--/MAP-EMBED-->', '', s, flags=re.S)
s = s.replace('<link rel="manifest" href="site.webmanifest">\n', '')
open(dst, "w", encoding="utf-8").write(s)
