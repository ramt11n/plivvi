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
def app_icon(size, maskable=False):
    # Typeset the website's real Sora 800 wordmark; keep raster art free of lettering.
    large=1024
    result=Image.new('RGBA',(large,large),'#1b2540')
    d=ImageDraw.Draw(result)
    word=ImageFont.truetype(str(ROOT/'public/fonts/Sora.ttf'),180 if maskable else 260)
    word.set_variation_by_axes([800])
    text='plivvi.'
    tracking=-word.size*1.5/27
    vv_tracking=-word.size/27
    total=d.textlength(text,font=word)+tracking*6+vv_tracking
    start=(large-total)/2
    baseline=345 if maskable else 220
    for i,char in enumerate(text):
        x=start+d.textlength(text[:i],font=word)+tracking*i+(vv_tracking if i>=4 else 0)
        color='#a9baff' if i in (3,4) else '#55c998' if char=='.' else '#f3f6ff'
        d.text((x,baseline),char,font=word,fill=color,anchor='ls')
    mascot=Image.open(ROOT/'public/visuals/mascot/pli-app-cutout.webp').convert('RGBA')
    mascot=mascot.resize((large,large),Image.Resampling.LANCZOS)
    # Layer the very top of the paper head over the bottom edge of the wordmark.
    result.alpha_composite(mascot,(0,125 if maskable else 0))
    return result.convert('RGB').resize((size,size),Image.Resampling.LANCZOS)
for size in (180,192,512):app_icon(size).quantize(colors=256,method=Image.Quantize.MEDIANCUT).save(ROOT/f'public/icon-{size}.png',optimize=True)
app_icon(512,True).quantize(colors=256,method=Image.Quantize.MEDIANCUT).save(ROOT/'public/icon-maskable-512.png',optimize=True)
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
