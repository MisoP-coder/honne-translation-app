import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  BUBBLE_FONT_SIZE,
  BUBBLE_LINE_HEIGHT,
  BUBBLE_PADDING_X,
  BUBBLE_PADDING_Y,
  type FallingItem,
  GUCHI_FONT_SIZE,
  splitConclusion,
  textWidth,
  WORD_FONT_SIZE,
} from '../game/engine';
import { emojiText, lineColors } from '../theme';

interface Props {
  item: FallingItem;
  /** ブチギレ中（おじさん構文が赤く染まる） */
  rage: boolean;
  /** ゲームの経過時間（結論が飛び出す演出に使う） */
  time: number;
}

/** 飛び出した結論の大きさ。出た瞬間は大きく、0.25 秒でふつうに戻る */
export function wordPopScale(age: number): number {
  if (age < 0 || age >= 0.25) return 1;
  return 1.6 - (age / 0.25) * 0.6;
}

/**
 * 降ってくるテキスト 1 つ。位置と大きさはエンジンの値そのまま（当たり判定と見た目をそろえる）。
 * 絵文字はカラーのまま出したいので、縁取り文字は使わず普通の Text で描く。
 */
export const FallingText = memo(function FallingText({ item, rage, time }: Props) {
  const box = { left: item.x - item.w / 2, top: item.y - item.h / 2, width: item.w, height: item.h };
  switch (item.kind) {
    case 'word':
      return (
        <View
          testID={`item-word-${item.id}`}
          style={[styles.base, styles.word, box, { transform: [{ scale: wordPopScale(time - item.born) }] }]}
        >
          <Text style={[emojiText, styles.wordText]} numberOfLines={1}>
            {item.text}
          </Text>
        </View>
      );
    case 'guchi':
      return (
        <View testID={`item-guchi-${item.id}`} style={[styles.base, styles.guchi, rage && styles.guchiRage, box]}>
          <Text style={[emojiText, styles.guchiText]} numberOfLines={1}>
            {item.text}
          </Text>
        </View>
      );
    case 'phone':
      return (
        <View testID={`item-phone-${item.id}`} style={[styles.base, styles.phone, box]}>
          <Text style={[emojiText, styles.phoneText, phoneFont(item)]} numberOfLines={2}>
            {phoneLines(item.text).join('\n')}
          </Text>
        </View>
      );
    case 'bubble':
      return (
        <View testID={`item-bubble-${item.id}`} style={[styles.base, styles.bubble, rage && styles.bubbleRage, box]}>
          {/* 結論の単語には蛍光ペン。本物もひっかけも同じ見た目なので、前後を読んで見抜く */}
          <Text style={[emojiText, styles.bubbleText]}>
            {splitConclusion(item.text).map((part, i) =>
              part.conclusion ? (
                <Text key={i} style={styles.marker}>
                  {part.text}
                </Text>
              ) : (
                part.text
              ),
            )}
          </Text>
          {/* 吹き出しのしっぽ */}
          <View style={[styles.tail, rage && styles.tailRage]} />
        </View>
      );
  }
});

/** 特大ブロックの文字は「今すぐ／電話しろ‼️😡🔥」の 2 行にして、大きく見せる */
function phoneLines(text: string): string[] {
  const i = text.indexOf('電話');
  return i > 0 ? [text.slice(0, i), text.slice(i)] : [text];
}

/** 特大ブロックの文字を、箱に収まる大きさにする（ブラウザでは自動で縮まないので計算する） */
function phoneFont(item: FallingItem) {
  const widest = Math.max(...phoneLines(item.text).map(textWidth));
  // 絵文字は見積もりより広く描かれることがあるので、2 割ほど余裕を見る
  const fontSize = Math.max(14, Math.min(30, Math.floor((item.w - 32) / (widest * 1.2))));
  return { fontSize, lineHeight: Math.round(fontSize * 1.2) };
}

const styles = StyleSheet.create({
  base: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  word: {
    borderRadius: 999,
    backgroundColor: lineColors.word,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#FFE600',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  wordText: { fontSize: WORD_FONT_SIZE, lineHeight: WORD_FONT_SIZE + 6, fontWeight: '900', color: lineColors.wordText },
  guchi: {
    borderRadius: 8,
    backgroundColor: lineColors.guchi,
    borderWidth: 2,
    borderColor: '#222222',
  },
  guchiRage: { backgroundColor: '#7A0014', borderColor: '#FF1E3C' },
  guchiText: { fontSize: GUCHI_FONT_SIZE, lineHeight: GUCHI_FONT_SIZE + 6, fontWeight: '800', color: '#FFFFFF' },
  bubble: {
    borderRadius: 14,
    backgroundColor: lineColors.bubble,
    paddingHorizontal: BUBBLE_PADDING_X,
    paddingVertical: BUBBLE_PADDING_Y,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  bubbleRage: { backgroundColor: '#FFD9DE', borderColor: lineColors.danger, borderWidth: 2 },
  bubbleText: {
    fontSize: BUBBLE_FONT_SIZE,
    lineHeight: BUBBLE_LINE_HEIGHT,
    color: lineColors.bubbleText,
    fontWeight: '600',
  },
  marker: { fontWeight: '900', color: '#5A2A00', backgroundColor: '#FFE600' },
  tail: {
    position: 'absolute',
    left: -5,
    top: 8,
    width: 12,
    height: 12,
    backgroundColor: lineColors.bubble,
    transform: [{ rotate: '45deg' }],
  },
  tailRage: { backgroundColor: '#FFD9DE' },
  phone: {
    borderRadius: 16,
    backgroundColor: lineColors.danger,
    borderWidth: 4,
    borderColor: '#FFE600',
    paddingHorizontal: 10,
    shadowColor: '#FF0000',
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  phoneText: { fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
});
