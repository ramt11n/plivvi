import { describe, expect, it } from 'vitest';
import { showcaseSlides } from '../src/components/FeatureShowcase';

describe('featured showcase', () => {
  it('advertises five distinct workflows on five different device types', () => {
    expect(showcaseSlides).toHaveLength(5);
    expect(new Set(showcaseSlides.map((slide) => slide.tool)).size).toBe(5);
    expect(new Set(showcaseSlides.map((slide) => slide.device)).size).toBe(5);
    expect(new Set(showcaseSlides.map((slide) => slide.asset)).size).toBe(5);
    expect(showcaseSlides.find((slide) => slide.device.includes('foldable'))?.label).toBe('Read');
    expect(showcaseSlides.find((slide) => slide.device.includes('tablet'))?.label).toBe(
      'Notebooks',
    );
  });
});
