"""Render repeatable Plivvi motion type + carousel assets locally. No generation API."""
from pathlib import Path
import argparse, json, zipfile
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT/'marketing/campaign.json').read_text())
OUT = ROOT/'marketing/output'
W = 1080
NAVY, WHITE, LILAC, MINT, BLUE = '#101524', '#f3f6ff', '#a9baff', '#b9ead3', '#3659e3'

@lru_cache(maxsize=80)
def font(size, body=False, weight=750):
    f = ImageFont.truetype(str(ROOT/'public/fonts'/('Manrope.ttf' if body else 'Sora.ttf')), size)
    f.set_variation_by_axes([weight])
    return f

def text_image(text, size=88, color=WHITE, width=900, body=False, weight=750, center=False):
    f = font(size, body, weight)
    measure = ImageDraw.Draw(Image.new('RGB',(1,1)))
    lines, line = [], ''
    for word in text.split():
        trial = (line+' '+word).strip()
        if measure.textlength(trial,font=f)>width and line:
            lines.append(line); line=word
        else: line=trial
    if line: lines.append(line)
    step = round(size*1.35)
    im=Image.new('RGBA',(width,step*len(lines)+6))
    d=ImageDraw.Draw(im)
    for i, value in enumerate(lines):
        x=(width-d.textlength(value,font=f))/2 if center else 0
        d.text((x,i*step),value,font=f,fill=color,anchor='lt')
    return im

@lru_cache(maxsize=8)
def wordmark(width):
    im=Image.new('RGBA',(1100,330)); d=ImageDraw.Draw(im)
    f=font(260,False,800); label='plivvi.'; tracking=-260*1.5/27; vv=-260/27
    for i,c in enumerate(label):
        x=20+d.textlength(label[:i],font=f)+tracking*i+(vv if i>=4 else 0)
        d.text((x,260),c,font=f,fill=LILAC if i in (3,4) else '#55c998' if c=='.' else WHITE,anchor='ls')
    im=im.crop(im.getbbox())
    return im.resize((width,round(width*im.height/im.width)),Image.Resampling.LANCZOS)

@lru_cache(maxsize=6)
def mascot(width):
    im=Image.open(ROOT/'public/visuals/mascot/pli-logo-head.webp').convert('RGBA')
    im=im.crop(im.getchannel('A').point(lambda a:255 if a>10 else 0).getbbox())
    return im.resize((width,round(width*im.height/im.width)),Image.Resampling.LANCZOS)

def round_image(image, width, radius=24):
    im=image.convert('RGBA'); im=im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS)
    mask=Image.new('L',im.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,im.width-1,im.height-1),radius=radius,fill=255)
    im.putalpha(mask);return im

@lru_cache(maxsize=2)
def workspace(width):
    path=ROOT/'marketing/inputs/reader.png'
    if not path.exists(): raise SystemExit('Capture the real sample reader to marketing/inputs/reader.png first.')
    return round_image(Image.open(path),width)

def devices():
    im=Image.new('RGBA',(880,240));d=ImageDraw.Draw(im)
    # Simple symbolic icons, not fabricated hardware/product screenshots.
    d.rounded_rectangle((20,34,139,224),radius=18,outline=MINT,width=5)
    d.line((62,207,98,207),fill=MINT,width=4)
    d.rounded_rectangle((260,5,477,224),radius=18,outline=MINT,width=5)
    d.ellipse((365,14,372,21),fill=MINT)
    d.rounded_rectangle((580,24,856,198),radius=10,outline=MINT,width=5)
    d.line((560,213,876,213),fill=MINT,width=7)
    d.line((572,226,864,226),fill=MINT,width=4)
    return im

def local_flow():
    im=Image.new('RGBA',(880,390));d=ImageDraw.Draw(im)
    d.rounded_rectangle((1,1,878,388),radius=30,fill='#1b2540',outline='#3c4b68',width=2)
    d.rounded_rectangle((198,55,680,300),radius=20,fill='#101524',outline=LILAC,width=4)
    d.line((198,103,680,103),fill='#3c4b68',width=3)
    for x in [222,240,258]:d.ellipse((x,74,x+7,81),fill=MINT)
    # File moves into a local work area, then a new copy leaves it.
    d.rounded_rectangle((370,133,474,255),radius=9,fill=WHITE)
    for y,length in [(165,62),(185,48),(205,62)]: d.line((391,y,391+length,y),fill=BLUE,width=5)
    for a,b in [(64,165),(710,811)]:
        d.line((a,182,b,182),fill=MINT,width=5)
        d.line((b-15,167,b,182,b-15,197),fill=MINT,width=5)
    for label,x in [('OPEN',44),('YOUR DEVICE',325),('SAVE',735)]:
        d.text((x,335),label,font=font(24,True,700),fill=MINT,anchor='lt')
    return im

def scene(index, height):
    data=CONFIG['scenes'][index]; compact=height<1600
    bg=BLUE if data['kind']=='benefits' else NAVY
    base=Image.new('RGBA',(W,height),bg);d=ImageDraw.Draw(base)
    base.alpha_composite(wordmark(210),(90,110 if compact else 185))
    d.text((850,120 if compact else 195),f'{index+1:02d} / 05',font=font(25,True,650),fill=LILAC if bg==NAVY else WHITE,anchor='lt')
    footer=height-100 if compact else 1585
    d.line((90,footer-30,990,footer-30),fill='#ffffff24',width=1)
    d.text((90,footer),CONFIG['url'],font=font(30,True,650),fill=MINT if bg==NAVY else WHITE,anchor='lt')
    layers=[]
    def add(im,x,y,delay=0):layers.append((im,x,y,delay))
    def text(value,x,y,size=88,color=WHITE,delay=0,body=False,weight=750,center=False):
        add(text_image(value,size,color,900,body,weight,center),x,y,delay)
    start=235 if compact else 385
    size=80 if compact else 92
    step=98 if compact else 112
    kind=data['kind']
    if kind in ('intro','privacy','workspace','benefits'):
        for i,line in enumerate(data['lines']):
            text(line,90,start+i*step,size,MINT if i==len(data['lines'])-1 else WHITE,0.05+i*.13)
    if kind=='intro':
        text(data['body'],90,600 if compact else 790,34,LILAC,.55,True,550)
        head=mascot(320 if compact else 370)
        add(head,(W-head.width)//2,735 if compact else 1000,.72)
        text('FREE. OPEN SOURCE. YOURS.',90,1125 if compact else 1450,27,MINT,.92,True,750)
    elif kind=='privacy':
        text(data['body'],90,480 if compact else 680,36,LILAC,.45,True,550)
        add(local_flow(),100,690 if compact else 940,.65)
        text(data['note'],90,1125 if compact else 1450,30,MINT,.85,True,600)
    elif kind=='workspace':
        text(data['body'],90,460 if compact else 660,32,LILAC,.35,True,550)
        shot=workspace(900)
        add(shot,90,530 if compact else 790,.55)
        text(data['note'],90,1180 if compact else 1485,24,LILAC,.8,True,500)
    elif kind=='benefits':
        add(devices(),100,760 if compact else 1050,.65)
        text(data['body'],90,1040 if compact else 1350,34,WHITE,.8,True,650)
        text(data['note'],90,1110 if compact else 1430,30,MINT,.95,True,600)
    elif kind=='outro':
        add(wordmark(720),180,280 if compact else 420,.05)
        head=mascot(290 if compact else 360)
        add(head,(W-head.width)//2,520 if compact else 740,.25)
        text(data['lines'][0],90,905 if compact else 1180,65,WHITE,.45,False,750,True)
        cta=Image.new('RGBA',(900,106));cd=ImageDraw.Draw(cta)
        cd.rounded_rectangle((0,0,899,105),radius=22,fill=MINT)
        cd.text((36,30),data['body'],font=font(38,False,750),fill=NAVY,anchor='lt')
        cd.line((800,53,850,53),fill=NAVY,width=4);cd.line((836,37,852,53,836,69),fill=NAVY,width=4)
        add(cta,90,1045 if compact else 1340,.62)
    return base,layers


def ease(x):return 1-(1-max(0,min(1,x)))**3

def frame(model, t):
    base,layers=model;im=base.copy()
    for layer,x,y,delay in layers:
        p=ease((t-delay)/.6)
        if p<=0:continue
        if p<1:
            layer=layer.copy();layer.putalpha(layer.getchannel('A').point(lambda a:int(a*p)))
        im.alpha_composite(layer,(round(x),round(y+38*(1-p))))
    return im.convert('RGB')


def bundle(stills_only=False):
    names=[f'carousel-{i:02d}.png' for i in range(1,6)]+['reel-cover.png','carousel-preview.png','captions.txt','voiceover.txt']
    if not stills_only:names+=['plivvi-intro.mp4','render-info.json']
    name='plivvi-carousel-starter.zip' if stills_only else 'plivvi-social-starter.zip'
    with zipfile.ZipFile(OUT/name,'w',zipfile.ZIP_DEFLATED) as archive:
        for name in names:archive.write(OUT/name,name)


def render(stills_only=False):
    OUT.mkdir(parents=True,exist_ok=True)
    full=[scene(i,1920) for i in range(5)]
    for i in range(5):frame(scene(i,1350),2).save(OUT/f'carousel-{i+1:02d}.png',optimize=True)
    frame(full[0],2).save(OUT/'reel-cover.png',optimize=True)
    sheet=Image.new('RGB',(1080,270),NAVY)
    for i in range(5):sheet.paste(Image.open(OUT/f'carousel-{i+1:02d}.png').resize((216,270),Image.Resampling.LANCZOS),(216*i,0))
    sheet.save(OUT/'carousel-preview.png')
    (OUT/'voiceover.txt').write_text(CONFIG['voiceover']+'\n')
    (OUT/'captions.txt').write_text('INTRO REEL\n\n'+CONFIG['caption']+'\n\nCAROUSEL\n\n'+CONFIG['carousel_caption']+'\n\nDrafts only. Preview before posting; use the actual account bio link.\n')
    if stills_only:
        bundle(True)
        return
    fps=CONFIG['fps'];target=OUT/'plivvi-intro.mp4'
    writer=cv2.VideoWriter(str(target),cv2.VideoWriter_fourcc(*'avc1'),fps,(1080,1920))
    if not writer.isOpened():raise SystemExit('This OpenCV build has no H.264 encoder. Use a build with an available AVC encoder.')
    count=0
    for i, data in enumerate(CONFIG['scenes']):
        frames=round(data['seconds']*fps)
        for n in range(frames):
            t=n/fps;im=frame(full[i],t)
            if i and t<.18:im=Image.blend(frame(full[i-1],3),im,t/.18)
            writer.write(cv2.cvtColor(np.asarray(im),cv2.COLOR_RGB2BGR));count+=1
        print(f'Rendered scene {i+1}/5',flush=True)
    writer.release()
    # Decode the complete artifact; verify dimensions, frame count and duration.
    capture=cv2.VideoCapture(str(target));decoded=0
    assert round(capture.get(cv2.CAP_PROP_FRAME_WIDTH))==1080
    assert round(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))==1920
    while True:
        ok,_=capture.read()
        if not ok:break
        decoded+=1
    capture.release()
    assert decoded==count,(decoded,count)
    metadata={'width':1080,'height':1920,'fps':fps,'frames':count,'seconds':count/fps,'codec':'H.264','audio':'none; optional human voiceover script supplied','generation_api_calls':0}
    (OUT/'render-info.json').write_text(json.dumps(metadata,indent=2)+'\n')
    bundle()
    print(json.dumps(metadata),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--stills-only',action='store_true')
    render(parser.parse_args().stills_only)
