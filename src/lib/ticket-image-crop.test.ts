import {
  BAND_ASPECT,
  centreOf,
  cropAt,
  cropFits,
  fullCrop,
  imagePlacement,
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
    const crop = cropAt(1000, 1500, 2, 0.5, 0.5);
    expect(zoomOf(crop, 1000, 1500)).toBeCloseTo(2, 6);
    expect(centreOf(crop).cx).toBeCloseTo(0.5, 6);
    const corner = cropAt(1000, 1500, 4, 0, 0);
    expect(corner.x).toBe(0);
    expect(corner.y).toBe(0);
    expect(cropFits(corner, 1000, 1500)).toBe(true);
    expect(cropFits(corner, 1500, 1000)).toBe(false);
  });

  it('moves within the image', () => {
    const crop = cropAt(1000, 1500, 2, 0.5, 0.5);
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
