// メールからの記録の、1人分の処理（読み取ったメールを email_imports に入れ、記録を足す）。
// DB や AI を呼ばない部分は _shared/emailParse.ts（メールの読み取り）と _shared/emailPayee.ts（内容・カテゴリの決め方）
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { type Bill, type EmailKind, isAtm, isDebitCardName, parseMail, SOURCE_OF } from '../_shared/emailParse.ts';
import {
  addDays,
  buildPayeePrompt,
  type PayeeCategory,
  payeeQuestions,
  type PayeeQuestion,
  type PayeeRule,
  readPayeeAnswers,
} from '../_shared/emailPayee.ts';
import { FALLBACK_MODEL, GeminiError, generateWithRetry, isTemporary, LIGHT_FALLBACK_MODEL } from '../_shared/gemini.ts';

export type Mail = { id: string; from: string; subject: string; date: string; body: string };

type ImportRow = {
  id: string;
  message_id: string;
  item_index: number;
  kind: EmailKind | null;
  date: string | null;
  amount: number | null;
  raw_payee: string | null;
  status: string;
  transaction_id: string | null;
};

/** 同じ利用とみなす日付の差（デビットカード と 連携サービス、予定との照らし合わせ） */
const MATCH_DAYS = 3;
/** 入金を給料の予定と照らし合わせる日付の差（手で入れた予定は休みの日の前倒しをしていないことがある） */
const SALARY_DAYS = 7;
/** 手入力との重複とみなす日付の差 */
const DUPLICATE_DAYS = 1;
/** 通知しない状態（ほかの記録と同じ利用・オフの種類・重複で「追加しない」） */
const SILENT = new Set(['merged', 'ignored', 'dismissed']);

const tokyoDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const tokyoToday = () => tokyoDate(new Date().toISOString());

/** 1人分の処理。db は service role（RLS を通らない）なので、すべての問い合わせで user_id を絞る */
export class Importer {
  private rules = new Map<string, PayeeRule>();
  private categories: PayeeCategory[] = [];
  private accounts = new Map<string, string | null>();
  private enabled = new Map<string, boolean>();
  /** ATM の引き出し・預け入れで振り替える現金の口座 */
  private atmCash: string | null = null;

  constructor(
    private db: SupabaseClient,
    private userId: string,
  ) {}

  async load() {
    const [rules, categories, sources, settings, cash] = await Promise.all([
      this.db.from('payee_rules').select('raw_payee, kind, payee, category_id').eq('user_id', this.userId),
      this.db.from('categories').select('id, name, kind, parent_id, is_archived').eq('user_id', this.userId),
      this.db.from('email_import_sources').select('source, enabled, account_id').eq('user_id', this.userId),
      this.db.from('email_import_settings').select('atm_cash_account_id').eq('user_id', this.userId).maybeSingle(),
      this.db
        .from('accounts')
        .select('id')
        .eq('user_id', this.userId)
        .eq('kind', 'cash')
        .eq('is_archived', false)
        .order('created_at')
        .limit(1),
    ]);
    this.atmCash = settings.data?.atm_cash_account_id ?? cash.data?.[0]?.id ?? null;
    for (const r of (rules.data ?? []) as PayeeRule[]) this.rules.set(r.raw_payee, r);
    this.categories = (categories.data ?? []) as PayeeCategory[];
    for (const s of sources.data ?? []) {
      this.accounts.set(s.source, s.account_id);
      this.enabled.set(s.source, s.enabled && !!s.account_id);
    }
  }

  /** 届いたメールを読み取って email_imports に入れる。既読にしてよいメールの id を返す */
  async ingest(mails: Mail[], startedAt: string | null): Promise<string[]> {
    const accepted: string[] = [];
    const ids = mails.map((m) => m.id);
    const { data: known } = await this.db
      .from('email_imports')
      .select('message_id')
      .eq('user_id', this.userId)
      .in('message_id', ids.length > 0 ? ids : ['-']);
    const seen = new Set((known ?? []).map((k) => k.message_id));
    for (const mail of mails) {
      if (seen.has(mail.id)) {
        accepted.push(mail.id);
        continue;
      }
      // 合言葉を作る前に届いたメールは読まない（過去のメールはさかのぼらない）。既読にもしない
      if (startedAt && new Date(mail.date) < new Date(startedAt)) continue;
      const parsed = parseMail(mail);
      const base = { user_id: this.userId, message_id: mail.id, received_at: mail.date };
      let rows: Record<string, unknown>[] = [];
      if (parsed.type === 'items') {
        rows = parsed.items.map((item, i) => ({
          ...base,
          item_index: i,
          kind: item.kind,
          date: item.date,
          amount: item.amount,
          raw_payee: item.rawPayee,
          status: this.enabled.get(SOURCE_OF[item.kind]) ? 'new' : 'ignored',
          notified: !this.enabled.get(SOURCE_OF[item.kind]),
        }));
      } else if (parsed.type === 'bill') {
        const plan = await this.applyBill(parsed.bill, mail.date);
        rows = [
          {
            ...base,
            kind: parsed.bill.kind,
            date: tokyoDate(mail.date),
            amount: parsed.bill.amount,
            status: 'bill',
            subject: parsed.bill.month ? `${Number(parsed.bill.month.slice(5, 7))}月分` : null,
            transaction_id: plan,
          },
        ];
      } else if (parsed.type === 'notice') {
        rows = [{ ...base, status: 'notice', subject: mail.subject.slice(0, 200) }];
      } else if (parsed.type === 'unreadable') {
        rows = [{ ...base, status: 'unreadable', subject: mail.subject.slice(0, 200) }];
      }
      if (rows.length > 0) {
        const { error } = await this.db.from('email_imports').insert(rows);
        if (error && !/duplicate key/.test(error.message)) throw error;
      }
      accepted.push(mail.id);
    }
    return accepted;
  }

  /**
   * 電気・ガスの請求: その定期支払い（名前に「電気」「ガス」を含むもの）の、まだ確認していない次の予定を探し、
   * 請求額が分かれば予定の金額をそれに直す（確認はしない。支払いはクレカ・口座振替の記録で入る）。見つけた予定の id を返す
   */
  private async applyBill(bill: Bill, receivedIso: string): Promise<string | null> {
    const word = bill.kind === 'electricity_bill' ? '電気' : 'ガス';
    const { data: rules } = await this.db
      .from('recurring_rules')
      .select('id')
      .eq('user_id', this.userId)
      .ilike('name', `%${word}%`);
    const ruleIds = (rules ?? []).map((r) => r.id as string);
    if (ruleIds.length === 0) return null;
    const { data: plans } = await this.db
      .from('transactions')
      .select('id, amount')
      .eq('user_id', this.userId)
      .in('recurring_rule_id', ruleIds)
      .eq('is_confirmed', false)
      .gte('date', addDays(tokyoDate(receivedIso), -7))
      .order('date')
      .limit(1);
    const plan = plans?.[0];
    if (!plan) return null;
    if (bill.amount !== null && plan.amount !== bill.amount) {
      const { error } = await this.db
        .from('transactions')
        .update({ amount: bill.amount })
        .eq('id', plan.id)
        .eq('user_id', this.userId);
      if (error) throw error;
    }
    return plan.id as string;
  }

  /** 待ち（new・AI 待ち）を処理する。force は「重複の可能性」から追加するときの id */
  async process(force?: string) {
    const { data } = await this.db
      .from('email_imports')
      .select('id, message_id, item_index, kind, date, amount, raw_payee, status, transaction_id')
      .eq('user_id', this.userId)
      .in('status', force ? ['duplicate'] : ['new', 'pending_ai'])
      .order('date')
      .order('created_at');
    const rows = ((data ?? []) as ImportRow[]).filter((r) => !force || r.id === force);
    if (rows.length === 0) return;

    // 対応表にない利用先は、まとめて AI に決めてもらう。混み合いならその行は待ちにする
    // ATM は振替にするので、内容を AI に聞かない
    const unknown = payeeQuestions(
      rows.filter((r) => !isAtm(r.raw_payee)),
      new Set(this.rules.keys()),
    );
    let aiBusy = false;
    if (unknown.length > 0) aiBusy = !(await this.askAi(unknown));

    for (const row of rows) {
      const needsAi = row.raw_payee && !this.rules.has(row.raw_payee) && !this.unknownToAi.has(row.raw_payee);
      if (aiBusy && needsAi && unknown.some((u) => u.raw === row.raw_payee)) {
        if (row.status !== 'pending_ai') await this.setStatus(row.id, 'pending_ai');
        continue;
      }
      await this.handle(row, !!force);
    }
  }

  /** AI が「分からない」とした利用先（内容は読みやすくしたカタカナのまま、自分で入れてもらう） */
  private unknownToAi = new Map<string, { payee: string; categoryId: string | null }>();

  /** AI に内容とカテゴリを決めてもらい、分かったものは対応表に入れる。混み合いで決められなければ false */
  private async askAi(items: PayeeQuestion[]): Promise<boolean> {
    const { data: ai } = await this.db.from('ai_settings').select('gemini_api_key, model').eq('user_id', this.userId).maybeSingle();
    const { data: settings } = await this.db
      .from('email_import_settings')
      .select('summary_rules')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (!ai?.gemini_api_key) {
      // AI を使えないときは、分からないものとして自分で入れてもらう
      for (const i of items) this.unknownToAi.set(i.raw, { payee: i.raw, categoryId: null });
      return true;
    }
    const system = buildPayeePrompt(settings?.summary_rules, this.categories, [...this.rules.values()]);
    const question = JSON.stringify(items);
    const candidates = [...new Set([ai.model ?? FALLBACK_MODEL, LIGHT_FALLBACK_MODEL, FALLBACK_MODEL])];
    let out;
    for (const model of candidates) {
      try {
        out = await generateWithRetry(ai.gemini_api_key, model, system, [{ role: 'user', text: question }], true);
        await this.db.from('ai_usage').insert({
          user_id: this.userId,
          model,
          prompt_tokens: out.usageMetadata?.promptTokenCount ?? 0,
          output_tokens: out.usageMetadata?.candidatesTokenCount ?? 0,
        });
        break;
      } catch (e) {
        if (!(e instanceof GeminiError)) throw e;
        if (e.status === 429 || isTemporary(e.status) || e.status === 404) continue;
        // キーが使えないなど: 分からないものとして自分で入れてもらう
        for (const i of items) this.unknownToAi.set(i.raw, { payee: i.raw, categoryId: null });
        return true;
      }
    }
    if (!out) return false;
    const text = (out.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    for (const answer of readPayeeAnswers(text, items, this.categories)) {
      if (answer.known) {
        const rule: PayeeRule = {
          raw_payee: answer.raw,
          kind: items.find((i) => i.raw === answer.raw)!.kind,
          payee: answer.payee,
          category_id: answer.categoryId,
        };
        this.rules.set(answer.raw, rule);
        await this.db
          .from('payee_rules')
          .upsert({ user_id: this.userId, ...rule, learned_from: 'ai', updated_at: new Date().toISOString() });
      } else {
        this.unknownToAi.set(answer.raw, { payee: answer.payee, categoryId: answer.categoryId });
      }
    }
    return true;
  }

  /** 利用先から内容・カテゴリを決める（対応表 → AI の結果）。分からなければ needsPayee */
  private resolve(raw: string | null): { payee: string | null; categoryId: string | null; needsPayee: boolean } {
    if (!raw) return { payee: null, categoryId: null, needsPayee: false };
    const rule = this.rules.get(raw);
    if (rule) return { payee: rule.payee ?? raw, categoryId: rule.category_id, needsPayee: false };
    const unknown = this.unknownToAi.get(raw);
    return { payee: unknown?.payee ?? raw, categoryId: unknown?.categoryId ?? null, needsPayee: true };
  }

  private async setStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
    await this.db
      .from('email_imports')
      .update({ status, notified: SILENT.has(status), ...extra })
      .eq('id', id)
      .eq('user_id', this.userId);
  }

  /**
   * 入金に当たる給料の予定: 同じ口座に入る、まだ確認していない収入の予定で、自動で入れた給料（auto_salary）か
   * 働き先（収入元）が付いているもの。日付が前後 SALARY_DAYS 日以内で、金額が同じもの → 日付が近いものの順に選ぶ
   */
  private async salaryPlan(account: string, row: ImportRow): Promise<string | null> {
    const { data } = await this.db
      .from('transactions')
      .select('id, date, amount, auto_salary, employer_id')
      .eq('user_id', this.userId)
      .eq('type', 'income')
      .eq('to_account_id', account)
      .eq('is_confirmed', false)
      .or('auto_salary.eq.true,employer_id.not.is.null')
      .gte('date', addDays(row.date!, -SALARY_DAYS))
      .lte('date', addDays(row.date!, SALARY_DAYS));
    const gap = (d: string) => Math.abs(new Date(d).getTime() - new Date(row.date!).getTime());
    const best = [...(data ?? [])].sort(
      (a, b) => Number(b.amount === row.amount) - Number(a.amount === row.amount) || gap(a.date) - gap(b.date),
    )[0];
    return (best?.id as string | undefined) ?? null;
  }

  /** 手入力の記録で、同じ口座・同じ金額・日付が前後1日以内のもの */
  private async manualDuplicate(side: 'from_account_id' | 'to_account_id', account: string, row: ImportRow) {
    const { data } = await this.db
      .from('transactions')
      .select('id')
      .eq('user_id', this.userId)
      .eq(side, account)
      .eq('amount', row.amount!)
      .is('auto_source', null)
      .gte('date', addDays(row.date!, -DUPLICATE_DAYS))
      .lte('date', addDays(row.date!, DUPLICATE_DAYS))
      .limit(1);
    return data?.[0]?.id as string | undefined;
  }

  /** ほかのメールで記録済みの同じ利用（kinds のメールで、まだほかの行と結び付いていない記録） */
  private async sameUse(kinds: EmailKind[], row: ImportRow, days: number, filter?: (r: ImportRow) => boolean) {
    const { data } = await this.db
      .from('email_imports')
      .select('id, message_id, item_index, kind, date, amount, raw_payee, status, transaction_id')
      .eq('user_id', this.userId)
      .in('kind', kinds)
      .eq('status', 'recorded')
      .eq('amount', row.amount!)
      .gte('date', addDays(row.date!, -days))
      .lte('date', addDays(row.date!, days))
      .not('transaction_id', 'is', null);
    for (const candidate of ((data ?? []) as ImportRow[]).filter((r) => !filter || filter(r))) {
      const { count } = await this.db
        .from('email_imports')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('status', 'merged')
        .eq('transaction_id', candidate.transaction_id!);
      if (!count) return candidate;
    }
    return undefined;
  }

  private async insert(row: ImportRow, values: Record<string, unknown>) {
    const { data, error } = await this.db
      .from('transactions')
      .insert({
        user_id: this.userId,
        date: row.date,
        amount: row.amount,
        auto_source: 'email',
        auto_reviewed: false,
        is_confirmed: row.date! <= tokyoToday(),
        ...values,
      })
      .select('id')
      .single();
    if (error) throw error;
    await this.setStatus(row.id, 'recorded', { transaction_id: data.id });
  }

  private async fill(transactionId: string, raw: string | null) {
    const r = this.resolve(raw);
    await this.db
      .from('transactions')
      .update({ payee: r.payee, category_id: r.categoryId, raw_payee: raw, needs_payee: r.needsPayee })
      .eq('id', transactionId)
      .eq('user_id', this.userId);
  }

  private async handle(row: ImportRow, force: boolean) {
    if (!row.kind || !row.date || !row.amount) return;
    const account = this.accounts.get(SOURCE_OF[row.kind]);
    if (!account || !this.enabled.get(SOURCE_OF[row.kind])) {
      await this.setStatus(row.id, 'ignored');
      return;
    }
    const duplicate = async (side: 'from_account_id' | 'to_account_id') => {
      if (force) return false;
      const id = await this.manualDuplicate(side, account, row);
      if (id) await this.setStatus(row.id, 'duplicate', { duplicate_of: id });
      return !!id;
    };
    const expense = (r: { payee: string | null; categoryId: string | null; needsPayee: boolean }) =>
      this.insert(row, {
        type: 'expense',
        from_account_id: account,
        payee: r.payee,
        category_id: r.categoryId,
        raw_payee: row.raw_payee,
        needs_payee: r.needsPayee,
      });

    switch (row.kind) {
      case 'debit_mail': {
        // 連携サービス の「サンプルデビット」で先に入れた記録があれば、そこに店名を入れる
        const bankMail = await this.sameUse(['bank_out'], row, MATCH_DAYS, (r) => isDebitCardName(r.raw_payee));
        if (bankMail) {
          await this.fill(bankMail.transaction_id!, row.raw_payee);
          await this.setStatus(row.id, 'merged', { transaction_id: bankMail.transaction_id });
          return;
        }
        if (await duplicate('from_account_id')) return;
        await expense(this.resolve(row.raw_payee));
        return;
      }
      case 'bank_out': {
        if (isDebitCardName(row.raw_payee)) {
          const debitMail = await this.sameUse(['debit_mail'], row, MATCH_DAYS);
          if (debitMail) {
            await this.setStatus(row.id, 'merged', { transaction_id: debitMail.transaction_id });
            return;
          }
          if (await duplicate('from_account_id')) return;
          await this.insert(row, { type: 'expense', from_account_id: account, payee: 'サンプルデビット' });
          return;
        }
        // ATM の引き出しは、銀行 → 現金の振替
        if (isAtm(row.raw_payee) && this.atmCash) {
          if (await duplicate('from_account_id')) return;
          await this.insert(row, { type: 'transfer', from_account_id: account, to_account_id: this.atmCash, payee: 'ATM' });
          return;
        }
        // 未確認の予定（定期支払い・クレカの引き落としなど）があれば、それを確認済みにする
        const { data: plans } = await this.db
          .from('transactions')
          .select('id')
          .eq('user_id', this.userId)
          .eq('from_account_id', account)
          .eq('amount', row.amount)
          .eq('is_confirmed', false)
          .gte('date', addDays(row.date, -MATCH_DAYS))
          .lte('date', addDays(row.date, MATCH_DAYS))
          .order('date')
          .limit(1);
        if (plans?.[0]) {
          await this.db.from('transactions').update({ is_confirmed: true }).eq('id', plans[0].id).eq('user_id', this.userId);
          await this.setStatus(row.id, 'confirmed_plan', { transaction_id: plans[0].id });
          return;
        }
        if (await duplicate('from_account_id')) return;
        await expense(this.resolve(row.raw_payee));
        return;
      }
      case 'bank_in': {
        // ATM の預け入れは、現金 → 銀行の振替
        if (isAtm(row.raw_payee) && this.atmCash) {
          if (await duplicate('to_account_id')) return;
          await this.insert(row, { type: 'transfer', from_account_id: this.atmCash, to_account_id: account, payee: 'ATM' });
          return;
        }
        // 給料の予定（自動で入れたもの・働き先を付けて手で入れたもの）があれば、実際の額・日付に直して確認済みにする
        const salary = await this.salaryPlan(account, row);
        if (salary) {
          await this.db
            .from('transactions')
            .update({ amount: row.amount, date: row.date, is_confirmed: true })
            .eq('id', salary)
            .eq('user_id', this.userId);
          await this.setStatus(row.id, 'confirmed_plan', { transaction_id: salary });
          return;
        }
        if (await duplicate('to_account_id')) return;
        const r = this.resolve(row.raw_payee);
        await this.insert(row, {
          type: 'income',
          to_account_id: account,
          payee: r.payee,
          category_id: r.categoryId,
          raw_payee: row.raw_payee,
          needs_payee: r.needsPayee,
        });
        return;
      }
      case 'card_quick': {
        if (await duplicate('from_account_id')) return;
        // 店名は後から届く詳細のメールで入れる
        await this.insert(row, { type: 'expense', from_account_id: account });
        return;
      }
      case 'card_detail': {
        const quick = await this.sameUse(['card_quick'], row, 0);
        if (quick) {
          await this.fill(quick.transaction_id!, row.raw_payee);
          await this.setStatus(row.id, 'merged', { transaction_id: quick.transaction_id });
          return;
        }
        if (await duplicate('from_account_id')) return;
        await expense(this.resolve(row.raw_payee));
        return;
      }
    }
  }
}

