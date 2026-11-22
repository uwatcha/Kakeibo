// AI（Gemini・Claude）の失敗を見分けて、「何が起きたか」と「どうすればよいか」の文にする（ai-chat で使う）。
// Deno の機能を使わないので、アプリのテスト（src/features/ai/aiErrors.test.ts）からも読める

/** 返事の文を書く前に上限に届いた（考えるだけで使い切った） */
export const AI_TRUNCATED = 422;
/** 安全のための決まりで、返事を断られた */
export const AI_BLOCKED = 451;
/** 理由は分からないが、返事が空だった */
export const AI_EMPTY = 424;

export type AiProviderName = 'Gemini' | 'Claude';

export type DescribedError = {
  message: string;
  /** 少し待てば通るかもしれない（アプリが自動で送り直す） */
  temporary: boolean;
};

/** 混み合い・一時的な障害。Claude の 529（overloaded）も含む */
export const isTemporaryStatus = (status: number) => status === 529 || (status >= 500 && status <= 504);

/** エラーの本文（JSON）から、理由の手がかりになる文字をまとめて小文字で取り出す */
function clues(detail: string): string {
  try {
    const body = JSON.parse(detail) as {
      error?: { type?: string; message?: string; status?: string; details?: { reason?: string; quotaId?: string }[] };
    };
    const e = body.error ?? {};
    return [e.type, e.message, e.status, ...(e.details ?? []).flatMap((d) => [d.reason, d.quotaId])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  } catch {
    return detail.toLowerCase();
  }
}

const KEY_PAGE: Record<AiProviderName, string> = {
  Gemini: 'Google AI Studio',
  Claude: 'Anthropic Console',
};

/** 状態コードとエラーの本文から、利用者に見せる文を作る */
export function describeAiError(provider: AiProviderName, status: number, detail = ''): DescribedError {
  const c = clues(detail);
  const fixed = (message: string): DescribedError => ({ message, temporary: false });
  const other = provider === 'Claude' ? 'Gemini' : 'Claude';

  if (status === AI_TRUNCATED) {
    return fixed(
      `${provider} が考えることが多く、返事を書く前に1回の上限に届きました。質問をいくつかに分けるか、もう一度送ってください`,
    );
  }
  if (status === AI_BLOCKED) {
    return fixed(
      `${provider} の安全のための決まりで、返事を断られました。言い回しを変えるか、新しいチャットで聞き直してください`,
    );
  }
  if (status === AI_EMPTY) {
    return { message: `${provider} から空の返事が返りました。もう一度送ってください`, temporary: true };
  }

  // 会話・添付が長すぎる（モデルが一度に読める量を超えた）
  if (
    status === 413 ||
    /prompt is too long|too many tokens|exceeds the maximum|input token count|request_too_large|request too large/.test(c)
  ) {
    return fixed(
      'この会話が長くなり、AI が一度に読める量を超えました。右上のペンのアイコンから新しいチャットを始めてください（添付があるときは、枚数を減らすか小さくしてください）',
    );
  }
  // Claude の前払いの残高が尽きた
  if (/credit balance|billing|insufficient|payment/.test(c) && provider === 'Claude') {
    return fixed(
      `Claude の利用残高（クレジット）が足りません。${KEY_PAGE.Claude} の Billing で入金するか、設定で ${other} のモデルを選んでください`,
    );
  }
  // キーが違う・期限切れ・取り消された
  if (status === 401 || /api_key_invalid|api key not valid|invalid x-api-key|authentication_error|expired/.test(c)) {
    return fixed(
      provider === 'Claude'
        ? `Claude の API キーが使えません（期限切れか、取り消されています）。${KEY_PAGE.Claude} で新しいキーを作り、設定の「AI 相談の設定」で入れ直してください`
        : `Gemini の API キーが使えません（間違っているか、取り消されています）。${KEY_PAGE.Gemini} でキーを確かめ、設定の「AI 相談の設定」で入れ直してください`,
    );
  }
  // 使える地域・無料枠の条件に合わない（Gemini）
  if (/failed_precondition|user location is not supported|free tier is not available/.test(c)) {
    return fixed(
      `今の条件では ${provider} を使えません（地域や無料枠の条件）。${KEY_PAGE[provider]} で設定を確かめるか、設定で ${other} のモデルを選んでください`,
    );
  }
  // キーにこの機能・モデルを使う権限がない
  if (status === 403 || /permission_denied|permission_error/.test(c)) {
    return fixed(
      `${provider} の API キーに、このモデルを使う権限がありません。${KEY_PAGE[provider]} でキーの権限を確かめるか、設定でほかのモデルを選んでください`,
    );
  }
  // 使える量の上限
  if (status === 429 || /resource_exhausted|rate_limit_error|quota/.test(c)) {
    if (/perday|per_day|per day|daily/.test(c)) {
      return fixed(
        `${provider} の1日に使える量の上限に達しました。明日（日本時間の午後4〜5時ごろに戻ります）まで待つか、設定で ${other} のモデルを選んでください`,
      );
    }
    return fixed(`${provider} の短い時間に使える量の上限に達しました。1分ほど待ってから送ってください`);
  }
  if (status === 404 || /not_found/.test(c)) {
    return fixed('選んでいるモデルは使えなくなりました。設定の「AI 相談の設定」でほかのモデルを選んでください');
  }
  if (isTemporaryStatus(status)) {
    return { message: `${provider} が混み合っているか、一時的に止まっています。少し待ってから送ってください`, temporary: true };
  }
  if (status === 400) {
    return fixed(
      `${provider} に送った内容を受け付けてもらえませんでした（${status}）。新しいチャットで送り直すか、設定でほかのモデルを選んでください`,
    );
  }
  return {
    message: `${provider} から思いがけない返事がありました（${status}）。少し待ってから送り直し、続くときは設定でほかのモデルを選んでください`,
    temporary: false,
  };
}
