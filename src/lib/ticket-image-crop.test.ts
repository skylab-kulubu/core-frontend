import {
  BAND_ASPECT,
  centreOf,
  cropAt,
  cropFits,
  fullCrop,
  imagePlacement,
  maxZoom,
  moveCrop,
  zoomOf,
} from '@/lib/ticket-image-crop';

describe('ticket image crop', () => {
  it('takes the widest band-shaped strip, centred', () => {
    const tall = fullCrop(1000, 1500);
    expect(tall.w).toBe(1);
    expect((tall.w * 1000) / (tall.h * 1500)).toBeCloseTo(BAND_ASPECT, 6);
    expect(tall.y).toBeCloseTo((1 - tall.h) / 2, 6);
    const wide = fullCrop(4000, 200);
    expect(wide.h).toBe(1);
    expect(wide.x).toBeCloseTo((1 - wide.w) / 2, 6);
  });

  it('zooms about the centre and stays inside the image', () => {
    const crop = cropAt(2400, 3600, 2, 0.5, 0.5);
    expect(zoomOf(crop, 2400, 3600)).toBeCloseTo(2, 6);
    expect(centreOf(crop).cx).toBeCloseTo(0.5, 6);
    const corner = cropAt(2400, 3600, 4, 0, 0);
    expect(corner.x).toBe(0);
    expect(corner.y).toBe(0);
    expect(cropFits(corner, 2400, 3600)).toBe(true);
    expect(cropFits(corner, 3600, 2400)).toBe(false);
  });

  it('zooms no further than a 600-pixel, 1 % region', () => {
    // 2400 px wide: a region 600 px wide is a quarter of it
    expect(maxZoom(2400, 3600)).toBeCloseTo(4, 6);
    expect(cropAt(2400, 3600, 8, 0.5, 0.5).w * 2400).toBeCloseTo(600, 6);
    expect(maxZoom(9000, 9000)).toBe(8);
    // A banner whose strip is already thin keeps its height at 1 % or more
    expect(maxZoom(100000, 200) * 0.01).toBeLessThanOrEqual(1);
    expect(fullCrop(100000, 200).h / maxZoom(100000, 200)).toBeGreaterThanOrEqual(0.01);
    // Narrower than 600 px: no zoom
    expect(maxZoom(500, 800)).toBe(1);
  });

  it('moves within the image', () => {
    const crop = cropAt(2400, 3600, 2, 0.5, 0.5);
    const moved = moveCrop(crop, 5, -5);
    expect(moved.x).toBeCloseTo(1 - crop.w, 6);
    expect(moved.y).toBe(0);
  });

  it('places the image so the frame shows the crop', () => {
    expect(imagePlacement({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 })).toEqual({
      width: '200%',
      height: '400%',
      left: '-50%',
      top: '-200%',
    });
  });
});
