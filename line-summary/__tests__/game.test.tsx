import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';

import App from '../App';
import { cutInOffset, RAGE_FLASH_PERIOD, rageFlashOpacity } from '../src/components/RageOverlay';
import {
  BASE_POINTS,
  BubbleType,
  CLEAR_BONUS,
  CLEAR_BONUS_PER_LIFE,
  clockLabel,
  conclusionOf,
  createLineConfig,
  createLineGame,
  DAY_SECONDS,
  FAKE_DODGE_POINTS,
  type FallingItem,
  FEVER_PER_CATCH,
  FEVER_SCORE_MULTIPLIER,
  FEVER_SECONDS,
  GOBAKU_POINTS,
  GOLDEN_POINTS,
  hasDodgeGap,
  type ItemKind,
  type LineState,
  MAX_LIVES,
  maxBlockWidth,
  measureItem,
  MOOD_FAKE,
  MOOD_NONE,
  MOOD_OVERLOOK,
  MOOD_PER_CATCH,
  RAGE_FIRST_PHONE,
  RAGE_SECONDS,
  RAGE_SPEED_MULTIPLIER,
  RARE_FROM,
  readMultiplier,
  splitConclusion,
  step,
  tapAt,
} from '../src/game/engine';
import {
  BOSS_TEXTS,
  BOSS_WORDS,
  CONCLUSION_WORDS,
  FAKE_TEXTS,
  GOBAKU_TEXTS,
  GUCHI_WORDS,
  OJISAN_TEXTS,
  RAGE_BLOCK_TEXT,
  REAL_TEXTS,
} from '../src/game/texts';
import { LineGameScreen, soundsFor } from '../src/screens/LineGameScreen';
import { shareText, shareUrl } from '../src/share';
import { SoundProvider } from '../src/shared/audio/SoundContext';
import { type PlayerLike, SoundManager } from '../src/shared/audio/SoundManager';
import { catchSounds, SOUND_SOURCES, type SoundName } from '../src/shared/audio/sounds';

const config = createLineConfig(390, 600);
const EMOJI = /\p{Extended_Pictographic}/u;

interface Spec {
  kind: ItemKind;
  bubble?: BubbleType;
  x?: number;
  y: number;
  vy?: number;
}

function textFor(s: Spec): string {
  if (s.kind === 'word') return '明日休み';
  if (s.kind === 'guchi') return '説教';
  if (s.kind === 'phone') return RAGE_BLOCK_TEXT;
  if (s.bubble === 'boss') return BOSS_TEXTS[0];
  if (s.bubble === 'gobaku') return GOBAKU_TEXTS[0];
  return s.bubble === 'real' ? REAL_TEXTS[0] : s.bubble === 'fake' ? FAKE_TEXTS[0] : OJISAN_TEXTS[0];
}

/** テスト用：降ってくる途中のものを好きな場所に置いた状態を作る（勝手に降ってこないようにする） */
function stateWith(specs: Spec[], patch: Partial<LineState> = {}): LineState {
  const base = createLineGame(1, config);
  const items: FallingItem[] = specs.map((s, i) => {
    const text = textFor(s);
    const { w, h } = measureItem(s.kind, text, config.width, config.basketWidth);
    return {
      id: 100 + i,
      kind: s.kind,
      bubble: s.kind === 'bubble' ? (s.bubble ?? 'none') : undefined,
      text,
      x: s.x ?? config.width / 2,
      y: s.y,
      w,
      h,
      vy: s.vy ?? 100,
      born: 0,
    };
  });
  return { ...base, items, spawnTimer: 999, phoneTimer: 999, time: 20, ...patch };
}

/** 画面の下に消える直前の y */
function justBelow(s: Spec): number {
  const { h } = measureItem(s.kind, textFor(s), config.width, config.basketWidth);
  return config.height + h / 2 - 0.5;
}

describe('テキストのデータ', () => {
  it('絵文字まみれのおじさん構文が 20 パターン以上ある', () => {
    expect(OJISAN_TEXTS.length).toBeGreaterThanOrEqual(20);
    expect(OJISAN_TEXTS.filter((t) => EMOJI.test(t)).length).toBeGreaterThanOrEqual(20);
  });

  it('本物とひっかけの吹き出しには、結論の単語がちょうど 1 つ入っている', () => {
    for (const t of [...REAL_TEXTS, ...FAKE_TEXTS]) {
      const parts = splitConclusion(t).filter((p) => p.conclusion);
      expect(parts).toHaveLength(1);
      expect(CONCLUSION_WORDS).toContain(parts[0].text as (typeof CONCLUSION_WORDS)[number]);
    }
    expect(REAL_TEXTS.length).toBeGreaterThanOrEqual(12);
    expect(FAKE_TEXTS.length).toBeGreaterThanOrEqual(10);
  });

  it('結論なしの吹き出しと愚痴には、結論の単語が入っていない', () => {
    for (const t of [...OJISAN_TEXTS, ...GUCHI_WORDS, ...GOBAKU_TEXTS]) {
      expect(t).not.toMatch(/[{}]/);
      for (const w of CONCLUSION_WORDS) expect(t).not.toContain(w);
    }
  });

  it('社長からの LINE には、金の結論がちょうど 1 つ入っている', () => {
    for (const t of BOSS_TEXTS) {
      const parts = splitConclusion(t).filter((p) => p.conclusion);
      expect(parts).toHaveLength(1);
      expect(BOSS_WORDS).toContain(parts[0].text as (typeof BOSS_WORDS)[number]);
    }
  });

  it('結論の目印を外して、ふつうの文と結論に分けられる', () => {
    expect(splitConclusion('あ{明日休み}い')).toEqual([
      { text: 'あ', conclusion: false },
      { text: '明日休み', conclusion: true },
      { text: 'い', conclusion: false },
    ]);
    expect(conclusionOf(OJISAN_TEXTS[0])).toBeNull();
  });
});

describe('タップで要約', () => {
  it('本物の吹き出しを要約すると、結論の単語が飛び出す', () => {
    const s = tapAt(stateWith([{ kind: 'bubble', bubble: 'real', y: 200 }]), config, config.width / 2, 200);
    expect(s.items.some((it) => it.kind === 'bubble')).toBe(false);
    const word = s.items.find((it) => it.kind === 'word');
    expect(word?.text).toBe(conclusionOf(REAL_TEXTS[0]));
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'summarize', result: 'real' }));
    expect(s.lives).toBe(MAX_LIVES);
  });

  it('ひっかけを要約するとライフが減り、イライラ度も上がる', () => {
    const s = tapAt(stateWith([{ kind: 'bubble', bubble: 'fake', y: 200 }], { combo: 4 }), config, config.width / 2, 200);
    expect(s.lives).toBe(MAX_LIVES - 1);
    expect(s.combo).toBe(0);
    expect(s.mood).toBe(MOOD_FAKE);
    expect(s.fakesTaken).toBe(1);
    expect(s.items.some((it) => it.kind === 'word')).toBe(false);
  });

  it('結論のない吹き出しを要約すると、イライラ度が上がるだけ', () => {
    const s = tapAt(stateWith([{ kind: 'bubble', bubble: 'none', y: 200 }]), config, config.width / 2, 200);
    expect(s.lives).toBe(MAX_LIVES);
    expect(s.mood).toBe(MOOD_NONE);
    expect(s.items).toHaveLength(0);
  });

  it('何もないところや愚痴をタップしても何も起きない', () => {
    const before = stateWith([{ kind: 'guchi', y: 200 }]);
    expect(tapAt(before, config, config.width / 2, 200)).toBe(before);
    expect(tapAt(before, config, 5, 500)).toBe(before);
  });

  it('重なっていたら手前（あとから来たほう）を要約する', () => {
    const s = tapAt(
      stateWith([
        { kind: 'bubble', bubble: 'none', y: 200 },
        { kind: 'bubble', bubble: 'real', y: 210 },
      ]),
      config,
      config.width / 2,
      205,
    );
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'summarize', result: 'real' }));
  });
});

describe('落ちてくるものとゲージ', () => {
  it('飛び出した結論をキャッチするとスコアが入り、イライラ度が 10 下がる', () => {
    const s = step(stateWith([{ kind: 'word', y: config.basketTop }], { mood: 30 }), config, 1 / 60);
    expect(s.score).toBe(100);
    expect(s.combo).toBe(1);
    expect(s.caught).toBe(1);
    expect(s.mood).toBe(30 - MOOD_PER_CATCH);
  });

  it('吹き出しや愚痴がカゴに当たるとライフが減り、0 で残業確定', () => {
    let s = step(stateWith([{ kind: 'bubble', y: config.basketTop }]), config, 1 / 60);
    expect(s.lives).toBe(MAX_LIVES - 1);
    s = step(stateWith([{ kind: 'guchi', y: config.basketTop }], { lives: 1 }), config, 1 / 60);
    expect(s.status).toBe('over');
    expect(s.overReason).toBe('lives');
  });

  it('本物の結論を見逃すとイライラ度が上がる', () => {
    const spec: Spec = { kind: 'bubble', bubble: 'real', x: 70, y: 0 };
    const s = step(stateWith([{ ...spec, y: justBelow(spec) }], { basketX: config.width - 80 }), config, 1 / 60);
    expect(s.mood).toBe(MOOD_OVERLOOK);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'overlook' }));
  });

  it('ひっかけと結論なしは、見送っても怒られない（ひっかけは見抜いた点が入る）', () => {
    const fake: Spec = { kind: 'bubble', bubble: 'fake', x: 70, y: 0 };
    const none: Spec = { kind: 'bubble', bubble: 'none', x: 70, y: 0 };
    let s = step(stateWith([{ ...fake, y: justBelow(fake) }], { basketX: config.width - 80 }), config, 1 / 60);
    expect(s.mood).toBe(0);
    expect(s.score).toBe(FAKE_DODGE_POINTS);
    expect(s.fakesDodged).toBe(1);
    s = step(stateWith([{ ...none, y: justBelow(none) }], { basketX: config.width - 80 }), config, 1 / 60);
    expect(s.mood).toBe(0);
  });

  it('イライラ度が 100% になると上司がブチギレる', () => {
    const spec: Spec = { kind: 'bubble', bubble: 'real', x: 70, y: 0 };
    const s = step(stateWith([{ ...spec, y: justBelow(spec) }], { mood: 90, basketX: config.width - 80 }), config, 1 / 60);
    expect(s.mood).toBe(100);
    expect(s.rage).toBe(RAGE_SECONDS);
    expect(s.events).toContainEqual({ type: 'rage-start' });
  });

  it('ブチギレ中はおじさん構文が 2 倍の速さで落ちる（結論の単語はそのまま）', () => {
    const items: Spec[] = [
      { kind: 'bubble', x: 80, y: 100 },
      { kind: 'word', x: 330, y: 100, vy: 100 },
    ];
    const normal = step(stateWith(items, { basketX: 200 }), config, 0.1);
    const raging = step(stateWith(items, { basketX: 200, rage: 5, mood: 100 }), config, 0.1);
    expect(raging.items[0].y - 100).toBeCloseTo((normal.items[0].y - 100) * RAGE_SPEED_MULTIPLIER);
    expect(raging.items[1].y - 100).toBeCloseTo(10);
  });

  it('ブチギレ中は「今すぐ電話しろ‼️😡🔥」が降ってきて、当たると即残業確定', () => {
    let s = stateWith([], { rage: RAGE_SECONDS, mood: 100, phoneTimer: RAGE_FIRST_PHONE });
    for (let i = 0; i < 100 && !s.items.some((it) => it.kind === 'phone'); i++) s = step(s, config, 1 / 30);
    expect(s.items.find((it) => it.kind === 'phone')?.text).toBe(RAGE_BLOCK_TEXT);
    const hit = step(stateWith([{ kind: 'phone', y: config.basketTop }], { rage: 5, mood: 100 }), config, 1 / 60);
    expect(hit.status).toBe('over');
    expect(hit.overReason).toBe('phone');
  });

  it('10 秒耐え抜くとゲージが 0% に戻る', () => {
    let s = stateWith([], { rage: RAGE_SECONDS, mood: 100, basketX: config.width - 80, time: 5 });
    const events: string[] = [];
    for (let t = 0; t < RAGE_SECONDS + 0.5; t += 1 / 30) {
      s = step({ ...s, spawnTimer: 999, phoneTimer: 999 }, config, 1 / 30);
      events.push(...s.events.map((e) => e.type));
    }
    expect(events).toContain('rage-end');
    expect(s.mood).toBe(0);
  });
});

describe('1 日の業務（9:00〜18:00）', () => {
  it('時計は 9:00 に始まり、18:00 で終わる', () => {
    expect(clockLabel(0)).toBe('9:00');
    expect(clockLabel(DAY_SECONDS / 2)).toBe('13:30');
    expect(clockLabel(DAY_SECONDS)).toBe('18:00');
    expect(clockLabel(DAY_SECONDS + 10)).toBe('18:00');
  });

  it('18:00 まで耐えると定時退社。残りライフに応じたボーナスが入る', () => {
    const s = step(stateWith([], { time: DAY_SECONDS - 0.01, lives: 2, score: 300 }), config, 1 / 60);
    expect(s.status).toBe('clear');
    expect(s.clearBonus).toBe(CLEAR_BONUS + CLEAR_BONUS_PER_LIFE * 2);
    expect(s.score).toBe(300 + s.clearBonus);
    expect(s.events).toContainEqual({ type: 'clear' });
  });

  it('何もしないと、定時までに力尽きる（放っておいてもクリアできない）', () => {
    let s = createLineGame(7, config);
    for (let f = 0; f < 60 * (DAY_SECONDS + 1) && s.status === 'playing'; f++) s = step(s, config, 1 / 60);
    expect(s.status).toBe('over');
  });

  it('最初の数秒はひっかけが出ない', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let s = { ...createLineGame(seed, config), basketX: -1000, lives: 1e9 };
      for (let f = 0; f < 60 * 7; f++) {
        s = step({ ...s, lives: 1e9 }, config, 1 / 60);
        expect(s.items.some((it) => it.bubble === 'fake')).toBe(false);
      }
    }
  });

  it('同じシードなら同じ展開になる', () => {
    const run = () => {
      let s = createLineGame(42, config);
      for (let i = 0; i < 600; i++) s = step(s, config, 1 / 60);
      return s.items.map((it) => `${it.kind}:${it.text}:${it.x.toFixed(1)}`);
    };
    expect(run()).toEqual(run());
    expect(run().length).toBeGreaterThan(0);
  });
});

describe('即読ボーナス', () => {
  it('上のほうで要約するほど倍率が高い（×3／×2／×1）', () => {
    expect(readMultiplier(config.basketTop * 0.1, config)).toBe(3);
    expect(readMultiplier(config.basketTop * 0.5, config)).toBe(2);
    expect(readMultiplier(config.basketTop * 0.8, config)).toBe(1);
  });

  it('上のほうで要約した結論は、キャッチしたときの点が 3 倍', () => {
    const y = config.basketTop * 0.15;
    let s = tapAt(stateWith([{ kind: 'bubble', bubble: 'real', y }]), config, config.width / 2, y);
    const word = s.items.find((it) => it.kind === 'word');
    expect(word?.mult).toBe(3);
    expect(s.quickReads).toBe(1);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'quick-read', mult: 3 }));
    s = step({ ...s, items: s.items.map((it) => ({ ...it, x: s.basketX, y: config.basketTop })) }, config, 1 / 60);
    expect(s.score).toBe(BASE_POINTS * 3);
  });
});

describe('レア LINE', () => {
  it('誤爆 LINE を回収すると、すぐにボーナスが入る（即読の倍率もかかる）', () => {
    const y = config.basketTop * 0.8;
    const s = tapAt(stateWith([{ kind: 'bubble', bubble: 'gobaku', y }]), config, config.width / 2, y);
    expect(s.score).toBe(GOBAKU_POINTS);
    expect(s.rares).toBe(1);
    expect(s.lives).toBe(MAX_LIVES);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'rare', kind: 'gobaku' }));
  });

  it('社長からの LINE を要約すると、金の結論が出て大量の点になる', () => {
    const y = config.basketTop * 0.8;
    let s = tapAt(stateWith([{ kind: 'bubble', bubble: 'boss', y }]), config, config.width / 2, y);
    const word = s.items.find((it) => it.kind === 'word');
    expect(word?.golden).toBe(true);
    expect(BOSS_WORDS).toContain(word?.text as (typeof BOSS_WORDS)[number]);
    s = step({ ...s, items: s.items.map((it) => ({ ...it, x: s.basketX, y: config.basketTop })) }, config, 1 / 60);
    expect(s.score).toBe(GOLDEN_POINTS);
  });

  it('レア LINE は 10 秒を過ぎてから、画面に 1 つまで', () => {
    let seen = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let s: LineState = { ...createLineGame(seed, config), lives: 1e9, basketX: -1000 };
      for (let f = 0; f < 60 * DAY_SECONDS && s.status === 'playing'; f++) {
        s = step({ ...s, lives: 1e9 }, config, 1 / 60);
        const rares = s.items.filter((it) => it.bubble === 'boss' || it.bubble === 'gobaku');
        expect(rares.length).toBeLessThanOrEqual(1);
        if (rares.length > 0) {
          expect(Math.min(...rares.map((r) => r.born))).toBeGreaterThanOrEqual(RARE_FROM);
          seen++;
        }
      }
    }
    // 8 日分流せば、どこかでレア LINE が来ている
    expect(seen).toBeGreaterThan(0);
  });
});

describe('神要約フィーバー', () => {
  /** 結論をキャッチする直前の状態 */
  const catching = (patch: Partial<LineState>) => stateWith([{ kind: 'word', y: config.basketTop }], patch);

  it('正解を続けてゲージが満タンになると、神要約タイムが始まりゴミが一掃される', () => {
    const s = step(
      stateWith(
        [
          { kind: 'word', y: config.basketTop },
          { kind: 'bubble', bubble: 'fake', x: 70, y: 100 },
          { kind: 'guchi', x: 300, y: 200 },
          { kind: 'bubble', bubble: 'real', x: 300, y: 50 },
        ],
        { fever: 100 - FEVER_PER_CATCH },
      ),
      config,
      1 / 60,
    );
    expect(s.feverTime).toBe(FEVER_SECONDS);
    expect(s.feverCount).toBe(1);
    expect(s.events).toContainEqual({ type: 'fever-start' });
    expect(s.items.some((it) => it.bubble === 'fake' || it.kind === 'guchi')).toBe(false);
    expect(s.items.some((it) => it.bubble === 'real')).toBe(true);
  });

  it('神要約タイム中は点が 3 倍、吹き出しに当たってもライフが減らず、そのまま要約される', () => {
    let s = step(catching({ feverTime: 5, fever: 100 }), config, 1 / 60);
    expect(s.score).toBe(BASE_POINTS * FEVER_SCORE_MULTIPLIER);
    s = step(stateWith([{ kind: 'bubble', bubble: 'real', y: config.basketTop }], { feverTime: 5, fever: 100 }), config, 1 / 60);
    expect(s.lives).toBe(MAX_LIVES);
    expect(s.items.some((it) => it.kind === 'word')).toBe(true);
  });

  it('神要約タイム中は本物（と社長）しか降ってこない', () => {
    let s: LineState = { ...stateWith([], { feverTime: FEVER_SECONDS, fever: 100, spawnTimer: 0 }), basketX: -1000 };
    let spawned = 0;
    for (let f = 0; f < 60 * 7; f++) {
      s = step({ ...s, feverTime: Math.max(s.feverTime, 1) }, config, 1 / 60);
      for (const it of s.items) {
        if (it.kind === 'bubble') expect(['real', 'boss']).toContain(it.bubble);
      }
      spawned = Math.max(spawned, s.items.filter((it) => it.kind === 'bubble').length);
    }
    expect(spawned).toBeGreaterThan(0);
  });

  it('神要約タイムが終わると、残った本物の吹き出しは全部要約されて結論がカゴへ飛ぶ', () => {
    const s = step(stateWith([{ kind: 'bubble', bubble: 'real', x: 80, y: 100 }], { feverTime: 0.01, fever: 100 }), config, 1 / 60);
    expect(s.feverTime).toBe(0);
    expect(s.fever).toBe(0);
    expect(s.events).toContainEqual({ type: 'fever-end' });
    expect(s.items.some((it) => it.kind === 'bubble')).toBe(false);
    expect(s.items.some((it) => it.kind === 'word')).toBe(true);
  });

  it('ミスをするとゲージが半分になる', () => {
    const s = tapAt(stateWith([{ kind: 'bubble', bubble: 'none', y: 200 }], { fever: 80 }), config, config.width / 2, 200);
    expect(s.fever).toBe(40);
  });

  it('ブチギレ中は始まらず、ブチギレが収まったら始まる', () => {
    let s = step(catching({ fever: 95, rage: 3, mood: 100 }), config, 1 / 60);
    expect(s.fever).toBe(100);
    expect(s.feverTime).toBe(0);
    s = step({ ...s, rage: 0.01 }, config, 1 / 60);
    expect(s.events).toContainEqual({ type: 'rage-end' });
    expect(s.feverTime).toBe(FEVER_SECONDS);
  });
});

describe('必ずよけられる', () => {
  it('どの画面幅でも、ゴミの横には必ずカゴが通れる隙間が残る（ブチギレ中も）', () => {
    for (const [width, height] of [
      [320, 520],
      [390, 600],
      [768, 900],
    ]) {
      const cfg = createLineConfig(width, height);
      for (const seed of [1, 2, 3]) {
        let s: LineState = { ...createLineGame(seed, cfg), lives: 1e9, basketX: -1000 };
        let phones = 0;
        for (let f = 0; f < 60 * DAY_SECONDS && s.status === 'playing'; f++) {
          if (f % (60 * 20) === 60 * 8) s = { ...s, rage: RAGE_SECONDS, mood: 100, phoneTimer: RAGE_FIRST_PHONE };
          s = step({ ...s, lives: 1e9 }, cfg, 1 / 60);
          for (const it of s.items) {
            if (it.kind === 'word') continue;
            if (it.kind === 'phone') phones++;
            expect(it.w).toBeLessThanOrEqual(maxBlockWidth(width, cfg.basketWidth));
            if (!hasDodgeGap(s.items, cfg, it.y - it.h / 2, it.y + it.h / 2)) {
              throw new Error(`隙間がない: width=${width} seed=${seed} frame=${f}`);
            }
          }
        }
        expect(phones).toBeGreaterThan(0);
      }
    }
  });
});

describe('音と演出とシェア', () => {
  it('起きたことに合わせて音を鳴らす', () => {
    expect(soundsFor({ type: 'summarize', id: 1, result: 'real' })).toEqual(['se_tear']);
    expect(soundsFor({ type: 'clear' })).toEqual(['se_clear']);
    expect(soundsFor({ type: 'gameover', reason: 'lives' })).toEqual(['se_gameover']);
    expect(catchSounds(3)).toEqual(['se_catch_2', 'se_praise']);
  });

  it('赤い明滅は 1 秒に 3 回より遅く、視差効果を減らす設定では点滅しない', () => {
    expect(1 / RAGE_FLASH_PERIOD).toBeLessThan(3);
    expect(rageFlashOpacity(0, true)).toBe(rageFlashOpacity(RAGE_FLASH_PERIOD / 2, true));
    expect(cutInOffset(0.8)).toBe(0);
  });

  it('X に定時退社・残業確定をシェアできる', () => {
    const r = { cleared: true, score: 4200, caught: 12, fakesDodged: 3, clock: '18:00' };
    expect(shareText(r)).toContain('定時退社');
    expect(shareText({ ...r, cleared: false, clock: '15:42' })).toContain('15:42');
    expect(shareUrl(r)).toMatch(/^https:\/\/x\.com\/intent\/post\?text=/);
  });
});

type FakePlayer = PlayerLike & { play: jest.Mock; pause: jest.Mock; seekTo: jest.Mock; remove: jest.Mock };

function fakeManager() {
  const players: Record<string, FakePlayer> = {};
  const sources = Object.fromEntries(Object.keys(SOUND_SOURCES).map((k) => [k, k])) as Record<SoundName, string>;
  const manager = new SoundManager((source) => {
    const p: FakePlayer = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), remove: jest.fn(), loop: false, volume: 1 };
    players[String(source)] = p;
    return p;
  }, sources);
  return { manager, players };
}

describe('画面', () => {
  const LAYOUT = { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 600 } } };

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.useFakeTimers();
  });
  // 画面を片付けてから時計を元に戻す（偽の時計で動いていたアニメーションを、本物の時計の下で止めると次のテストが固まる）
  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  const advance = (ms: number) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });

  it('タイトルから業務開始すると、時計・ゲージ・ライフが出て吹き出しが降ってくる', async () => {
    const sound = fakeManager();
    await render(<App soundManager={sound.manager} />);
    expect(screen.getByTestId('line-title-logo')).toHaveTextContent('要約の達人');
    expect(sound.manager.bgm).toBe('bgm_title');
    await fireEvent.press(screen.getByTestId('line-start'));
    await fireEvent(screen.getByTestId('line-field'), 'layout', LAYOUT);
    expect(screen.getByTestId('line-clock')).toHaveTextContent('9:00');
    expect(screen.getByTestId('mood-value')).toHaveTextContent('0%');
    expect(screen.getByTestId('line-lives')).toHaveTextContent('❤️❤️❤️');
    expect(sound.manager.bgm).toBe('bgm_game');
    await advance(2000);
    expect(screen.queryAllByTestId(/^item-/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('line-clock')).not.toHaveTextContent('9:00');
  });

  it('吹き出しをタップすると要約される', async () => {
    const sound = fakeManager();
    await render(
      <SoundProvider manager={sound.manager}>
        <LineGameScreen seed={3} bestScore={0} onGameOver={() => false} onRetry={jest.fn()} onTitle={jest.fn()} />
      </SoundProvider>,
    );
    const field = screen.getByTestId('line-field');
    await fireEvent(field, 'layout', LAYOUT);
    let bubble = screen.queryAllByTestId(/^item-bubble-/)[0];
    for (let i = 0; i < 40 && !bubble; i++) {
      await advance(100);
      bubble = screen.queryAllByTestId(/^item-bubble-/)[0];
    }
    expect(bubble).toBeTruthy();
    const style = Object.assign({}, ...[bubble.props.style].flat(3).filter(Boolean)) as { left: number; top: number; width: number; height: number };
    const pageX = style.left + style.width / 2;
    const pageY = style.top + style.height / 2;
    // PanResponder は指の動きの履歴（touchHistory）から移動量を計算するので、動いていない履歴を渡す
    const touch = {
      touchActive: true,
      startPageX: pageX,
      startPageY: pageY,
      startTimeStamp: 0,
      currentPageX: pageX,
      currentPageY: pageY,
      currentTimeStamp: 0,
      previousPageX: pageX,
      previousPageY: pageY,
      previousTimeStamp: 0,
    };
    const touchHistory = { numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: 0, touchBank: [touch] };
    const ev = { nativeEvent: { pageX, pageY, touches: [], timestamp: 0 }, touchHistory };
    await fireEvent(field, 'responderGrant', ev);
    await fireEvent(field, 'responderRelease', ev);
    expect(screen.queryByTestId(bubble.props.testID)).toBeNull();
  });

  it('力尽きると上司からの着信画面になり、チーンが鳴る', async () => {
    const sound = fakeManager();
    const onGameOver = jest.fn(() => true);
    await render(
      <SoundProvider manager={sound.manager}>
        <LineGameScreen seed={3} bestScore={0} onGameOver={onGameOver} onRetry={jest.fn()} onTitle={jest.fn()} />
      </SoundProvider>,
    );
    await fireEvent(screen.getByTestId('line-field'), 'layout', LAYOUT);
    for (let i = 0; i < 70 && !screen.queryByTestId('incoming-call'); i++) await advance(1000);
    expect(screen.getByTestId('incoming-call')).toBeTruthy();
    expect(screen.getByTestId('gameover-clock')).toHaveTextContent(/\d+:\d\d/);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(sound.players.se_gameover.play).toHaveBeenCalled();
    expect(sound.manager.bgm).toBeNull();
  });
});
