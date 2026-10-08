import { fireEvent, render, screen } from '@testing-library/react-native';

import App from '../App';
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

  it('ミュート中は鳴らさず、解除すると BGM が戻る', () => {
    const { manager, players } = fakeManager();
    manager.load();
    manager.playBgm('bgm_title');
    manager.setMuted(true);
    expect(players.bgm_title.pause).toHaveBeenCalled();
    manager.playSe('se_drop');
    expect(players.se_drop.play).not.toHaveBeenCalled();
    manager.setMuted(false);
    expect(players.bgm_title.play).toHaveBeenCalledTimes(2);
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
  it('起動するとタイトル BGM が流れ、スタートでゲーム BGM に切り替わる', async () => {
    const { manager, players } = fakeManager();
    await render(<App rankingRepository={new MockRankingRepository()} soundManager={manager} />);
    expect(players.bgm_title.play).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('start'));
    expect(players.bgm_title.pause).toHaveBeenCalled();
    expect(players.bgm_game.play).toHaveBeenCalled();
  });

  it('サウンドのオン・オフを切り替えられる', async () => {
    const { manager, players } = fakeManager();
    await render(<App rankingRepository={new MockRankingRepository()} soundManager={manager} />);
    await fireEvent.press(screen.getByTestId('sound-toggle'));
    expect(manager.isMuted).toBe(true);
    expect(screen.getByText('🔇 音なし')).toBeTruthy();
    expect(players.bgm_title.pause).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('sound-toggle'));
    expect(manager.isMuted).toBe(false);
  });

  it('タップでカラメル投下音が鳴る', async () => {
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
  });

  it('画面を閉じると音を解放する', async () => {
    const { manager, players } = fakeManager();
    const view = await render(<App rankingRepository={new MockRankingRepository()} soundManager={manager} />);
    await view.unmount();
    expect(players.bgm_title.remove).toHaveBeenCalled();
  });
});
