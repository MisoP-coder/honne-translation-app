import AsyncStorage from '@react-native-async-storage/async-storage';

import { comboForScore, isPossibleScore, pointsFor } from '../src/game/engine';
import {
  DUMMY_RANKING,
  MockRankingRepository,
  rankWithMe,
  SAMPLE_MY_PUBLIC_ID,
} from '../src/ranking/mockRanking';
import {
  EMPTY_HIGH_SCORE,
  loadHighScore,
  mergeHighScore,
  saveHighScore,
} from '../src/storage/highScore';

describe('rankWithMe', () => {
  it('記録がなければダミーデータだけを順位付けする', () => {
    const { entries, myRank } = rankWithMe(DUMMY_RANKING, null);
    expect(myRank).toBeNull();
    expect(entries).toHaveLength(DUMMY_RANKING.length);
    expect(entries.map((e) => e.rank)).toEqual(DUMMY_RANKING.map((_, i) => i + 1));
    expect(entries.some((e) => e.isMe)).toBe(false);
  });

  it('スコア0は載せない', () => {
    expect(rankWithMe(DUMMY_RANKING, { name: 'あなた', score: 0, combo: 0 }).myRank).toBeNull();
  });

  it('自分のハイスコアをスコア順の正しい位置に差し込む', () => {
    const { entries, myRank } = rankWithMe(DUMMY_RANKING, { name: 'あなた', score: 12000, combo: 40 });
    // 11730 の JustMeet_99（10位）より上
    expect(myRank).toBe(10);
    expect(entries[9]).toMatchObject({ isMe: true, name: 'あなた', rank: 10 });
    expect(entries[10]).toMatchObject({ id: 'd10', rank: 11 });
    expect(entries).toHaveLength(DUMMY_RANKING.length + 1);
  });

  it('1位も取れる', () => {
    expect(rankWithMe(DUMMY_RANKING, { name: 'あなた', score: 99999, combo: 300 }).myRank).toBe(1);
  });

  it('同点同連続なら同じ順位（自分は後ろに並ぶ）', () => {
    const d = DUMMY_RANKING[4];
    const { entries, myRank } = rankWithMe(DUMMY_RANKING, {
      name: 'あなた',
      score: d.score,
      combo: d.combo,
    });
    expect(myRank).toBe(5);
    expect(entries[4].id).toBe(d.id);
    expect(entries[5]).toMatchObject({ isMe: true, rank: 5 });
    expect(entries[6].rank).toBe(7);
  });
});

describe('MockRankingRepository（サンプル）', () => {
  const me = { playerId: 'p1', name: 'テスト', flag: '🇯🇵' };

  it('サンプルであることを示し、スコア降順・順位付きで返す', async () => {
    const repo = new MockRankingRepository();
    expect(repo.isSample).toBe(true);
    const top = await repo.fetchTop(5);
    expect(top).toHaveLength(5);
    expect(top.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(top.map((e) => e.score)).toEqual([...top.map((e) => e.score)].sort((a, b) => b - a));
  });

  it('登録した記録が順位付きで並ぶ', async () => {
    const repo = new MockRankingRepository();
    // 3 連続すべて JUST MEET = 300 + 310 + 320
    const r = await repo.submit({ ...me, score: 930, combo: 3 });
    expect(r).toEqual({ publicId: SAMPLE_MY_PUBLIC_ID, rank: 20 });
    const top = await repo.fetchTop(30);
    expect(top.find((e) => e.id === SAMPLE_MY_PUBLIC_ID)).toMatchObject({ name: 'テスト', score: 930, rank: 20 });
    expect(await repo.rankOf(930, 3)).toBe(20);
  });

  it('自己ベストより低い記録ではスコアは下がらず、名前だけ変わる', async () => {
    const repo = new MockRankingRepository();
    await repo.submit({ ...me, score: 930, combo: 3 });
    await repo.submit({ ...me, name: '改名', score: 300, combo: 1 });
    const mine = (await repo.fetchTop(30)).find((e) => e.id === SAMPLE_MY_PUBLIC_ID);
    expect(mine).toMatchObject({ name: '改名', score: 930, combo: 3 });
  });

  it('サーバーと同じく、ありえないスコアや長すぎる名前は登録できない', async () => {
    const repo = new MockRankingRepository();
    await expect(repo.submit({ ...me, score: 931, combo: 3 })).rejects.toMatchObject({ kind: 'invalid-score' });
    await expect(repo.submit({ ...me, name: 'あいうえおかきくけこさしす', score: 300, combo: 1 })).rejects.toMatchObject({
      kind: 'invalid-name',
    });
  });

  it('ダミーの待ち時間を再現できる', async () => {
    jest.useFakeTimers();
    const repo = new MockRankingRepository(DUMMY_RANKING, 500);
    let done = false;
    const p = repo.fetchTop(3).then(() => (done = true));
    await jest.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    jest.useRealTimers();
  });
});

describe('ありえるスコアか（サーバーと同じ式）', () => {
  it('ゲームのルールで出せるスコアだけ true', () => {
    expect(isPossibleScore(300, 1)).toBe(true); // JUST MEET 1 回
    expect(isPossibleScore(100, 1)).toBe(true); // GOOD 1 回
    expect(isPossibleScore(200, 1)).toBe(false);
    expect(isPossibleScore(930, 3)).toBe(true);
    expect(isPossibleScore(931, 3)).toBe(false);
    expect(isPossibleScore(330, 3)).toBe(true); // 全部 GOOD = 100 + 110 + 120
    expect(isPossibleScore(320, 3)).toBe(false);
    expect(isPossibleScore(0, 0)).toBe(false);
  });

  it('実際のゲームで出たスコアは必ず true になる', () => {
    // ランダムに JUST MEET / GOOD を選んで、エンジンと同じ点数計算で積み上げる
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let t = 0; t < 200; t++) {
      const n = 1 + Math.floor(rand() * 60);
      let score = 0;
      for (let k = 0; k < n; k++) score += pointsFor(rand() < 0.5 ? 'perfect' : 'good', k);
      expect(isPossibleScore(score, n)).toBe(true);
    }
  });

  it('スコアから連続数を求める（古い保存データ用）', () => {
    expect(comboForScore(930, 5)).toBe(3);
    expect(comboForScore(1234, 9)).toBe(0);
  });
});

describe('ハイスコア', () => {
  beforeEach(() => AsyncStorage.clear());

  it('スコアと最高連続数をそれぞれ更新する', () => {
    const r1 = mergeHighScore(EMPTY_HIGH_SCORE, { score: 500, combo: 3 });
    expect(r1).toEqual({ next: { bestScore: 500, bestCombo: 3, bestScoreCombo: 3 }, isNewRecord: true });
    // 連続数は伸びたがスコアは低い → 最高連続数だけ更新し、ハイスコアの連続数はそのまま
    const r2 = mergeHighScore(r1.next, { score: 400, combo: 5 });
    expect(r2).toEqual({ next: { bestScore: 500, bestCombo: 5, bestScoreCombo: 3 }, isNewRecord: false });
    expect(mergeHighScore(r2.next, { score: 500, combo: 1 }).isNewRecord).toBe(false);
  });

  it('端末に保存して読み出せる', async () => {
    await expect(loadHighScore()).resolves.toEqual(EMPTY_HIGH_SCORE);
    await saveHighScore({ bestScore: 1600, bestCombo: 9, bestScoreCombo: 5 });
    await expect(loadHighScore()).resolves.toEqual({ bestScore: 1600, bestCombo: 9, bestScoreCombo: 5 });
  });

  it('前のバージョンの保存データ（ハイスコアの連続数なし）は、スコアから連続数を求める', async () => {
    await AsyncStorage.setItem('caramel-just-meet/high-score/v1', JSON.stringify({ bestScore: 930, bestCombo: 6 }));
    await expect(loadHighScore()).resolves.toEqual({ bestScore: 930, bestCombo: 6, bestScoreCombo: 3 });
  });

  it('壊れたデータは無視する', async () => {
    await AsyncStorage.setItem('caramel-just-meet/high-score/v1', '{oops');
    await expect(loadHighScore()).resolves.toEqual(EMPTY_HIGH_SCORE);
  });
});
