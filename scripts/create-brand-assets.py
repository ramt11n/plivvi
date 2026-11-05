"""Export install and social assets from Pli's mascot and the Plivvi wordmark."""
from pathlib import Path
import json
import base64
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
brand=json.loads((ROOT/'src/brand.json').read_text())
HEAD=ROOT/'public/visuals/mascot/pli-logo-head.webp'
head_bytes=HEAD.read_bytes()
SVG='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="14" fill="#3659e3"/><image x="2" y="2" width="44" height="44" href="data:image/webp;base64,'''+base64.b64encode(head_bytes).decode()+'''"/></svg>'''
(ROOT/'public/icon.svg').write_text(SVG+'\n')
def icon(size):
    im=Image.new('RGBA',(size,size),'#3659e3')
    head=Image.open(HEAD).convert('RGBA')
    head.thumbnail((int(size*.92),int(size*.92)),Image.Resampling.LANCZOS)
    im.alpha_composite(head,((size-head.width)//2,(size-head.height)//2))
    return im
def app_icon(size):
    # One app badge combines the mascot and the existing Plivvi typography.
    large=1024
    result=Image.new('RGB',(large,large),'#1b2540')
    d=ImageDraw.Draw(result)
    d.ellipse((190,70,850,750),fill='#253a72')
    mark=icon(390).convert('RGB')
    mask=Image.new('L',(390,390))
    ImageDraw.Draw(mask).rounded_rectangle((0,0,389,389),radius=100,fill=255)
    result.paste(mark,(317,104),mask)
    word=ImageFont.truetype(str(ROOT/'public/fonts/Sora.ttf'),140)
    word.set_variation_by_axes([800])
    parts=[('pli','#f3f6ff'),('vv','#a9baff'),('i','#f3f6ff'),('.','#55c998')]
    total=sum(d.textlength(piece,font=word) for piece,_ in parts)
    x=(large-total)/2
    for piece,color in parts:
        d.text((x,610),piece,font=word,fill=color,stroke_width=1)
        x+=d.textlength(piece,font=word)
    d.rounded_rectangle((287,820,737,831),radius=5,fill='#a9baff')
    return result.resize((size,size),Image.Resampling.LANCZOS)
for size in (192,512):app_icon(size).save(ROOT/f'public/icon-{size}.png',optimize=True)
# A native, reproducible social card. Typography and drawings are generated from source.
im=Image.new('RGB',(1200,630),'#f5f7fc');d=ImageDraw.Draw(im)
def font(size):
    value=ImageFont.truetype(str(ROOT/'public/fonts/Sora.ttf'),size);value.set_variation_by_axes([650]);return value
def body(size):
    value=ImageFont.truetype(str(ROOT/'public/fonts/Manrope.ttf'),size);value.set_variation_by_axes([500]);return value
im.paste(icon(58).convert('RGB'),(67,55))
d.text((143,66),brand['name'].lower()+'.',font=font(29),fill='#1a233b')
d.text((65,183),'Your docs.',font=font(62),fill='#1a233b',stroke_width=1)
d.text((65,263),'Your next move.',font=font(62),fill='#3659e3',stroke_width=1)
d.text((69,369),'Read. Handwrite. Scan. Sign. Organize.',font=body(20),fill='#64718b')
d.rounded_rectangle((67,431,503,480),radius=13,fill='#3659e3')
d.text((86,444),'Free tools. Open source. Vibe coded.',font=body(18),fill='white')
d.text((69,550),'Made by Ramtin Neshatvar',font=body(16),fill='#64718b')
d.ellipse((807,103,1180,497),fill='#dce5ff')
hero=Image.open(ROOT/'public/visuals/mascot/pli-paper-hero.webp').convert('RGBA')
hero.thumbnail((440,520),Image.Resampling.LANCZOS)
im.paste(hero,(780,95),hero)
im.save(ROOT/'public/og.png',optimize=True)
