export function controlName(element: HTMLElement) {
  if (element.matches('.reader-page-list button')) return 'Page thumbnails';
  const label =
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.getAttribute('placeholder');
  if (label) return label;
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const text = element.labels?.[0]?.textContent?.trim();
    if (text) return text.replace(/\s+/g, ' ').slice(0, 100);
  }
  return element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100) || 'Document control';
}
const explanations: [RegExp, string][] = [
  [
    /guide to every|guide to this|show me around/i,
    'Open a guided tour of the visible controls in this workspace. Jump to any control without running its action.',
  ],
  [
    /copy.*address/i,
    'Copy the receiving address for the selected asset and exact network. Check the asset and network in your sending wallet before sending.',
  ],
  [
    /open.*wallet|trust wallet/i,
    'Open Trust Wallet with this exact receiving asset, network and address. Review the details there; Plivvi never initiates a transfer.',
  ],
  [
    /find.*token|usdt|all crypto/i,
    'Filter supported donation routes. Only networks explicitly supplied by the project owner are listed. All matching choices appear below.',
  ],
  [
    /paper style|starting pages|cover color|notebook name/i,
    'Choose the appearance, name and initial page count of your local notebook. You can change its cover and add pages later.',
  ],
  [
    /featured tool|play tool tour|pause tool tour|previous feature|next feature/i,
    'Browse the tool illustrations. Select any of the 35 tools directly; the tour advances automatically only after you choose Play.',
  ],
  [
    /report.*bug|private report|email plivvi|review on github/i,
    'Choose a private Google Forms report, an email, or a public GitHub issue. No document is attached. Review your message before sending.',
  ],

  [
    /highlighter/i,
    'Drag a smooth translucent stroke across a passage with your pen or mouse. Pick a bright color and change its width. For precise word highlights, select text first.',
  ],
  [
    /pen style/i,
    'Fountain responds to pressure, Ballpoint keeps a steady width, and Pencil also uses tilt where your browser supplies it.',
  ],
  [
    /draw with finger/i,
    'Leave this off when using a stylus: your pen writes and two fingers navigate. Turn it on only if you want to draw with a finger.',
  ],
  [
    /color|ink/i,
    'Choose this ink color. The custom color control opens your device’s full color picker. A selected annotation can be recolored too.',
  ],
  [
    /annotation size|stroke|text size/i,
    'Adjust the width of new strokes or the size of typed text. If a mark is selected, this changes that mark.',
  ],
  [
    /select text/i,
    'Use ordinary text selection to copy words or highlight a passage. You can also select and move your own annotations.',
  ],
  [
    /erase/i,
    'Drag over your own handwriting and annotations to remove them. This does not erase original PDF text. Use Redact for permanent removal of sensitive content.',
  ],
  [
    /zoom|fit page|fit width/i,
    'Change how large the page appears. The existing page stays visible while a sharper bitmap is prepared. In writing mode, two fingers can move and zoom together.',
  ],
  [
    /page layout/i,
    'Continuous lets you scroll between pages. Single page keeps one page in the workspace at a time.',
  ],
  [
    /thumbnail|^page \d|go to page|next page|previous page/i,
    'Jump to a document page. The thumbnails show previews as they load; use the page number to reach a distant page quickly.',
  ],
  [
    /download|export|print/i,
    'Create a new output copy. Document processing happens on your device; your original stays unchanged. Check the export format before saving.',
  ],
  [
    /save.*workspace|save copy/i,
    'Keep a copy in this browser workspace. This is local storage, not automatic cross-device cloud sync. Download an important backup too.',
  ],
  [
    /cloud/i,
    'Import or save selected files through your own cloud account or the device Files picker. Plivvi does not host your documents.',
  ],
  [
    /choose files|add files|import|open.*pdf|upload/i,
    'Choose documents from your device or an installed Files provider. The file is read locally, rather than uploaded to a Plivvi document server.',
  ],
  [
    /camera|capture|scan/i,
    'Choose a camera, position your page, and capture it. You can crop, straighten and enhance the captured photo before making a document.',
  ],
  [
    /source.*password|password/i,
    'Enter a password only when your PDF requires one. Passwords are used by the local document engine and are not included in bug reports.',
  ],
  [
    /page ranges|pages to remove/i,
    'Enter page numbers such as 1-3, 5, 7-9. Check the tool’s label: Remove deletes those pages; Extract keeps them.',
  ],
  [
    /output format|export format/i,
    'Choose the file type for the new copy. Available formats depend on the current tool.',
  ],
  [
    /page width|resolution|compression/i,
    'Balance output clarity against file size and processing time. Higher resolution uses more memory, especially on phones.',
  ],
  [
    /language/i,
    'Choose the language of the printed words for OCR. The recognition model downloads to this device on first use.',
  ],
  [
    /new.*notebook|create notebook|starting pages|paper style|cover color/i,
    'Create a local notebook with a name, paper pattern, cover and starting page count. You can add or rearrange pages later.',
  ],
  [
    /duplicate|move page|remove.*page|add page/i,
    'Change notebook page order or page count. Download a backup before making large structural changes.',
  ],
  [
    /undo|redo/i,
    'Step backward or forward through your annotation edits. Original PDF content is unchanged.',
  ],
  [
    /support|donat|keep it free|help.*improve/i,
    'Optional support helps improve Plivvi and test more devices. It never unlocks or limits a document feature.',
  ],
  [
    /google|sign in|account/i,
    'Use optional accounts to separate local workspaces. Account sign-in requires the authentication provider to be reachable.',
  ],
  [
    /appearance|light|dark|system/i,
    'Choose a comfortable appearance. System follows your device’s current light or dark setting.',
  ],
  [
    /check.*update|reload.*update/i,
    'Check the Plivvi server for a newer version. Save or download work before choosing to reload. Checking alone does not reload the page.',
  ],
  [
    /search|find/i,
    'Find the matching tool, notebook, saved file or passage in the current workspace.',
  ],
  [
    /close|cancel|back/i,
    'Return to the previous workspace without running this action. Save or download a copy of important edits.',
  ],
  [/bookmark/i, 'Mark this page so you can return to it from your local reading workspace.'],
  [
    /flatten/i,
    'Bake your annotations into the exported PDF. Leave off when you want annotations to remain separately editable in compatible PDF apps.',
  ],
  [
    /sticky note/i,
    'Place a comment on the page. Select it afterwards to edit its text, color or position.',
  ],
  [
    /type text/i,
    'Place a text box on the page, then edit its words and size. Multilingual text uses local shaping and fonts.',
  ],
  [/rectangle/i, 'Draw an outlined shape on the page. This is an annotation, not redaction.'],
  [/workbench|home/i, 'Return to the home workspace, featured tools and recent documents.'],
  [
    /reader/i,
    'Open the reader’s normal page. Choose a file or resume the last file explicitly; navigation does not automatically take over the screen.',
  ],
  [/tools/i, 'Browse or search all document tools. Every tool has a direct link and a guide.'],
  [
    /files/i,
    'Manage outputs saved in this browser. These files use your device storage, not Plivvi server storage.',
  ],
  [
    /layouts|use layout/i,
    'Start from this page layout. Copy layouts arrange real scans you supply; they are not official credentials.',
  ],
  [/new blank/i, 'Create a fresh document, then type, write, draw or insert a photo.'],
];
export function explainControl(name: string) {
  return (
    explanations.find(([pattern]) => pattern.test(name))?.[1] ??
    `Use “${name}” in this workspace. Review the nearby label and settings before applying it; the guide never runs an action for you.`
  );
}
export function guideControls() {
  const dialogs = [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter(
    (e) => !e.closest('[data-guide-ignore]'),
  );
  const scope = dialogs.at(-1) ?? document.querySelector<HTMLElement>('#root')!;
  const seen = new Set<string>();
  return [
    ...scope.querySelectorAll<HTMLElement>(
      'button,a[href],input:not([type="hidden"]),select,textarea,summary,[role="button"]',
    ),
  ]
    .filter((e) => {
      if (
        e.closest('[data-guide-ignore],.reader-accessible-text') ||
        e.getAttribute('aria-hidden') === 'true' ||
        !e.getClientRects().length
      )
        return false;
      const style = getComputedStyle(e);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      const name = controlName(e);
      const key = /thumbnail|^\d+ Page \d|^Page \d/i.test(name) ? 'Page thumbnails' : name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((element) => ({
      element,
      name: controlName(element),
      description: explainControl(controlName(element)),
    }));
}
