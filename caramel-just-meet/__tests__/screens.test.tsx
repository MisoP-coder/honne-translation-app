import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import App from '../App';
import { GameOverPanel } from '../src/components/GameOverPanel';
import { DUMMY_RANKING, MockRankingRepository } from '../src/ranking/mockRanking';
import { GameScreen } from '../src/screens/GameScreen';
import { RankingScreen } from '../src/screens/RankingScreen';
import { saveHighScore } from '../src/storage/highScore';

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
  it('ダミーの上位プレイヤーと自分の順位を表示する', async () => {
    await render(
      <RankingScreen
        repository={new MockRankingRepository()}
        myRecord={{ name: 'あなた', score: 12000, combo: 40 }}
        onBack={jest.fn()}
      />,
    );
    expect(await screen.findByTestId('ranking-row-d01')).toBeTruthy();
    expect(screen.getByText('CaramelGod_JP')).toBeTruthy();
    expect(screen.getByTestId('ranking-row-me')).toBeTruthy();
    expect(screen.getByTestId('my-rank')).toHaveTextContent('あなたは世界 10 位！');
  });

  it('上位20位に入らなくても自分の行を下に表示する', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `x${i}`,
      name: `Player${i}`,
      flag: '🇯🇵',
      score: 10000 - i * 100,
      combo: 50,
    }));
    await render(
      <RankingScreen
        repository={new MockRankingRepository(many)}
        myRecord={{ name: 'あなた', score: 50, combo: 1 }}
        onBack={jest.fn()}
      />,
    );
    expect(await screen.findByTestId('ranking-row-me')).toHaveTextContent(/21/);
    expect(screen.queryByTestId('my-rank')).toBeNull();
  });

  it('未プレイなら案内を出す', async () => {
    await render(<RankingScreen repository={new MockRankingRepository()} myRecord={null} onBack={jest.fn()} />);
    expect(await screen.findByTestId('my-rank')).toHaveTextContent(/まだ記録がありません/);
    expect(screen.queryByTestId('ranking-row-me')).toBeNull();
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

  it('タイトル → ランキング → タイトル と移動でき、ハイスコアがランキングに載る', async () => {
    await saveHighScore({ bestScore: 99999, bestCombo: 120 });
    await render(<App rankingRepository={new MockRankingRepository(DUMMY_RANKING)} />);
    await waitFor(() =>
      expect(screen.getByTestId('title-best')).toHaveTextContent('ハイスコア 99999 ／ 最高 120 連続'),
    );

    await fireEvent.press(screen.getByTestId('open-ranking'));
    expect(await screen.findByTestId('ranking-row-me')).toBeTruthy();
    expect(screen.getByTestId('my-rank')).toHaveTextContent('あなたは世界 1 位！');

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
