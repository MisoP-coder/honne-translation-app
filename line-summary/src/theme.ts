import { Platform, type TextStyle } from 'react-native';

export const lineColors = {
  /** トーク画面っぽい背景 */
  talk: '#7FA1CF',
  talkDeep: '#5F7FB0',
  green: '#06C755',
  greenDeep: '#049A42',
  bubble: '#FFFFFF',
  bubbleText: '#222222',
  guchi: '#4A4A4A',
  word: '#FFE600',
  wordText: '#5A2A00',
  danger: '#FF1E3C',
  dangerDeep: '#8A0016',
  gold: '#FFD23F',
  text: '#1D2A44',
} as const;

/**
 * 絵文字をカラフルなまま表示するための文字の設定。
 * - ブラウザ：日本語のフォントのあとにカラー絵文字のフォントを並べる（白黒の記号フォントで描かれないように）
 * - Android：上下の余白を詰めると絵文字の頭が欠けるので、余白を残し、行の高さは文字より大きめにとる
 * - 色（color）は文字だけに効き、カラー絵文字の色は変わらない
 * 縁取り文字（OutlinedText）は同じ文字を何枚も重ねて描くため、絵文字を入れると色付きの影が何重にも出てしまう。
 * 絵文字は縁取り文字に入れず、この設定の普通の Text で描く。
 */
export const emojiText: TextStyle = Platform.select<TextStyle>({
  web: {
    fontFamily:
      'system-ui, -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"',
  },
  android: { includeFontPadding: true },
  default: {},
}) as TextStyle;
