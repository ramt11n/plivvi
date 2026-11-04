# Plivvi identity and feature visuals

Plivvi uses an original folded-page character, a lowercase wordmark with a blue double-v detail, cobalt navigation, and mint/peach accents. Sora is the display typeface; Manrope is the reading/interface typeface. Both are served locally with their Open Font License notices.

The same original mark is exported to the SVG favicon, PNG install icons, and social preview. Regenerate the code-drawn identity assets with `python scripts/create-brand-assets.py` (Pillow required). `src/brand.json` owns the name and theme color. Legacy `pocket-*` storage keys and the existing GitHub repository URL remain stable so the identity change does not discard saved work.

The feature showcase has three user-controlled slides: digital ink, scan enhancement, and document organization. Each action opens a real tool. It supports keyboard tab/arrow navigation, touch swipes, and reduced-motion preferences. It does not autoplay. The tablet and scan illustrations are native HTML/CSS/SVG graphics; feature text is accessible HTML.

## Generated stylus asset

Asset: `public/visuals/stylus.png` (1280 × 1280, alpha transparency, approximately 298 KB). Generated with the built-in imagegen tool. It is an unbranded stylus illustration, not an official Apple product photograph. It is lazy loaded to avoid delaying the application shell.

Final generation prompt:

> Use case: product-mockup. Asset type: transparent product illustration for a premium document workspace website feature banner. Primary request: a single beautiful unbranded white digital stylus, Apple-Pencil-like in quality, with a precise fine tip and a subtle flat magnetic edge. Show the entire stylus floating diagonally from lower left to upper right, a slight three-quarter angle, with realistic satin ceramic-white material, delicate cool-blue reflected light, soft grey edge definition, and a small precise tip. Alongside the tip is one small elegant cobalt-blue freehand loop, like the beginning of a handwritten annotation, with a very subtle mint secondary stroke. Clean studio product photography / sophisticated 3D product render. Centered isolated cutout composition, plenty of transparent breathing room, square canvas. No tablet, no hand, no logos, no brand name, no writing or interface, no background fill, no frame, no watermark. Preserve actual alpha transparency. This will sit beside real HTML feature copy about stylus support in a PDF editor; the illustration itself must contain no text.

Apple Pencil requires a compatible iPad. Pen pressure depends on the pointer events supplied by the device and browser. Physical Apple Pencil, camera, and installation behavior must be tested on actual hardware before making device-wide compatibility claims.

## 3.3 interaction review

Navigation to Reader preserves the application shell. Opening the full workspace is an explicit action. Brief hover feedback applies only to fine pointers; touch uses press feedback, large tap targets and safe-area spacing. Reduced-motion preferences suppress optional movement. The 35-tool illustrated tour is manual by default, pauses on hover/hidden tabs, and has a direct tool selector. Device artwork is original unbranded SVG, not an endorsement or a hardware compatibility claim.

The context guide discovers current page/dialog controls, groups repeated page thumbnails, and explains actions without activating them. Closing restores scroll position. The reader has a guide entry inside its dialog. Camera input can be chosen manually; camera tracks stop on switching/closing. Optional export support invitations wait until the download starts, appear once per session, and respect dismissal for seven days.

PDF zoom retains the last decoded bitmap while a sharper replacement is queued. Visible and nearby pages render on demand with a pixel cap. Pen movement paints a local canvas without a React render per sample. Freehand highlighting uses one translucent connected path, including in exported PDF ink annotations. Physical Pencil/palm/pinch behavior still requires device testing; simulated pointer tests do not prove Safari hardware compatibility.

References: [Apple motion guidance](https://developer.apple.com/design/human-interface-guidelines/motion), [service worker lifecycle](https://developer.chrome.com/docs/workbox/service-worker-lifecycle), [viewport segments](https://developer.chrome.com/blog/viewport-segments-api-shipped), [Google sign-in branding](https://developers.google.com/identity/branding-guidelines). Foldable support includes normal narrow/wide layouts plus progressive viewport-segment CSS where the browser implements it.
