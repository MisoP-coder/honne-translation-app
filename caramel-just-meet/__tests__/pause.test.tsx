import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { SoundProvider } from '../src/audio/SoundContext';
import { type PlayerLike, SoundManager } from '../src/audio/SoundManager';
import { SOUND_SOURCES, type SoundName } from '../src/audio/sounds';
import { GameScreen, RESUME_COUNT_MS } from '../src/screens/GameScreen';

type FakePlayer = PlayerLike & { play: jest.Mock; pause: jest.Mock; seekTo: jest.Mock; remove: jest.Mock };

function fakeManager() {
  const players: Record<string, FakePlayer> = {};
  const sources = Object.fromEntries(Object.keys(SOUND_SOURCES).map((k) => [k, k])) as Record<SoundName, string>;
  const manager = new SoundManager((source) => {
    const p: FakePlayer = {
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      remove: jest.fn(),
      loop: false,
      volume: 1,
    };
    players[String(source)] = p;
    return p;
  }, sources);
  return { manager, players };
}

describe('一時停止中の BGM', () => {
  it('一時停止で BGM をその場で止め、再開すると続きから流れる', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_game');
    players.bgm_game.seekTo.mockClear();
    manager.suspendBgm();
    expect(players.bgm_game.pause).toHaveBeenCalled();
    expect(players.bgm_game.seekTo).not.toHaveBeenCalled();
    expect(manager.bgm).toBeNull();
    manager.resumeBgm();
    expect(players.bgm_game.play).toHaveBeenCalledTimes(2);
    expect(players.bgm_game.seekTo).not.toHaveBeenCalled();
    expect(manager.bgm).toBe('bgm_game');
  });

  it('一時停止中に BGM の設定を変えても勝手に鳴り出さない', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_game');
    manager.suspendBgm();
    manager.applySettings({ bgmEnabled: false });
    manager.applySettings({ bgmEnabled: true, bgmVolume: 0.5 });
    expect(players.bgm_game.play).toHaveBeenCalledTimes(1);
    expect(players.bgm_game.volume).toBeCloseTo(0.45 * 0.5);
    manager.unlock();
    expect(players.bgm_game.play).toHaveBeenCalledTimes(1);
    // 一時停止中にオフ→オンにした場合は、再開時に頭から流す
    manager.resumeBgm();
    expect(players.bgm_game.play).toHaveBeenCalledTimes(2);
    expect(players.bgm_game.seekTo).toHaveBeenCalledWith(0);
  });

  it('一時停止のまま別の画面に移ると、その画面の BGM が流れる', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_game');
    manager.suspendBgm();
    manager.cancelSuspend();
    manager.playBgm('bgm_title');
    expect(players.bgm_title.play).toHaveBeenCalledTimes(1);
    expect(manager.bgm).toBe('bgm_title');
  });
});

describe('プレイ中の一時停止', () => {
  const LAYOUT = { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } } };

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  async function setup(onTitle = jest.fn()) {
    const sound = fakeManager();
    await render(
      <SoundProvider manager={sound.manager}>
        <GameScreen seed={5} bestScore={0} onGameOver={() => false} onRanking={jest.fn()} onTitle={onTitle} />
      </SoundProvider>,
    );
    await fireEvent(screen.getByTestId('play-area'), 'layout', LAYOUT);
    return sound;
  }

  const advance = (ms: number) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });

  it('一時停止するとゲームが止まり、カウントダウンのあとに再開する', async () => {
    const { players } = await setup();
    const area = screen.getByTestId('play-area');
    await fireEvent(area, 'responderGrant');
    expect(screen.getByTestId('falling-drop')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('pause'));
    expect(screen.getByTestId('pause-menu')).toBeTruthy();
    expect(players.bgm_game.pause).toHaveBeenCalled();

    // 止まっている間は、時間が経ってもカラメルは落ちきらない。タップも効かない
    await advance(3000);
    expect(screen.getByTestId('falling-drop')).toBeTruthy();
    await fireEvent(area, 'responderGrant');
    expect(players.se_drop.play).toHaveBeenCalledTimes(1);

    // つづける → 3, 2, 1 → 再開
    await fireEvent.press(screen.getByTestId('pause-resume'));
    expect(screen.queryByTestId('pause-menu')).toBeNull();
    expect(screen.getByTestId('resume-count')).toHaveTextContent('3');
    await advance(RESUME_COUNT_MS + 20);
    expect(screen.getByTestId('resume-count')).toHaveTextContent('2');
    // 1 つの act の中では次のカウントの予約が反映されないので、1 つずつ進める
    await advance(RESUME_COUNT_MS + 20);
    expect(screen.getByTestId('resume-count')).toHaveTextContent('1');
    await advance(RESUME_COUNT_MS + 20);
    expect(screen.queryByTestId('resume-countdown')).toBeNull();
    expect(players.bgm_game.play).toHaveBeenCalledTimes(2);

    // 動き出したので、カラメルが着地する
    await advance(2500);
    expect(screen.queryByTestId('falling-drop')).toBeNull();
  });

  it('一時停止中にサウンド設定を開いて、閉じるとメニューに戻る', async () => {
    const { manager } = await setup();
    await fireEvent.press(screen.getByTestId('pause'));
    await fireEvent.press(screen.getByTestId('pause-sound'));
    expect(screen.getByTestId('sound-settings')).toBeTruthy();
    expect(screen.queryByTestId('pause-menu')).toBeNull();
    await fireEvent.press(screen.getByTestId('se-toggle'));
    expect(manager.getSettings().seEnabled).toBe(false);
    await fireEvent.press(screen.getByTestId('sound-settings-close'));
    expect(screen.getByTestId('pause-menu')).toBeTruthy();
  });

  it('一時停止からやり直す・タイトルへ戻る', async () => {
    const onTitle = jest.fn();
    const { players } = await setup(onTitle);
    await fireEvent(screen.getByTestId('play-area'), 'responderGrant');
    await fireEvent.press(screen.getByTestId('pause'));
    await fireEvent.press(screen.getByTestId('pause-retry'));
    expect(screen.queryByTestId('pause-menu')).toBeNull();
    expect(screen.queryByTestId('falling-drop')).toBeNull();
    expect(screen.getByTestId('hud-combo')).toHaveTextContent('0');
    // BGM は頭から流れ直す
    expect(players.bgm_game.seekTo).toHaveBeenCalledWith(0);

    await fireEvent.press(screen.getByTestId('pause'));
    await fireEvent.press(screen.getByTestId('pause-title'));
    expect(onTitle).toHaveBeenCalled();
  });

  it('アプリが裏に回ると自動で一時停止し、表に戻っても一時停止のまま BGM は鳴らさない', async () => {
    // 音の管理（SoundProvider）とゲーム画面の両方が見張っているので、全員に知らせる
    const handlers: ((s: AppStateStatus) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, h) => {
      handlers.push(h as (s: AppStateStatus) => void);
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const { players } = await setup();
    expect(screen.queryByTestId('pause-menu')).toBeNull();
    await act(async () => handlers.forEach((h) => h('background')));
    expect(screen.getByTestId('pause-menu')).toBeTruthy();
    expect(players.bgm_game.pause).toHaveBeenCalled();
    const plays = players.bgm_game.play.mock.calls.length;
    await act(async () => handlers.forEach((h) => h('active')));
    expect(screen.getByTestId('pause-menu')).toBeTruthy();
    expect(players.bgm_game.play.mock.calls.length).toBe(plays);
    spy.mockRestore();
  });
});
