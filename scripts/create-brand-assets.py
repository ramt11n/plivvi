"""Export the original Plivvi vector identity and code-drawn install/social assets."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
brand=json.loads((ROOT/'src/brand.json').read_text())
SVG='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none"><rect x="1" y="1" width="46" height="46" rx="14" fill="#3659E3"/><rect x="11" y="13" width="21" height="26" rx="3" transform="rotate(-13 21 25)" fill="#BFF2D1"/><path d="M15 13a3 3 0 0 1 3-3h11l7 7v17a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V13Z" fill="white"/><path d="M29 10v5a2 2 0 0 0 2 2h5l-7-7Z" fill="#D9E2FF"/><rect x="21" y="23" width="3" height="4" rx="1.5" fill="#263B69"/><rect x="29" y="23" width="3" height="4" rx="1.5" fill="#263B69"/><path d="M23 31c2 2 5 2 7 0" stroke="#263B69" stroke-width="1.7" stroke-linecap="round"/></svg>'''
(ROOT/'public/icon.svg').write_text(SVG+'\n')
def icon(size):
    scale=4
    im=Image.new('RGBA',(size*scale,size*scale),'#3659e3')
    s=size*scale/48
    def box(v): return tuple(round(x*s) for x in v)
    back=Image.new('RGBA',im.size)
    d=ImageDraw.Draw(back);d.rounded_rectangle(box((11,13,32,39)),radius=3*s,fill='#bff2d1')
    back=back.rotate(13,resample=Image.Resampling.BICUBIC,center=(21*s,25*s))
    im.alpha_composite(back)
    d=ImageDraw.Draw(im)
    d.rounded_rectangle(box((15,10,36,38)),radius=4*s,fill='white')
    d.polygon([(29*s,10*s),(36*s,17*s),(36*s,10*s)],fill='#3659e3')
    d.polygon([(29*s,10*s),(29*s,17*s),(36*s,17*s)],fill='#d9e2ff')
    for x in (21,29):d.rounded_rectangle(box((x,23,x+3,27)),radius=1.5*s,fill='#263b69')
    d.arc(box((23,28,30,33)),start=15,end=165,fill='#263b69',width=round(1.7*s))
    return im.resize((size,size),Image.Resampling.LANCZOS)
def app_icon(size):
    # One app badge combines the smiling page and the actual Plivvi wordmark.
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
d.ellipse((847,120,1200,473),fill='#dce5ff')
for x,y,fill in [(853,170,'#c9f7d7'),(909,147,'#ffe3cd')]:d.rounded_rectangle((x,y,x+170,y+249),radius=24,fill=fill)
d.rounded_rectangle((832,132,1021,407),radius=22,fill='white',outline='#dce2ed',width=2)
d.polygon([(980,132),(1021,173),(1021,132)],fill='#f5f7fc')
d.polygon([(980,132),(980,173),(1021,173)],fill='#d9e2ff')
for x in [882,942]:d.rounded_rectangle((x,228,x+12,251),radius=6,fill='#263b69')
d.arc((889,259,950,299),start=20,end=160,width=5,fill='#263b69')
for y,w in [(333,112),(354,83)]:d.rounded_rectangle((867,y,867+w,y+6),radius=3,fill='#e5eaf4')
d.rounded_rectangle((985,364,1045,424),radius=20,fill='#3659e3',outline='white',width=5)
d.line((1015,380,1015,409),fill='white',width=4);d.line((1001,394,1029,394),fill='white',width=4)
im.save(ROOT/'public/og.png',optimize=True)
