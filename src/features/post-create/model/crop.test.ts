import { describe, expect, it } from 'vitest';
import { CENTER, cropRect, frameLayout, moveFocus } from './crop';

describe('cropRect', () => {
  it('横長の写真を 4:5 で切ると 高さいっぱいの縦長の矩形になり 比率がちょうど 0.8 になる', () => {
    const r = cropRect({ width: 800, height: 600 }, '4:5', CENTER);
    expect(r).toEqual({ x: 160, y: 0, width: 480, height: 600 });
    expect(r.width / r.height).toBe(0.8);
  });

  it('横長の写真を 1:1 で切ると 短い辺に合わせた正方形になる', () => {
    expect(cropRect({ width: 800, height: 600 }, '1:1', CENTER)).toEqual({
      x: 100,
      y: 0,
      width: 600,
      height: 600,
    });
  });

  it('縦長の写真を 4:5 で切ると 幅いっぱいで縦に余る', () => {
    expect(cropRect({ width: 400, height: 1000 }, '4:5', { x: 0.5, y: 0 })).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 500,
    });
    expect(cropRect({ width: 400, height: 1000 }, '4:5', { x: 0.5, y: 1 })).toEqual({
      x: 0,
      y: 500,
      width: 400,
      height: 500,
    });
  });

  it('位置の両端で矩形は写真の外に出ない', () => {
    const size = { width: 801, height: 601 };
    for (const focus of [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: -3, y: 9 },
    ]) {
      const r = cropRect(size, '1:1', focus);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(size.width);
      expect(r.y + r.height).toBeLessThanOrEqual(size.height);
    }
  });

  it('比率より小さい写真でも 写真の中に収まる 1 画素以上の矩形を返す', () => {
    const r = cropRect({ width: 3, height: 2 }, '4:5', CENTER);
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
    expect(r.width).toBeLessThanOrEqual(3);
    expect(r.height).toBeLessThanOrEqual(2);
  });
});

describe('frameLayout', () => {
  it('枠の幅から高さと 写真を枠いっぱいに敷いたときの余りを求める', () => {
    // 4:5 frame, 400 wide -> 500 tall; the 800x600 photo is scaled by 500/600 to cover it.
    const l = frameLayout({ width: 800, height: 600 }, 400, '4:5');
    expect(l.frameHeight).toBe(500);
    expect(l.scale).toBeCloseTo(500 / 600);
    expect(l.overflowX).toBeCloseTo(800 * (500 / 600) - 400);
    expect(l.overflowY).toBeCloseTo(0);
  });
});

describe('moveFocus', () => {
  it('表示上の移動量を 余りに対する割合に直して動かし 0 から 1 に収める', () => {
    expect(moveFocus({ x: 0.5, y: 0.5 }, { x: 10, y: 0 }, { x: 100, y: 0 })).toEqual({
      x: 0.6,
      y: 0.5,
    });
    expect(moveFocus({ x: 0.95, y: 0.5 }, { x: 10, y: 0 }, { x: 100, y: 0 }).x).toBe(1);
    expect(moveFocus({ x: 0.05, y: 0.5 }, { x: -10, y: 0 }, { x: 100, y: 0 }).x).toBe(0);
  });

  it('余りが無い向きには動かない', () => {
    expect(moveFocus({ x: 0.5, y: 0.5 }, { x: 10, y: 10 }, { x: 0, y: 0 })).toEqual({
      x: 0.5,
      y: 0.5,
    });
  });
});
