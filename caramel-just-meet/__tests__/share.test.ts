import { Linking } from 'react-native';

import { TITLES, titleFor } from '../src/game/titles';
import { buildShareText, buildXShareUrl, shareToX } from '../src/share/xShare';

describe('称号', () => {
  it('連続数に応じた称号を返す', () => {
    expect(titleFor(0)).toBe('カラメルを床に捧げし者');
    expect(titleFor(1)).toBe('プリン見習い');
    expect(titleFor(4)).toBe('茶色い雫の運び屋');
    expect(titleFor(5)).toBe('カラメル職人（自称）');
    expect(titleFor(100)).toBe('宇宙カラメル大統領');
    expect(titleFor(99999)).toBe('宇宙カラメル大統領');
    expect(titleFor(-3)).toBe('カラメルを床に捧げし者');
  });

  it('称号表は連続数の多い順に並んでいる', () => {
    const mins = TITLES.map((t) => t.min);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
    expect(mins[mins.length - 1]).toBe(0);
  });
});

describe('X シェア', () => {
  it('定型文を作る', () => {
    expect(buildShareText(12)).toBe(
      '【極限！カラメル・ジャスト・ミート】プリンの頂点にカラメルを12連続で乗せた！ 称号：ぷるぷるハンター #カラメルジャストミート',
    );
  });

  it('X の投稿画面の URL に本文をエンコードして入れる', () => {
    const text = buildShareText(3);
    const url = buildXShareUrl(text);
    expect(url.startsWith('https://x.com/intent/tweet?text=')).toBe(true);
    expect(url).not.toContain('#');
    expect(url).not.toContain(' ');
    expect(decodeURIComponent(url.split('text=')[1])).toBe(text);
  });

  it('Linking.openURL で X を開く', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await expect(shareToX(7)).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith(buildXShareUrl(buildShareText(7)));
    open.mockRestore();
  });

  it('開けなかったときは false を返して落ちない', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    await expect(shareToX(7)).resolves.toBe(false);
    open.mockRestore();
  });
});
