import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import App from '../App';
import {
  clampVolume,
  DEFAULT_SOUND_SETTINGS,
  loadSoundSettings,
  sanitizeSettings,
  saveSoundSettings,
} from '../src/audio/settings';
import { SoundProvider } from '../src/audio/SoundContext';
import { type PlayerLike, SoundManager } from '../src/audio/SoundManager';
import {
  FEVER_SOUND_COMBO,
  JACKPOT_SOUND_COMBO,
  landingSounds,
  perfectSound,
  SOUND_SOURCES,
  type SoundName,
} from '../src/audio/sounds';
import { MockRankingRepository } from '../src/ranking/mockRanking';
import { GameScreen } from '../src/screens/GameScreen';
import { volumeAt } from '../src/components/VolumeBar';

interface FakePlayer extends PlayerLike {
  name: string;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
}

/** 本物の代わりに、呼ばれた操作を記録するプレイヤーで SoundManager を作る */
function fakeManager() {
  const players: Record<string, FakePlayer> = {};
  // テストでは音声ファイルの require がすべて同じ値になるので、音の名前をそのまま音源として渡す
  const sources = Object.fromEntries(Object.keys(SOUND_SOURCES).map((k) => [k, k])) as Record<SoundName, string>;
  const manager = new SoundManager((source) => {
    const name = String(source);
    const p: FakePlayer = {
      name,
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      remove: jest.fn(),
      loop: false,
      volume: 1,
    };
    players[name] = p;
    return p;
  }, sources);
  return { manager, players };
}

describe('鳴らす音の選び方', () => {
  it('JUST MEET はコンボごとに音程が上がり、8 段階で頭打ち', () => {
    expect(perfectSound(1)).toBe('se_perfect_0');
    expect(perfectSound(2)).toBe('se_perfect_1');
    expect(perfectSound(8)).toBe('se_perfect_7');
    expect(perfectSound(99)).toBe('se_perfect_7');
  });

  it('10 コンボからリーチ音を重ね、20 コンボから確定音に切り替わる', () => {
    expect(landingSounds('perfect', 3)).toEqual(['se_perfect_2']);
    expect(landingSounds('perfect', FEVER_SOUND_COMBO)).toEqual(['se_perfect_7', 'se_fever']);
    expect(landingSounds('perfect', JACKPOT_SOUND_COMBO)).toEqual(['se_perfect_7', 'se_jackpot']);
    expect(landingSounds('good', 25)).toEqual(['se_good']);
    expect(landingSounds('miss', 25)).toEqual(['se_gameover']);
  });

  it('全部の音のファイルが揃っている', () => {
    const names = Object.keys(SOUND_SOURCES) as SoundName[];
    for (const n of names) expect(SOUND_SOURCES[n]).toBeDefined();
    for (let c = 1; c <= 30; c++) {
      for (const s of landingSounds('perfect', c)) expect(names).toContain(s);
    }
  });
});

describe('SoundManager', () => {
  it('最初に全部読み込み、BGM だけループにする。何度 load しても作り直さない', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.load();
    expect(Object.keys(players)).toHaveLength(Object.keys(SOUND_SOURCES).length);
    expect(players.bgm_title.loop).toBe(true);
    expect(players.bgm_game.loop).toBe(true);
    expect(players.se_drop.loop).toBe(false);
    expect(players.bgm_game.volume).toBeLessThan(1);
  });

  it('効果音は毎回頭から鳴らす', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playSe('se_drop');
    manager.playSe('se_drop');
    expect(players.se_drop.seekTo).toHaveBeenCalledWith(0);
    expect(players.se_drop.play).toHaveBeenCalledTimes(2);
  });

  it('BGM は同時に 1 曲だけ。同じ曲なら鳴らし直さない', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_title');
    manager.playBgm('bgm_title');
    expect(players.bgm_title.play).toHaveBeenCalledTimes(1);
    manager.playBgm('bgm_game');
    expect(players.bgm_title.pause).toHaveBeenCalled();
    expect(players.bgm_game.play).toHaveBeenCalledTimes(1);
    expect(manager.bgm).toBe('bgm_game');
  });

  it('stopBgm でピタッと止まる', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_game');
    manager.stopBgm();
    expect(players.bgm_game.pause).toHaveBeenCalled();
    expect(manager.bgm).toBeNull();
  });

  it('読み込む前に頼まれた BGM は、読み込み後に流れる', () => {
    const { manager, players } = fakeManager();
    manager.playBgm('bgm_title');
    manager.load();
    expect(players.bgm_title.play).toHaveBeenCalled();
  });

  it('BGM をオフにすると BGM だけ止まり、効果音は鳴る。オンに戻すと BGM が再開する', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_title');
    manager.applySettings({ bgmEnabled: false });
    expect(players.bgm_title.pause).toHaveBeenCalled();
    expect(manager.bgm).toBeNull();
    manager.playSe('se_drop');
    expect(players.se_drop.play).toHaveBeenCalledTimes(1);
    // オフの間に画面が変わっても、戻したときはその画面の曲が流れる
    manager.playBgm('bgm_game');
    expect(players.bgm_game.play).not.toHaveBeenCalled();
    manager.applySettings({ bgmEnabled: true });
    expect(players.bgm_game.play).toHaveBeenCalledTimes(1);
    expect(manager.bgm).toBe('bgm_game');
  });

  it('効果音をオフにすると効果音だけ鳴らなくなり、BGM は流れ続ける', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_title');
    manager.applySettings({ seEnabled: false });
    manager.playSe('se_drop');
    expect(players.se_drop.play).not.toHaveBeenCalled();
    expect(players.se_drop.pause).toHaveBeenCalled();
    expect(players.bgm_title.pause).not.toHaveBeenCalled();
    expect(manager.bgm).toBe('bgm_title');
  });

  it('音量は BGM と効果音で別々に効き、鳴っている音にもすぐ反映される', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_title');
    manager.applySettings({ bgmVolume: 0.5, seVolume: 1 });
    expect(players.bgm_title.volume).toBeCloseTo(0.55 * 0.5);
    expect(players.se_drop.volume).toBeCloseTo(0.7 * 1);
    expect(players.se_jackpot.volume).toBeCloseTo(1);
    manager.applySettings({ seVolume: 0.3 });
    expect(players.se_jackpot.volume).toBeCloseTo(0.3);
    expect(players.bgm_title.volume).toBeCloseTo(0.55 * 0.5);
  });

  it('音量 0 は鳴らさないのと同じ', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_title');
    manager.applySettings({ bgmVolume: 0, seVolume: 0 });
    expect(manager.bgm).toBeNull();
    manager.playSe('se_drop');
    expect(players.se_drop.play).not.toHaveBeenCalled();
    manager.applySettings({ bgmVolume: 0.4 });
    expect(manager.bgm).toBe('bgm_title');
  });

  it('dispose で全部止めて解放し、もう鳴らない', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.dispose();
    for (const p of Object.values(players)) expect(p.remove).toHaveBeenCalled();
    manager.playSe('se_drop');
    expect(players.se_drop.play).not.toHaveBeenCalled();
  });

  it('ブラウザの再生許可のあとに BGM を鳴らし直せる', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_title');
    manager.unlock();
    expect(players.bgm_title.play).toHaveBeenCalledTimes(2);
  });

  it('プレイヤーが壊れていてもゲームは止まらない', () => {
    const manager = new SoundManager(() => {
      throw new Error('load failed');
    });
    expect(() => {
      manager.load();
      manager.playSe('se_drop');
      manager.playBgm('bgm_title');
      manager.dispose();
    }).not.toThrow();
  });
});

describe('画面と音', () => {
  // 前のテストで保存された音の設定が残らないようにする
  beforeEach(() => AsyncStorage.clear());
  afterEach(() => jest.useRealTimers());

  it('起動するとタイトル BGM が流れ、スタートでゲーム BGM に切り替わる', async () => {
    const { manager, players } = fakeManager();
    await render(<App rankingRepository={new MockRankingRepository()} soundManager={manager} />);
    expect(players.bgm_title.play).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('start'));
    expect(players.bgm_title.pause).toHaveBeenCalled();
    expect(players.bgm_game.play).toHaveBeenCalled();
  });

  it('サウンド設定で BGM と効果音を別々に切り替え、音量を変えられる', async () => {
    const { manager, players } = fakeManager();
    await render(<App rankingRepository={new MockRankingRepository()} soundManager={manager} />);
    await fireEvent.press(screen.getByTestId('sound-settings-open'));
    expect(screen.getByTestId('sound-settings')).toBeTruthy();

    // BGM をオフ → タイトル BGM が止まる。効果音はオンのまま
    await fireEvent.press(screen.getByTestId('bgm-toggle'));
    expect(manager.getSettings()).toMatchObject({ bgmEnabled: false, seEnabled: true });
    expect(players.bgm_title.pause).toHaveBeenCalled();
    expect(screen.getByTestId('bgm-toggle')).toHaveTextContent('OFF');
    expect(screen.getByTestId('se-toggle')).toHaveTextContent('ON');

    // 効果音の音量ゲージの 30% の位置をタップ → 30%、指を離すと試し鳴らし
    const bar = screen.getByTestId('se-volume');
    await fireEvent(bar, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 36 } } });
    await fireEvent(bar, 'responderGrant', { nativeEvent: { locationX: 60 } });
    expect(manager.getSettings().seVolume).toBeCloseTo(0.3);
    expect(screen.getByText('30%')).toBeTruthy();
    await fireEvent(bar, 'responderRelease');
    expect(players.se_perfect_4.play).toHaveBeenCalled();

    // 両方オフにするとボタンが 🔇 になる
    await fireEvent.press(screen.getByTestId('se-toggle'));
    await fireEvent.press(screen.getByTestId('sound-settings-close'));
    expect(screen.queryByTestId('sound-settings')).toBeNull();
    expect(screen.getByTestId('sound-settings-open')).toHaveTextContent('🔇 サウンド');
  });

  it('音の設定は端末に保存され、次に起動したときも使われる', async () => {
    await AsyncStorage.clear();
    const first = fakeManager();
    const view = await render(<App rankingRepository={new MockRankingRepository()} soundManager={first.manager} />);
    await fireEvent.press(screen.getByTestId('sound-settings-open'));
    await fireEvent.press(screen.getByTestId('se-toggle'));
    await act(async () => {});
    await view.unmount();
    await expect(loadSoundSettings()).resolves.toMatchObject({ seEnabled: false, bgmEnabled: true });

    const second = fakeManager();
    await render(<App rankingRepository={new MockRankingRepository()} soundManager={second.manager} />);
    await waitFor(() => expect(second.manager.getSettings().seEnabled).toBe(false));
  });

  it('タップでカラメル投下音が鳴る', async () => {
    // ゲームのループ（requestAnimationFrame）が勝手に進まないよう、時計を止めておく
    jest.useFakeTimers();
    const { manager, players } = fakeManager();
    await render(
      <SoundProvider manager={manager}>
        <GameScreen seed={5} bestScore={0} onGameOver={() => false} onRanking={jest.fn()} onTitle={jest.fn()} />
      </SoundProvider>,
    );
    const area = screen.getByTestId('play-area');
    await fireEvent(area, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } } });
    await fireEvent(area, 'responderGrant');
    expect(players.se_drop.play).toHaveBeenCalledTimes(1);
    // 落下中の連打では鳴らない
    await fireEvent(area, 'responderGrant');
    expect(players.se_drop.play).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('画面を閉じると音を解放する', async () => {
    const { manager, players } = fakeManager();
    const view = await render(<App rankingRepository={new MockRankingRepository()} soundManager={manager} />);
    await view.unmount();
    expect(players.bgm_title.remove).toHaveBeenCalled();
  });
});

describe('音の設定の値', () => {
  beforeEach(() => AsyncStorage.clear());

  it('音量は 0〜1 の 0.1 刻みにそろえる', () => {
    expect(clampVolume(0.47)).toBe(0.5);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(3)).toBe(1);
    expect(clampVolume(Number.NaN)).toBe(0);
  });

  it('ゲージの位置から音量を求める', () => {
    expect(volumeAt(0, 200)).toBe(0);
    expect(volumeAt(100, 200)).toBe(0.5);
    expect(volumeAt(250, 200)).toBe(1);
    expect(volumeAt(-5, 200)).toBe(0);
    expect(volumeAt(10, 0)).toBe(0);
  });

  it('壊れた保存データは初期値に直す', async () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(sanitizeSettings({ bgmEnabled: 'yes', seVolume: 9 })).toEqual({ ...DEFAULT_SOUND_SETTINGS, seVolume: 1 });
    await AsyncStorage.setItem('caramel-just-meet/sound-settings/v1', '{broken');
    await expect(loadSoundSettings()).resolves.toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('保存して読み出せる', async () => {
    const s = { bgmEnabled: false, bgmVolume: 0.3, seEnabled: true, seVolume: 1 };
    await saveSoundSettings(s);
    await expect(loadSoundSettings()).resolves.toEqual(s);
  });
});

describe('ブラウザで最初のタップから BGM を鳴らす', () => {
  const realOS = Platform.OS;
  let doc: EventTarget;

  beforeEach(async () => {
    await AsyncStorage.clear();
    // テスト環境にはブラウザの document がないので、イベントだけ扱える代わりを置く
    doc = new EventTarget();
    (globalThis as { document?: unknown }).document = doc;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
  });
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => realOS });
  });

  const fire = (type: string) => act(async () => void doc.dispatchEvent(new Event(type)));

  it('指で触れた瞬間ではなく、指を離したときに BGM を鳴らし、案内を消す', async () => {
    const { manager, players } = fakeManager();
    await render(<App rankingRepository={new MockRankingRepository()} soundManager={manager} />);
    expect(screen.getByTestId('tap-for-sound')).toBeTruthy();
    const before = players.bgm_title.play.mock.calls.length;

    // 触れた瞬間はブラウザが再生を認めないので、まだ鳴らさない
    await fire('pointerdown');
    await fire('touchstart');
    expect(players.bgm_title.play.mock.calls.length).toBe(before);

    // 指を離したら鳴らす
    await fire('pointerup');
    expect(players.bgm_title.play.mock.calls.length).toBe(before + 1);
    expect(screen.queryByTestId('tap-for-sound')).toBeNull();

    // 1 回目で鳴らなかったときのために、次のタップでも試す
    await fire('touchend');
    await fire('click');
    expect(players.bgm_title.play.mock.calls.length).toBe(before + 3);
  });

  it('BGM をオフにしているときは案内を出さない', async () => {
    await AsyncStorage.setItem(
      'caramel-just-meet/sound-settings/v1',
      JSON.stringify({ ...DEFAULT_SOUND_SETTINGS, bgmEnabled: false }),
    );
    const { manager } = fakeManager();
    await render(<App rankingRepository={new MockRankingRepository()} soundManager={manager} />);
    await waitFor(() => expect(manager.getSettings().bgmEnabled).toBe(false));
    expect(screen.queryByTestId('tap-for-sound')).toBeNull();
  });

  it('ゲームオーバーで止めた BGM は、タップしても鳴らし直さない', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_game');
    manager.stopBgm();
    const calls = players.bgm_game.play.mock.calls.length;
    manager.unlock();
    manager.unlock();
    expect(players.bgm_game.play.mock.calls.length).toBe(calls);
  });
});
