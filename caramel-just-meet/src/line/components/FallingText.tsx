import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  type FallingItem,
  GUCHI_FONT_SIZE,
  OJISAN_FONT_SIZE,
  OJISAN_LINE_HEIGHT,
  OJISAN_PADDING_X,
  OJISAN_PADDING_Y,
  textWidth,
  WORD_FONT_SIZE,
} from '../engine';
import { emojiText, lineColors } from '../theme';

interface Props {
  item: FallingItem;
  /** ブチギレ中（おじさん構文が赤く染まる） */
  rage: boolean;
}

/**
 * 降ってくるテキスト 1 つ。位置と大きさはエンジンの値そのまま（当たり判定と見た目をそろえる）。
 * 絵文字はカラーのまま出したいので、縁取り文字は使わず普通の Text で描く。
 */
export const FallingText = memo(function FallingText({ item, rage }: Props) {
  const box = { left: item.x - item.w / 2, top: item.y - item.h / 2, width: item.w, height: item.h };
  switch (item.kind) {
    case 'word':
      return (
        <View testID={`item-word-${item.id}`} style={[styles.base, styles.word, box]}>
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
    case 'ojisan':
      return (
        <View testID={`item-ojisan-${item.id}`} style={[styles.base, styles.ojisan, rage && styles.ojisanRage, box]}>
          <Text style={[emojiText, styles.ojisanText]}>{item.text}</Text>
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
  ojisan: {
    borderRadius: 14,
    backgroundColor: lineColors.bubble,
    paddingHorizontal: OJISAN_PADDING_X,
    paddingVertical: OJISAN_PADDING_Y,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  ojisanRage: { backgroundColor: '#FFD9DE', borderColor: lineColors.danger, borderWidth: 2 },
  ojisanText: {
    fontSize: OJISAN_FONT_SIZE,
    lineHeight: OJISAN_LINE_HEIGHT,
    color: lineColors.bubbleText,
    fontWeight: '600',
  },
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
