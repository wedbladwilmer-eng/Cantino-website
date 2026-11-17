from PIL import Image, ImageDraw, ImageFont, ImageFilter
import glob
OUT='/home/user/cantino/site/assets/img/'
NAVY=(14,26,51,255); BRASS=(201,164,92,255); CREAM=(246,240,228,255); GREEN=(47,93,70,255)
logo=Image.open('logo-rgba.png')
# web logo, trimmed
lt=logo.crop(logo.getbbox()); lt.save(OUT+'logo-cantino.png',optimize=True)
lt.save(OUT+'logo-cantino.webp',quality=90,method=6)
print('logo',lt.size)
# C glyph
c=logo.crop((40,0,275,200)).copy()
px=c.load()
for x in range(c.width):
  for y in range(c.height):
    if x+40>232 and y>70: px[x,y]=(0,0,0,0)
c=c.crop(c.getbbox()); print('C',c.size)
def icon(size,pad=0.1,radius=0.22):
  im=Image.new('RGBA',(size*4,size*4),(0,0,0,0))
  d=ImageDraw.Draw(im); d.rounded_rectangle([0,0,size*4-1,size*4-1],radius=int(size*4*radius),fill=NAVY)
  g=c.copy(); s=size*4*(1-2*pad); g=g.resize((int(s),int(s*c.height/c.width)),Image.LANCZOS)
  k=3 if size<=48 else (5 if size<=192 else 9)
  a=g.split()[-1].filter(ImageFilter.MaxFilter(k)); g=Image.merge('RGBA',(Image.new('L',g.size,246),Image.new('L',g.size,240),Image.new('L',g.size,228),a))
  im.alpha_composite(g,((size*4-g.width)//2+int(size*0.1),(size*4-g.height)//2))
  return im.resize((size,size),Image.LANCZOS)
for s in (16,32,48,192,512): icon(s).save(OUT+f'favicon-{s}.png',optimize=True)
at=Image.new('RGBA',(180,180),NAVY); g=icon(180,pad=0.1,radius=0); at=g; at.convert('RGB').save(OUT+'apple-touch-icon.png',optimize=True)
icon(48).save('/home/user/cantino/site/favicon.ico',sizes=[(16,16),(32,32),(48,48)])
