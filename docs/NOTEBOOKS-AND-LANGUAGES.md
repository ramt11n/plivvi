# Notebooks and multilingual documents

Plivvi (PLIV-ee) is an invented brand name. The cobalt, mint, Sora headings, Manrope interface text, folded-page logo, and original stylus illustration form its visual identity.

Notebooks are local objects scoped by Firebase UID, or guest. They keep PDF page sources and editable annotation marks separately. Ink autosave writes only the active notebook's ink; page bytes are saved when the source changes. Closing a notebook flushes its current state before returning to the shelf. This is local persistence, not cloud sync or an automatic backup. Export a PDF through Files for safekeeping.

The editor supports fountain, even-width ballpoint, and tilt-aware pencil styles, pressure, coalesced pointer samples where available, pen-first palm filtering, optional finger ink, finger navigation/pinch, undo/redo, photos, text, highlights, and notes. Native Apple Pencil squeeze, double-tap, and haptics are not available through this web implementation. Physical iPad/Pencil behavior needs hardware testing.

Text conversion uses MuPDF's HTML layout and font fallback to shape joined scripts and retain Unicode. Font selection uses Unicode script properties; paragraph direction uses the first strong letter. Fonts are served by this application, never by a document-text query to a font service. They load on demand and can be cached offline after use. Noto OFL licenses are distributed alongside every font. CJK fallback is built into MuPDF. Arabic/Persian, Hebrew, Devanagari, Bengali, Tamil, Telugu, Gujarati, Gurmukhi, Kannada, Malayalam, Thai, extended Latin, Chinese, Japanese, and Korean samples have render/extraction checks. This is a tested script set, not a claim that every historic script or emoji is covered.

Office conversion creates a text reading copy; original design, charts, and complex table formatting are not reproduced. PDF-to-Word and spreadsheet exports retain Unicode and apply RTL paragraph/sheet direction where appropriate. PDF rendering and image conversion preserve embedded fonts. OCR currently uses bundled English, Persian, and Arabic models; OCR is separate from text-based conversion.

Tests cover visible glyphs, extraction, a Persian FreeText annotation appearance, five paper styles, duplication/reordering, tilt behavior, account isolation, draft recovery, and deletion of removed notebook drafts. Check final public user flows before claiming deployed authentication or cloud access works.
