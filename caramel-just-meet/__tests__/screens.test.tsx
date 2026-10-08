import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Linking } from 'react-native';

import App from '../App';
import { GameOverPanel } from '../src/components/GameOverPanel';
import { DUMMY_RANKING, MockRankingRepository } from '../src/ranking/mockRanking';
import { GameScreen } from '../src/screens/GameScreen';
import { RankingScreen } from '../src/screens/RankingScreen';
import { saveHighScore } from '../src/storage/highScore';
import type { PlayerProfile } from '../src/ranking/player';
import { RankingError } from '../src/ranking/types';

const LAYOUT = { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } } };

describe('GameOverPanel', () => {
  it('結果と称号を表示し、各ボタンが反応する', async () => {
    const handlers = {
      onShare: jest.fn(),
      onRetry: jest.fn(),
      onRanking: jest.fn(),
      onTitle: jest.fn(),
    };
    await render(
      <GameOverPanel score={1520} combo={12} perfectCount={4} bestScore={2000} isNewRecord {...handlers} />,
    );
    expect(screen.getByTestId('result-combo')).toHaveTextContent('12');
    expect(screen.getByTestId('result-score')).toHaveTextContent('1520');
    expect(screen.getByTestId('result-title')).toHaveTextContent('ぷるぷるハンター');
    expect(screen.getByText('★ NEW RECORD ★')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('share-x'));
    await fireEvent.press(screen.getByTestId('retry'));
    await fireEvent.press(screen.getByTestId('to-ranking'));
    await fireEvent.press(screen.getByTestId('to-title'));
    expect(handlers.onShare).toHaveBeenCalledTimes(1);
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
    expect(handlers.onRanking).toHaveBeenCalledTimes(1);
    expect(handlers.onTitle).toHaveBeenCalledTimes(1);
  });
});

describe('RankingScreen', () => {
  const player: PlayerProfile = { playerId: 'secret', publicId: null, name: null, flag: '🇯🇵' };

  it('サンプルのランキングでは「サンプル」と表示する', async () => {
    await render(
      <RankingScreen repository={new MockRankingRepository()} best={null} player={player} onRegister={jest.fn()} onBack={jest.fn()} />,
    );
    expect(await screen.findByTestId('ranking-row-d01')).toBeTruthy();
    expect(screen.getByText('CaramelGod_JP')).toBeTruthy();
    expect(screen.getByTestId('ranking-sample')).toBeTruthy();
    expect(screen.getByTestId('my-rank')).toHaveTextContent(/まずはプレイして/);
  });

  it('名前を入れて登録すると、自分の行と順位が出る', async () => {
    const repo = new MockRankingRepository();
    const onRegister = jest.fn();
    // App と同じように、登録したら名前と公開 ID をプレイヤー情報に保存する
    function Harness() {
      const [current, setCurrent] = useState(player);
      return (
        <RankingScreen
          repository={repo}
          best={{ score: 930, combo: 3 }}
          player={current}
          onRegister={async (name) => {
            onRegister(name);
            const r = await repo.submit({ playerId: 'secret', name, flag: '🇯🇵', score: 930, combo: 3 });
            setCurrent((c) => ({ ...c, name, publicId: r.publicId }));
            return r;
          }}
          onBack={jest.fn()}
        />
      );
    }
    await render(<Harness />);
    await screen.findByTestId('ranking-row-d01');
    await fireEvent.changeText(screen.getByTestId('ranking-name-input'), '  プリン  太郎 ');
    await fireEvent.press(screen.getByTestId('ranking-register'));
    expect(onRegister).toHaveBeenCalledWith('プリン 太郎');
    await waitFor(() => expect(screen.getByTestId('my-rank')).toHaveTextContent('プリン 太郎 は世界 20 位！'));
    expect(screen.getByTestId('ranking-row-me')).toHaveTextContent(/プリン 太郎/);
  });

  it('名前が空・長すぎるときは登録せずに知らせる', async () => {
    const onRegister = jest.fn();
    await render(
      <RankingScreen repository={new MockRankingRepository()} best={{ score: 300, combo: 1 }} player={player} onRegister={onRegister} onBack={jest.fn()} />,
    );
    await screen.findByTestId('ranking-row-d01');
    await fireEvent.press(screen.getByTestId('ranking-register'));
    expect(onRegister).not.toHaveBeenCalled();
    expect(screen.getByTestId('ranking-register-error')).toHaveTextContent(/1〜12 文字/);
  });

  it('通信できないときは理由を表示する', async () => {
    const onRegister = jest.fn(async () => {
      throw new RankingError('network', 'offline');
    });
    await render(
      <RankingScreen repository={new MockRankingRepository()} best={{ score: 300, combo: 1 }} player={player} onRegister={onRegister} onBack={jest.fn()} />,
    );
    await screen.findByTestId('ranking-row-d01');
    await fireEvent.changeText(screen.getByTestId('ranking-name-input'), 'テスト');
    await fireEvent.press(screen.getByTestId('ranking-register'));
    await waitFor(() => expect(screen.getByTestId('ranking-register-error')).toHaveTextContent(/通信できませんでした/));
  });

  it('上位に入らない登録済みの自分は、順位付きで下に表示する', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `x${i}`,
      name: `Player${i}`,
      flag: '🇯🇵',
      score: 10000 - i * 100,
      combo: 50,
    }));
    const repo = new MockRankingRepository(many);
    const r = await repo.submit({ playerId: 'secret', name: 'わたし', flag: '🇯🇵', score: 300, combo: 1 });
    await render(
      <RankingScreen
        repository={repo}
        best={{ score: 300, combo: 1 }}
        player={{ ...player, name: 'わたし', publicId: r.publicId }}
        onRegister={jest.fn()}
        onBack={jest.fn()}
      />,
    );
    expect(await screen.findByTestId('ranking-row-me')).toHaveTextContent(/26/);
    expect(screen.getByTestId('my-rank')).toHaveTextContent('わたし は世界 26 位！');
  });
});

describe('GameScreen', () => {
  afterEach(() => jest.useRealTimers());

  it('タップでカラメルが落ち、着地すると判定が出る', async () => {
    jest.useFakeTimers();
    const onGameOver = jest.fn(() => false);
    await render(
      <GameScreen seed={5} bestScore={0} onGameOver={onGameOver} onRanking={jest.fn()} onTitle={jest.fn()} />,
    );
    const area = screen.getByTestId('play-area');
    await fireEvent(area, 'layout', LAYOUT);
    expect(screen.getByTestId('pudding')).toBeTruthy();
    expect(screen.queryByTestId('falling-drop')).toBeNull();

    await fireEvent(area, 'responderGrant');
    expect(screen.getByTestId('falling-drop')).toBeTruthy();

    // 落下時間（約0.6秒）＋滑り落ちる時間を十分に進める
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2500);
    });
    expect(screen.queryByTestId('falling-drop')).toBeNull();
    const combo = Number(screen.getByTestId('hud-combo').props.children);
    if (combo === 1) {
      expect(onGameOver).not.toHaveBeenCalled();
    } else {
      expect(screen.getByTestId('game-over')).toBeTruthy();
      expect(onGameOver).toHaveBeenCalledWith({ score: 0, combo: 0 });
    }
  });
});

describe('App', () => {
  afterEach(() => jest.useRealTimers());

  it('タイトル → ランキング（名前を登録）→ タイトル と移動できる', async () => {
    await saveHighScore({ bestScore: 99990, bestCombo: 140, bestScoreCombo: 0 });
    // 1 位になれる本当にありえる記録（120 連続すべて JUST MEET）
    const top = 300 * 120 + 5 * 120 * 119;
    await saveHighScore({ bestScore: top, bestCombo: 140, bestScoreCombo: 120 });
    await render(<App rankingRepository={new MockRankingRepository(DUMMY_RANKING)} />);
    await waitFor(() =>
      expect(screen.getByTestId('title-best')).toHaveTextContent(`ハイスコア ${top} ／ 最高 140 連続`),
    );

    await fireEvent.press(screen.getByTestId('open-ranking'));
    await screen.findByTestId('ranking-row-d01');
    await fireEvent.changeText(screen.getByTestId('ranking-name-input'), 'チャンピオン');
    await fireEvent.press(screen.getByTestId('ranking-register'));
    await waitFor(() => expect(screen.getByTestId('my-rank')).toHaveTextContent('チャンピオン は世界 1 位！'));
    expect(screen.getByTestId('ranking-row-me')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('ranking-back'));
    expect(screen.getByTestId('start')).toBeTruthy();
  });

  it('スタートでゲーム画面が開く', async () => {
    await render(<App rankingRepository={new MockRankingRepository(DUMMY_RANKING)} />);
    await fireEvent.press(screen.getByTestId('start'));
    expect(screen.getByTestId('play-area')).toBeTruthy();
    expect(screen.getByTestId('hud-combo')).toHaveTextContent('0');
  });
});

describe('Xシェア（ゲームオーバー画面から）', () => {
  it('シェアボタンで X の投稿画面を開く', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { shareToX } = jest.requireActual('../src/share/xShare') as typeof import('../src/share/xShare');
    await render(
      <GameOverPanel
        score={300}
        combo={1}
        perfectCount={1}
        bestScore={300}
        isNewRecord={false}
        onShare={() => void shareToX(1)}
        onRetry={jest.fn()}
        onRanking={jest.fn()}
        onTitle={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByTestId('share-x'));
    expect(open).toHaveBeenCalledTimes(1);
    const url = open.mock.calls[0][0];
    expect(decodeURIComponent(url)).toContain('プリンの頂点にカラメルを1連続で乗せた！ 称号：プリン見習い');
    open.mockRestore();
  });
});
