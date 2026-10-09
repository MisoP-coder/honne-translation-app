import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { config, hasAdsense } from '../config';
import { colors } from '../theme/colors';

/** 広告の大きさ。スマホ用の横長バナー（320×50）。画面の邪魔をしない一番小さい形 */
export const AD_WIDTH = 320;
export const AD_HEIGHT = 50;

interface Props {
  /** AdSense で作った広告ユニットの ID。空なら何も出さない */
  slot: string;
  /** 表示までの待ち時間（ミリ秒）。直前まで連打していた指が、出てきた広告を誤って押さないように */
  delayMs?: number;
  testID?: string;
}

type AdsQueue = { push: (v: object) => void };

/**
 * Google AdSense のバナー広告（ブラウザ版だけ）。
 * - AdSense の設定（EXPO_PUBLIC_ADSENSE_CLIENT と広告ユニットの ID）がないときは何も出さない
 * - 広告の読み込みスクリプトは、ビルド後に index.html に入れている（scripts/postbuild-web.mjs）
 * - 誤って押されないよう、「広告」と表示し、まわりに余白を取る
 */
export function AdBanner({ slot, delayMs = 0, testID = 'ad-banner' }: Props) {
  const enabled = Platform.OS === 'web' && hasAdsense() && /^\d{6,20}$/.test(slot);
  const [visible, setVisible] = useState(delayMs <= 0);
  const holder = useRef<View>(null);

  useEffect(() => {
    if (!enabled || visible) return;
    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [enabled, visible, delayMs]);

  useEffect(() => {
    if (!enabled || !visible || typeof document === 'undefined') return;
    // react-native-web では View の ref がそのまま DOM の要素になる
    const node = holder.current as unknown as HTMLElement | null;
    if (!node || typeof node.appendChild !== 'function') return;
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'inline-block';
    ins.style.width = `${AD_WIDTH}px`;
    ins.style.height = `${AD_HEIGHT}px`;
    ins.setAttribute('data-ad-client', config.adsenseClient);
    ins.setAttribute('data-ad-slot', slot);
    node.appendChild(ins);
    try {
      const w = window as unknown as { adsbygoogle?: AdsQueue | object[] };
      w.adsbygoogle = w.adsbygoogle ?? [];
      (w.adsbygoogle as AdsQueue).push({});
    } catch {
      // 広告ブロッカーなどで読み込めなくても、ゲームは止めない
    }
    return () => {
      ins.remove();
    };
  }, [enabled, visible, slot]);

  if (!enabled) return null;
  return (
    <View style={styles.wrap} testID={testID} pointerEvents="box-none">
      <Text style={styles.label}>広告</Text>
      <View ref={holder} style={styles.slot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 16, flexShrink: 0 },
  label: { fontSize: 10, color: colors.textSub, marginBottom: 2 },
  slot: { width: AD_WIDTH, height: AD_HEIGHT, maxWidth: '100%', overflow: 'hidden' },
});
