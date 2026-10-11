import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';

import App from '../App';
import { SoundProvider } from '../src/audio/SoundContext';
import { type PlayerLike, SoundManager } from '../src/audio/SoundManager';
import { SOUND_SOURCES, type SoundName } from '../src/audio/sounds';
import {
  createLineConfig,
  createLineGame,
  type FallingItem,
  type ItemKind,
  type LineState,
  MAX_LIVES,
  measureItem,
  MOOD_PER_CATCH,
  MOOD_PER_PASS,
  RAGE_FIRST_PHONE,
  RAGE_SECONDS,
  RAGE_SPEED_MULTIPLIER,
  step,
} from '../src/line/engine';
import { cutInOffset, RAGE_FLASH_PERIOD, rageFlashOpacity } from '../src/line/components/RageOverlay';
import { LineGameScreen } from '../src/line/screens/LineGameScreen';
import { catchSounds, LINE_SOUND_SOURCES } from '../src/line/sounds';
import { CONCLUSION_WORDS, GUCHI_WORDS, OJISAN_TEXTS, RAGE_BLOCK_TEXT } from '../src/line/texts';

const config = createLineConfig(390, 600);
const EMOJI = /\p{Extended_Pictographic}/u;

/** テスト用：降ってくる途中のテキストを好きな場所に置いた状態を作る（勝手に降ってこないようにする） */
function stateWith(items: { kind: ItemKind; x?: number; y: number; vy?: number }[], patch: Partial<LineState> = {}): LineState {
  const base = createLineGame(1, config);
  const list: FallingItem[] = items.map((it, i) => {
    const text = it.kind === 'word' ? '明日休み' : it.kind === 'ojisan' ? OJISAN_TEXTS[0] : it.kind === 'guchi' ? '説教' : RAGE_BLOCK_TEXT;
    const { w, h } = measureItem(it.kind, text, config.width);
    return { id: 100 + i, kind: it.kind, text, x: it.x ?? config.width / 2, y: it.y, w, h, vy: it.vy ?? 100 };
  });
  return { ...base, items: list, spawnTimer: 999, phoneTimer: 999, ...patch };
}

/** カゴのすぐ上（次のフレームで当たる位置） */
const justAbove = (kind: ItemKind) => config.basketTop - measureItem(kind, kind === 'ojisan' ? OJISAN_TEXTS[0] : 'あ', config.width).h / 2 - 0.5;
/** 画面の下に消える直前 */
const justBelow = (kind: ItemKind) => config.height + measureItem(kind, kind === 'ojisan' ? OJISAN_TEXTS[0] : '説教', config.width).h / 2 - 0.5;

describe('要約の達人：テキストのデータ', () => {
  it('絵文字まみれのおじさん構文が 20 パターン以上ある', () => {
    expect(OJISAN_TEXTS.length).toBeGreaterThanOrEqual(20);
    expect(OJISAN_TEXTS.filter((t) => EMOJI.test(t)).length).toBeGreaterThanOrEqual(20);
    expect(new Set(OJISAN_TEXTS).size).toBe(OJISAN_TEXTS.length);
  });

  it('結論単語と愚痴テキストがそろっている', () => {
    for (const w of ['明日休み', '定時退社', 'ボーナス支給', '有給承認']) expect(CONCLUSION_WORDS).toContain(w);
    for (const w of ['昔は〜', '説教', '今から電話']) expect(GUCHI_WORDS).toContain(w);
  });
});

describe('要約の達人：エンジン', () => {
  it('結論単語をキャッチするとスコアが入り、イライラ度が 10 下がる', () => {
    const s = step(stateWith([{ kind: 'word', y: config.basketTop }], { mood: 30 }), config, 1 / 60);
    expect(s.items).toHaveLength(0);
    expect(s.score).toBe(100);
    expect(s.combo).toBe(1);
    expect(s.mood).toBe(30 - MOOD_PER_CATCH);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'catch', combo: 1 }));
  });

  it('イライラ度は 0 より下がらない', () => {
    const s = step(stateWith([{ kind: 'word', y: config.basketTop }], { mood: 5 }), config, 1 / 60);
    expect(s.mood).toBe(0);
  });

  it('連続キャッチでほめ言葉が出て、点数も上乗せされる', () => {
    const s = step(stateWith([{ kind: 'word', y: config.basketTop }], { combo: 4 }), config, 1 / 60);
    expect(s.combo).toBe(5);
    expect(s.score).toBe(140);
    expect(s.lastPraise).toEqual(expect.objectContaining({ combo: 5 }));
  });

  it('ゴミテキストに当たるとライフが減り、3 回でゲームオーバー', () => {
    let s = stateWith([{ kind: 'ojisan', y: config.basketTop }], { combo: 3 });
    s = step(s, config, 1 / 60);
    expect(s.lives).toBe(MAX_LIVES - 1);
    expect(s.combo).toBe(0);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'hit' }));
    s = step(stateWith([{ kind: 'guchi', y: config.basketTop }], { lives: 1 }), config, 1 / 60);
    expect(s.status).toBe('over');
    expect(s.overReason).toBe('lives');
    expect(s.events).toContainEqual({ type: 'gameover', reason: 'lives' });
  });

  it('カゴから外れたテキストには当たらない', () => {
    const s = step(stateWith([{ kind: 'guchi', x: 40, y: config.basketTop }], { basketX: config.width - 80 }), config, 1 / 60);
    expect(s.lives).toBe(MAX_LIVES);
    expect(s.items).toHaveLength(1);
  });

  it('おじさん構文をスルーして画面の下に消えると、イライラ度が 5 上がる', () => {
    const s = step(stateWith([{ kind: 'ojisan', x: 60, y: justBelow('ojisan') }], { basketX: config.width - 80 }), config, 1 / 60);
    expect(s.items).toHaveLength(0);
    expect(s.mood).toBe(MOOD_PER_PASS);
  });

  it('イライラ度が 100% になると上司がブチギレる', () => {
    const s = step(stateWith([{ kind: 'guchi', x: 40, y: justBelow('guchi') }], { mood: 95, basketX: config.width - 80 }), config, 1 / 60);
    expect(s.mood).toBe(100);
    expect(s.rage).toBe(RAGE_SECONDS);
    expect(s.rageCount).toBe(1);
    expect(s.events).toContainEqual({ type: 'rage-start' });
  });

  it('ブチギレ中はおじさん構文が 2 倍の速さで落ちる（結論単語はそのまま）', () => {
    const items = [
      { kind: 'ojisan' as const, x: 60, y: 100, vy: 100 },
      { kind: 'word' as const, x: 300, y: 100, vy: 100 },
    ];
    const normal = step(stateWith(items, { basketX: 200 }), config, 0.1);
    const raging = step(stateWith(items, { basketX: 200, rage: 5, mood: 100 }), config, 0.1);
    expect(normal.items[0].y - 100).toBeCloseTo(10);
    expect(raging.items[0].y - 100).toBeCloseTo(10 * RAGE_SPEED_MULTIPLIER);
    expect(raging.items[1].y - 100).toBeCloseTo(10);
  });

  it('ブチギレ中は「今すぐ電話しろ‼️😡🔥」が降ってきて、当たると即ゲームオーバー', () => {
    let s = stateWith([], { rage: RAGE_SECONDS, mood: 100, phoneTimer: RAGE_FIRST_PHONE });
    for (let i = 0; i < 100 && !s.items.some((it) => it.kind === 'phone'); i++) s = step(s, config, 1 / 30);
    const phone = s.items.find((it) => it.kind === 'phone');
    expect(phone?.text).toBe(RAGE_BLOCK_TEXT);

    const hit = step(stateWith([{ kind: 'phone', y: config.basketTop }], { rage: 5, mood: 100 }), config, 1 / 60);
    expect(hit.status).toBe('over');
    expect(hit.overReason).toBe('phone');
    expect(hit.lives).toBe(0);
  });

  it('ブチギレ中はゲージが動かず、キャッチの得点は 2 倍', () => {
    const s = step(stateWith([{ kind: 'word', y: config.basketTop }], { rage: 5, mood: 100 }), config, 1 / 60);
    expect(s.mood).toBe(100);
    expect(s.score).toBe(200);
  });

  it('10 秒耐え抜くとゲージが 0% に戻り、通常モードに戻る', () => {
    let s = stateWith([{ kind: 'phone', x: 60, y: 50, vy: 1 }], { rage: RAGE_SECONDS, mood: 100, basketX: config.width - 80 });
    const events: string[] = [];
    for (let t = 0; t < RAGE_SECONDS + 0.5; t += 1 / 30) {
      s = step({ ...s, spawnTimer: 999, phoneTimer: 999 }, config, 1 / 30);
      events.push(...s.events.map((e) => e.type));
    }
    expect(events).toContain('rage-end');
    expect(s.rage).toBe(0);
    expect(s.mood).toBe(0);
    expect(s.items.some((it) => it.kind === 'phone')).toBe(false);
    expect(s.status).toBe('playing');
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

describe('要約の達人：演出', () => {
  it('赤い明滅は 1 秒に 3 回より遅く、視差効果を減らす設定では点滅しない', () => {
    expect(1 / RAGE_FLASH_PERIOD).toBeLessThan(3);
    expect(rageFlashOpacity(0)).not.toBe(rageFlashOpacity(RAGE_FLASH_PERIOD / 2));
    expect(rageFlashOpacity(0, true)).toBe(rageFlashOpacity(RAGE_FLASH_PERIOD / 2, true));
  });

  it('カットインは右から入って止まり、しばらくすると消える', () => {
    expect(cutInOffset(0)).toBeCloseTo(1);
    expect(cutInOffset(0.8)).toBe(0);
    expect(cutInOffset(5)).toBeNull();
  });

  it('コンボで音程が上がり、3 コンボごとに脳汁音を重ねる', () => {
    expect(catchSounds(1)).toEqual(['line_catch_0']);
    expect(catchSounds(3)).toEqual(['line_catch_2', 'line_praise']);
    expect(catchSounds(50)[0]).toBe('line_catch_4');
  });
});

type FakePlayer = PlayerLike & { play: jest.Mock; pause: jest.Mock; seekTo: jest.Mock; remove: jest.Mock };

function fakeManager(sourceNames: string[]) {
  const players: Record<string, FakePlayer> = {};
  const sources = Object.fromEntries(sourceNames.map((k) => [k, k])) as Record<SoundName, string>;
  const manager = new SoundManager((source) => {
    const p: FakePlayer = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), remove: jest.fn(), loop: false, volume: 1 };
    players[String(source)] = p;
    return p;
  }, sources);
  return { manager, players };
}

describe('要約の達人：画面', () => {
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

  it('プリンのタイトル ⇄ 要約の達人 を行き来でき、BGM も切り替わる', async () => {
    const pudding = fakeManager(Object.keys(SOUND_SOURCES));
    const line = fakeManager(Object.keys(LINE_SOUND_SOURCES));
    await render(<App soundManager={pudding.manager} lineSoundManager={line.manager} initialGame="pudding" />);
    expect(screen.getByTestId('start')).toBeTruthy();
    expect(pudding.manager.bgm).toBe('bgm_title');

    await fireEvent.press(screen.getByTestId('open-line-game'));
    expect(screen.getByTestId('line-title')).toBeTruthy();
    expect(screen.getByTestId('line-title-logo')).toHaveTextContent('要約の達人');
    expect(pudding.manager.bgm).toBeNull();
    expect(line.manager.bgm).toBe('bgm_title');

    await fireEvent.press(screen.getByTestId('line-to-pudding'));
    expect(screen.getByTestId('start')).toBeTruthy();
    expect(screen.queryByTestId('line-title')).toBeNull();
    expect(pudding.manager.bgm).toBe('bgm_title');
  });

  it('スタートするとテキストが降ってきて、ゲージとライフが表示される', async () => {
    await render(<App initialGame="line" />);
    await fireEvent.press(screen.getByTestId('line-start'));
    await fireEvent(screen.getByTestId('line-field'), 'layout', LAYOUT);
    expect(screen.getByTestId('summary-basket')).toBeTruthy();
    expect(screen.getByTestId('mood-value')).toHaveTextContent('0%');
    expect(screen.getByTestId('line-lives')).toHaveTextContent('❤️❤️❤️');
    await advance(1500);
    expect(screen.queryAllByTestId(/^item-/).length).toBeGreaterThan(0);
  });

  it('ゲームオーバーになると上司からの着信画面になり、チーンが鳴る', async () => {
    const line = fakeManager(Object.keys(LINE_SOUND_SOURCES));
    const onGameOver = jest.fn(() => true);
    await render(
      <SoundProvider manager={line.manager}>
        <LineGameScreen seed={3} bestScore={0} onGameOver={onGameOver} onRetry={jest.fn()} onTitle={jest.fn()} />
      </SoundProvider>,
    );
    await fireEvent(screen.getByTestId('line-field'), 'layout', LAYOUT);
    // 何もしなければ、いずれおじさん構文に 3 回当たるかブチギレの電話に当たって終わる
    for (let i = 0; i < 120 && !screen.queryByTestId('incoming-call'); i++) await advance(1000);
    expect(screen.getByTestId('incoming-call')).toBeTruthy();
    expect(screen.getByTestId('gameover-reason')).toHaveTextContent(/読んでしまった|受け止めてしまった/);
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(line.players.line_gameover.play).toHaveBeenCalled();
    expect(line.manager.bgm).toBeNull();
  });
});
