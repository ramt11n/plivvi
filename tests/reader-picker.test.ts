// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import PDFReader from '../src/reader/PDFReader';

it('offers an unrestricted native file picker so iOS can select CBR archives', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        createElement(PDFReader, {
          workspace: 'picker-regression',
          onClose: vi.fn(),
          onSave: vi.fn(),
          onCloud: vi.fn(),
        }),
      ),
    );
    const files = host.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const documentPicker = [...files].find((input) => input.accept !== 'image/*');
    expect(documentPicker).toBeDefined();
    expect(documentPicker!.hasAttribute('accept')).toBe(false);
    expect(host.textContent).toContain('Open a PDF or CBR');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
