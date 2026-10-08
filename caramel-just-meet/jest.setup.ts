// AsyncStorage はネイティブモジュールなので、テストでは公式のモックに差し替える
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// SafeAreaProvider は端末の寸法が分かるまで何も描画しないので、テスト用の寸法を返すモックを使う
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// expo-audio はネイティブの音声機能なので、テストでは鳴らさずに呼び出しだけ記録する
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
    loop: false,
    volume: 1,
  })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

// expo-crypto の UUID はネイティブ機能なので、テストでは Node の crypto で作る
jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));
