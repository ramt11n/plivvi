// Reproduce the public sharing artwork with the site's own font and mascot.
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const font = (await fs.readFile('public/fonts/Sora.ttf')).toString('base64');
const mascot = (await fs.readFile('public/visuals/mascot/pli-paper-hero-512.webp')).toString(
  'base64',
);
const head = (await fs.readFile('public/visuals/mascot/pli-logo-head.webp')).toString('base64');
const social = JSON.parse(await fs.readFile('src/seo/social.json', 'utf8'));
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.platform === 'win32'
      ? 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'
      : undefined,
});
const page = await browser.newPage({
  viewport: { width: social.width, height: social.height },
  deviceScaleFactor: 1,
});
await page.setContent(`<!doctype html><html><style>
@font-face{font-family:Sora;src:url(data:font/ttf;base64,${font});font-weight:100 800}*{box-sizing:border-box}body{margin:0;background:#101524;color:#edf1fc;font-family:Sora,sans-serif;width:1200px;height:630px;overflow:hidden}.brand{position:absolute;left:62px;top:42px;display:flex;align-items:center;gap:12px;font-weight:800;font-size:38px;letter-spacing:-2px}.brand img{width:48px;height:48px;object-fit:contain}.fold{color:#9cb0ff;letter-spacing:-5.7px;margin-right:4.2px}.dot{color:#a9e7c9}h1{position:absolute;left:62px;top:123px;font-size:64px;line-height:1.13;letter-spacing:-3px;font-weight:720;margin:0;z-index:2}h1 span{color:#9fb2ff}.promise{position:absolute;left:65px;top:300px;font-size:19px;line-height:1.7;color:#c4cee0;margin:0;width:590px}.chips{position:absolute;left:64px;top:398px;display:flex;gap:10px;z-index:2}.chip{font-size:15px;border:1px solid #405178;padding:13px 16px;border-radius:12px;color:#e6edff;background:#19243c}.foot{position:absolute;bottom:56px;left:65px;font-size:18px;color:#abe8cd}.url{position:absolute;right:64px;bottom:56px;color:#b7c7e3;font-size:16px}.halo{position:absolute;right:-50px;top:62px;width:520px;height:460px;border-radius:50%;background:radial-gradient(ellipse,#364fb5a6,transparent 68%)}.mascot{position:absolute;right:9px;top:105px;width:460px;height:430px;object-fit:contain}
</style><body><div class="brand"><img src="data:image/webp;base64,${head}"><span>pli<span class="fold">vv</span>i<span class="dot">.</span></span></div><h1>Your docs.<br><span>Your next move.</span></h1><p class="promise">Convert files. Draw vectors. Make notes.<br>Your document workspace, on your device.</p><div class="chips"><div class="chip">File converter</div><div class="chip">SVG Studio</div><div class="chip">Digital notebooks</div></div><div class="halo"></div><img class="mascot" src="data:image/webp;base64,${mascot}"><div class="foot">Free. Open source. No required account.</div><div class="url">plivvi.pages.dev</div></body></html>`);
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode()));
});
await fs.mkdir('public/social', { recursive: true });
await page.screenshot({ path: 'public' + social.image, type: 'jpeg', quality: 92 });
await page.screenshot({ path: 'public/og.png', type: 'png' });
await browser.close();
