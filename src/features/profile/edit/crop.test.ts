import { describe, expect, it } from 'vitest';
import { centerSquare } from './crop';

describe('centerSquare', () => {
  it('横長の写真は 高さを辺にして 左右の中央を切り抜く', () => {
    expect(centerSquare(800, 600)).toEqual({ x: 100, y: 0, width: 600, height: 600 });
  });

  it('縦長の写真は 幅を辺にして 上下の中央を切り抜く', () => {
    expect(centerSquare(600, 800)).toEqual({ x: 0, y: 100, width: 600, height: 600 });
  });

  it('正方形の写真は そのまま全体', () => {
    expect(centerSquare(500, 500)).toEqual({ x: 0, y: 0, width: 500, height: 500 });
  });

  it('余りが奇数のときは 切り捨てた位置から始める', () => {
    expect(centerSquare(601, 600)).toEqual({ x: 0, y: 0, width: 600, height: 600 });
  });
});
