// 明細の照らし合わせの画面を描いてみる（React Compiler を通す。jest.config.js）
/* eslint-disable import/first -- jest.mock は import より先に置く */
import { renderAndCheck } from './helpers';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-file-system', () => ({ File: class {} }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ accountId: 'bank' }),
}));
const mockAccounts = {
  data: [
    { id: 'bank', name: '銀行', kind: 'bank', is_archived: false },
    { id: 'pay', name: '電子マネー', kind: 'emoney', is_archived: false },
    { id: 'friend', name: '友だち', kind: 'receivable', is_archived: false },
  ],
};
jest.mock('@/features/accounts/hooks', () => ({ useAccounts: () => mockAccounts }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isError: false }) }));

import ReconcileScreen from '@/app/reconcile';

it('明細の照らし合わせの画面', async () => {
  expect(await renderAndCheck(<ReconcileScreen />)).toEqual([]);
});
