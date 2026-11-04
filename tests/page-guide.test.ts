// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { guideControls, explainControl } from '../src/help/controlGuide';
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
it('explains the active dialog controls without leaking field values or background actions', () => {
  document.body.innerHTML =
    '<div id="root"><button>Account</button><section aria-modal="true"><button aria-label="Highlighter"></button><label>Document password<input type="password" value="never-read-this"></label><button>Download annotated PDF</button><button style="display:none">Hidden</button></section><div data-guide-ignore><button>Guide</button></div></div>';
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.style.display === 'none' ? [] : ([new DOMRect(0, 0, 40, 40)] as any);
  });
  const steps = guideControls();
  expect(steps.map((x) => x.name)).toEqual([
    'Highlighter',
    'Document password',
    'Download annotated PDF',
  ]);
  expect(
    JSON.stringify(steps.map(({ name, description }) => ({ name, description }))),
  ).not.toContain('never-read-this');
  expect(explainControl('Highlighter')).toContain('translucent stroke');
});
