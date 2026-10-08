// AsyncStorage はネイティブモジュールなので、テストでは公式のモックに差し替える
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// SafeAreaProvider は端末の寸法が分かるまで何も描画しないので、テスト用の寸法を返すモックを使う
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
