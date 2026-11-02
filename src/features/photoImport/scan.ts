import * as MediaLibrary from 'expo-media-library/legacy';

import { fetchAccountBalances, fetchAccounts } from '@/features/accounts/api';
import { buildAliases } from '@/features/ai/anonymize';
import { AiError, extractRecords } from '@/features/ai/api';
import { assignPaymentAccounts, extractPrompt, markDuplicates, toDrafts } from '@/features/ai/extract';
import { toJpegBase64 } from '@/features/ai/image';
import { defaultCashAccount, matchPaymentAccount, matchStoreAccount } from '@/features/ai/payment';
import { fetchCategories } from '@/features/categories/api';
import { fetchEmailImportSettings } from '@/features/emailImport/api';
import { fetchDateAmountsBetween, saveTransactionItems } from '@/features/transactions/api';
import { isConfirmedOnSave } from '@/features/transactions/confirmation';
import { addDays, toTokyoDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';

import { PHOTO_PROMPT_EXTRA, planPhotoRecords } from './plan';
import { loadPhotoImportState, savePhotoImportState } from './settings';

/** 1回に AI に見せる写真の数（無料枠を使いすぎないよう。残りは次に確かめるとき） */
const MAX_PER_RUN = 8;
/** 見るアルバム（カメラで撮った写真とスクリーンショット。LINE などで受け取った画像は見ない） */
const TARGET_ALBUM = /camera|screenshot|スクリーンショット|カメラ/i;

export type ScanResult = { checked: number; recorded: number; duplicates: number; waiting: boolean };

/** 新しい写真（since より後に撮ったもの）を、撮った順に */
async function newPhotos(since: number, processed: ReadonlySet<string>): Promise<MediaLibrary.Asset[]> {
  const albums = (await MediaLibrary.getAlbumsAsync()).filter((a) => TARGET_ALBUM.test(a.title));
  const found: MediaLibrary.Asset[] = [];
  for (const album of albums) {
    const page = await MediaLibrary.getAssetsAsync({
      album,
      mediaType: MediaLibrary.MediaType.photo,
      createdAfter: since,
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
      first: 50,
    });
    found.push(...page.assets);
  }
  return found
    .filter((a) => !processed.has(a.id))
    .sort((a, b) => a.creationTime - b.creationTime)
    .slice(0, MAX_PER_RUN);
}

type PhotoContext = Awaited<ReturnType<typeof loadPhotoContext>>;

/** 写真を読み取るときの材料（口座・カテゴリ・AI への指示）。何枚読んでも1回だけ作る */
export async function loadPhotoContext() {
  const today = toTokyoDateString();
  const [accounts, balances, categories, settings] = await Promise.all([
    fetchAccounts(),
    fetchAccountBalances(),
    fetchCategories(),
    // 設定の「自動入力のルール」（自分で書いたもの）も AI に渡す。読めなくても続ける
    fetchEmailImportSettings().catch(() => null),
  ]);
  const aliases = buildAliases({
    today,
    accounts: balances.filter((a) => !a.isArchived),
    categories,
    employers: [],
    transactions: [],
    rules: [],
  });
  const prompt = `${extractPrompt(
    today,
    accounts.map((a) => ({ id: a.id, kind: a.kind, isArchived: a.is_archived, isReserved: a.is_reserved })),
    categories,
    aliases,
    settings?.summary_rules ?? null,
  )}\n${PHOTO_PROMPT_EXTRA}`;
  const cash = defaultCashAccount(accounts);
  return { today, accounts, categories, aliases, prompt, cash };
}

export type PhotoRecordResult = {
  recorded: number;
  duplicates: number;
  /** 記録した・重複だった1件目（ウィジェットから撮ったときに知らせる） */
  first: { status: 'recorded' | 'duplicate'; payee: string | null; amount: number } | null;
};

/**
 * 写真（base64 の JPEG）1枚を AI に読み取らせ、レシート・決済画面・値段の表示なら支払いとして記録する
 * （重なっていそうなものは記録せず「重複」に回す）。sourceKey は同じ写真を2回入れないための名前。
 * AI が混み合っていれば AiError（temporary）を投げる
 */
export async function recordPhoto(
  context: PhotoContext,
  data: string,
  sourceKey: string,
  takenAt: number,
): Promise<PhotoRecordResult> {
  const { today, accounts, categories, aliases, prompt, cash } = context;
  const result: PhotoRecordResult = { recorded: 0, duplicates: 0, first: null };
  const { records } = await extractRecords(prompt, '', [{ mimeType: 'image/jpeg', data }]);
  const found = toDrafts(records, accounts, categories, aliases);
  if (found.length === 0) return result;
  const dates = found.map((d) => d.date).sort();
  const existing = await fetchDateAmountsBetween(addDays(dates[0], -1), addDays(dates[dates.length - 1], 1));
  const drafts = assignPaymentAccounts(
    markDuplicates(found, existing),
    (payment) => matchPaymentAccount(payment, accounts),
    cash,
    (payee) => matchStoreAccount(payee, accounts),
  );
  for (const [index, { draft, status }] of planPhotoRecords(drafts, cash).entries()) {
    let transactionId: string | null = null;
    if (status === 'recorded') {
      const { data: inserted, error } = await supabase
        .from('transactions')
        .insert({
          type: 'expense',
          amount: draft.amount,
          date: draft.date,
          payee: draft.payee,
          category_id: draft.categoryId,
          from_account_id: draft.fromAccountId,
          auto_source: 'photo',
          auto_reviewed: false,
          is_confirmed: isConfirmedOnSave(draft.date, today),
        })
        .select('id')
        .single();
      if (error) throw error;
      transactionId = inserted.id;
      // レシートの品目の内訳（品目ごとのカテゴリと、合計との差の割引・調整の行）
      if (draft.items?.length) await saveTransactionItems(inserted.id, draft.items);
      result.recorded += 1;
    } else {
      result.duplicates += 1;
    }
    result.first ??= { status, payee: draft.payee, amount: draft.amount };
    const { error } = await supabase.from('email_imports').insert({
      message_id: sourceKey,
      item_index: index,
      kind: 'photo',
      date: draft.date,
      amount: draft.amount,
      raw_payee: draft.payee,
      payee: draft.payee,
      account_id: draft.fromAccountId,
      category_id: draft.categoryId,
      status,
      subject: draft.note,
      transaction_id: transactionId,
      duplicate_of: status === 'duplicate' ? (draft.duplicateOf ?? null) : null,
      received_at: new Date(takenAt).toISOString(),
    });
    if (error && !/duplicate key/.test(error.message)) throw error;
  }
  return result;
}

/**
 * 写真からの記録（2026-10-23 ユーザーの要望。Google フォトは外のアプリから読めなくなったので、バックアップの元の
 * スマホの写真を見る）: 新しい写真を AI（AI入力と同じ読み取り）に見せ、レシート・決済完了の画面・自販機の値段の表示なら
 * 支払いとして記録する。重なっていそうなものは記録せず「重複」に回す。記録と重複は email_imports に入れ、通知はメールと同じ。
 * AI が混み合っていたら、そこで止めて次に確かめるときに続きから
 */
export async function scanNewPhotos(): Promise<ScanResult | null> {
  const state = await loadPhotoImportState();
  if (!state.enabled) return null;
  if (!(await MediaLibrary.getPermissionsAsync(false, ['photo'])).granted) return null;
  const processed = new Set(state.processed);
  const photos = await newPhotos(state.since, processed);
  const result: ScanResult = { checked: 0, recorded: 0, duplicates: 0, waiting: false };
  if (photos.length === 0) {
    await savePhotoImportState({ ...state, lastRunAt: Date.now() });
    return result;
  }

  const context = await loadPhotoContext();

  let since = state.since;
  for (const photo of photos) {
    try {
      const data = await toJpegBase64(photo.uri, photo.width);
      const counts = await recordPhoto(context, data, `photo:${photo.id}`, photo.creationTime);
      result.recorded += counts.recorded;
      result.duplicates += counts.duplicates;
    } catch (e) {
      // AI の混み合い・通信の失敗: ここで止めて、次に確かめるときにこの写真から続ける
      if (e instanceof AiError && e.temporary) {
        result.waiting = true;
        break;
      }
      // それ以外（写真を読めない・AI に断られた）は、この写真は飛ばす
    }
    processed.add(photo.id);
    since = Math.max(since, photo.creationTime - 1);
    result.checked += 1;
    await savePhotoImportState({ ...state, since, processed: [...processed], lastRunAt: Date.now() });
  }
  await savePhotoImportState({ ...state, since, processed: [...processed], lastRunAt: Date.now() });
  return result;
}

/** 使い始める（今より後に撮った写真から見る）。写真を読む許可がなければ求める。許可されなければ false */
export async function enablePhotoImport(): Promise<boolean> {
  const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  if (!permission.granted) return false;
  const state = await loadPhotoImportState();
  await savePhotoImportState({ ...state, enabled: true, since: state.since || Date.now() });
  return true;
}

export async function disablePhotoImport(): Promise<void> {
  const state = await loadPhotoImportState();
  await savePhotoImportState({ ...state, enabled: false });
}
