import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { AdBanner } from '../src/components/AdBanner';
import { config, hasAdsense } from '../src/config';

const PUB = 'ca-pub-1234567890123456';

describe('広告（AdSense）', () => {
  const realOS = Platform.OS;
  const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  const realClient = config.adsenseClient;
  afterEach(() => {
    setOS(realOS);
    config.adsenseClient = realClient;
  });

  it('パブリッシャー ID の形が正しいときだけ広告を出す設定になる', () => {
    config.adsenseClient = PUB;
    expect(hasAdsense()).toBe(true);
    config.adsenseClient = 'pub-1234567890123456';
    expect(hasAdsense()).toBe(false);
    config.adsenseClient = '';
    expect(hasAdsense()).toBe(false);
  });

  it('AdSense の設定がなければ、何も出さない', async () => {
    setOS('web');
    config.adsenseClient = '';
    await render(<AdBanner slot="1111111111" />);
    expect(screen.queryByTestId('ad-banner')).toBeNull();
  });

  it('アプリ版（ブラウザ以外）では出さない', async () => {
    setOS('ios');
    config.adsenseClient = PUB;
    await render(<AdBanner slot="1111111111" />);
    expect(screen.queryByTestId('ad-banner')).toBeNull();
  });

  it('広告ユニットの ID がない場所には出さない', async () => {
    setOS('web');
    config.adsenseClient = PUB;
    await render(<AdBanner slot="" />);
    expect(screen.queryByTestId('ad-banner')).toBeNull();
  });

  it('設定があるブラウザ版では「広告」と表示して枠を出す', async () => {
    setOS('web');
    config.adsenseClient = PUB;
    await render(<AdBanner slot="1111111111" />);
    expect(screen.getByTestId('ad-banner')).toBeTruthy();
    expect(screen.getByText('広告')).toBeTruthy();
  });
});
