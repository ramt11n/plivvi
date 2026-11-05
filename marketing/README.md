# A repeatable Plivvi content template

This is code-rendered motion design, not paid generative video. It uses the existing Sora/Manrope fonts, original mascot, brand colors and a real Plivvi screenshot showing a public sample PDF. No third-party generation, music or voice service is called.

Edit `campaign.json`, then run:

```sh
python3 -m pip install -r marketing/requirements.txt
python3 marketing/render.py
```

The current Mac environment already has the dependencies. No packages were installed for the first render. H.264 encoding must be available in the OpenCV build.

Outputs (not included in the website bundle):

- `output/plivvi-intro.mp4` — 18-second, 1080×1920, 24 fps H.264 reel; silent, ready for optional human voiceover.
- `output/carousel-01.png` through `carousel-05.png` — 1080×1350 carousel slides.
- `output/reel-cover.png`, `carousel-preview.png`, `voiceover.txt` and `render-info.json`.

Use `--stills-only` for a quick carousel export. Outputs are ignored by Git; source, copy and the public-sample screenshot are versioned. The app runtime does not import this folder.

For a new campaign, edit one story, render the reel and carousel together, then review text size, timing and the actual exported files before posting. The layout is a template, not a promise about every social platform's cropping. Preview the post in its destination app. Keep private user documents out of screenshots. Only the source screenshot includes real UI; symbolic browser/device drawings explain architecture and are not fabricated product screenshots.

The template's claim policy: free tools, open source, browser-local document processing, optional accounts/cloud and responsive PWA. Do not market unreliable OCR, claim “100% secure,” or promise universal hardware support. See [business model](../docs/BUSINESS-MODEL.md).

No Instagram account connection, posting, DMs, ad spending or paid API usage is configured. Human voiceover and licensed music can be added later; the sample contains neither.
