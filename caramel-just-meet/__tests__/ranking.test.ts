import AsyncStorage from '@react-native-async-storage/async-storage';

import { DUMMY_RANKING, MockRankingRepository, rankWithMe } from '../src/ranking/mockRanking';
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

describe('MockRankingRepository', () => {
  it('スコア降順で上位だけを返す', async () => {
    const repo = new MockRankingRepository();
    const top = await repo.fetchTop(5);
    expect(top).toHaveLength(5);
    expect(top.map((e) => e.score)).toEqual([...top.map((e) => e.score)].sort((a, b) => b - a));
    await expect(repo.submit({ name: 'あなた', score: 100, combo: 1 })).resolves.toBeUndefined();
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

describe('ハイスコア', () => {
  beforeEach(() => AsyncStorage.clear());

  it('スコアと最高連続数をそれぞれ更新する', () => {
    const r1 = mergeHighScore(EMPTY_HIGH_SCORE, { score: 500, combo: 3 });
    expect(r1).toEqual({ next: { bestScore: 500, bestCombo: 3 }, isNewRecord: true });
    const r2 = mergeHighScore(r1.next, { score: 400, combo: 5 });
    expect(r2).toEqual({ next: { bestScore: 500, bestCombo: 5 }, isNewRecord: false });
    expect(mergeHighScore(r2.next, { score: 500, combo: 1 }).isNewRecord).toBe(false);
  });

  it('端末に保存して読み出せる', async () => {
    await expect(loadHighScore()).resolves.toEqual(EMPTY_HIGH_SCORE);
    await saveHighScore({ bestScore: 1234, bestCombo: 9 });
    await expect(loadHighScore()).resolves.toEqual({ bestScore: 1234, bestCombo: 9 });
  });

  it('壊れたデータは無視する', async () => {
    await AsyncStorage.setItem('caramel-just-meet/high-score/v1', '{oops');
    await expect(loadHighScore()).resolves.toEqual(EMPTY_HIGH_SCORE);
  });
});
