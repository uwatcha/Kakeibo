// 写真からの記録の設定画面を描いてみる（React Compiler を通す。jest.config.js）
/* eslint-disable import/first -- jest.mock は import より先に置く */
import { act } from 'react-test-renderer';

import { renderAndCheck } from './helpers';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async () => JSON.stringify({ enabled: true, since: 1, processed: [], lastRunAt: 1792700000000 }),
  setItem: async () => undefined,
}));
jest.mock('expo-media-library/legacy', () => ({}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('@/features/background/backgroundTask', () => ({ startBackgroundTask: jest.fn() }));
jest.mock('expo-router', () => {
  const Stack = function Stack() {
    return null;
  };
  Stack.Screen = function Screen() {
    return null;
  };
  return { router: { push: jest.fn() }, Stack };
});
const mockStatus = { data: { hasKey: false, model: null, models: [] }, error: null, refetch: jest.fn() };
jest.mock('@/features/ai/hooks', () => ({ useAiStatus: () => mockStatus }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));

import PhotoImportScreen from '@/app/photo-import';

it('写真からの記録の設定画面', async () => {
  const problems = await renderAndCheck(<PhotoImportScreen />);
  // 設定を読み終えるのを待つ
  await act(async () => undefined);
  expect(problems).toEqual([]);
});
