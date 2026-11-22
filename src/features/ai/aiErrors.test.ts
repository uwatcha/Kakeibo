import {
  AI_BLOCKED,
  AI_EMPTY,
  AI_TRUNCATED,
  describeAiError,
} from '../../../supabase/functions/_shared/aiErrors';

const claude = (type: string, message: string) => JSON.stringify({ type: 'error', error: { type, message } });
const gemini = (status: string, message: string, details: object[] = []) =>
  JSON.stringify({ error: { code: 400, status, message, details } });

describe('describeAiError', () => {
  it('考えるだけで上限に届いた・断られた・空だった', () => {
    expect(describeAiError('Claude', AI_TRUNCATED).message).toContain('分ける');
    expect(describeAiError('Gemini', AI_BLOCKED).message).toContain('安全');
    expect(describeAiError('Claude', AI_EMPTY)).toMatchObject({ temporary: true });
  });

  it('会話が長すぎるときは、新しいチャットを勧める', () => {
    const e = describeAiError('Claude', 400, claude('invalid_request_error', 'prompt is too long: 1200000 tokens > 1000000 maximum'));
    expect(e.message).toContain('新しいチャット');
    expect(describeAiError('Gemini', 400, gemini('INVALID_ARGUMENT', 'The input token count exceeds the maximum')).message).toContain(
      '新しいチャット',
    );
  });

  it('Claude の残高不足は、入金かもう一方のモデルを勧める', () => {
    const e = describeAiError('Claude', 400, claude('invalid_request_error', 'Your credit balance is too low to access the Anthropic API.'));
    expect(e.message).toContain('Billing');
    expect(e.message).toContain('Gemini');
  });

  it('キーが使えないときは、作り直して入れ直すよう伝える', () => {
    expect(describeAiError('Claude', 401, claude('authentication_error', 'invalid x-api-key')).message).toContain('入れ直して');
    const g = describeAiError('Gemini', 400, gemini('INVALID_ARGUMENT', 'API key not valid.', [{ reason: 'API_KEY_INVALID' }]));
    expect(g.message).toContain('Google AI Studio');
  });

  it('使える量の上限: 1日分なら明日まで、短い時間なら1分待つ', () => {
    const daily = gemini('RESOURCE_EXHAUSTED', 'Quota exceeded', [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }]);
    expect(describeAiError('Gemini', 429, daily)).toMatchObject({ temporary: false });
    expect(describeAiError('Gemini', 429, daily).message).toContain('明日');
    expect(describeAiError('Claude', 429, claude('rate_limit_error', 'Number of requests has exceeded your per-minute rate limit')).message).toContain('1分');
  });

  it('混み合いは送り直す（Claude の 529 も）', () => {
    expect(describeAiError('Claude', 529, claude('overloaded_error', 'Overloaded'))).toMatchObject({ temporary: true });
    expect(describeAiError('Gemini', 503)).toMatchObject({ temporary: true });
  });

  it('モデルがない・権限がない・分からない失敗', () => {
    expect(describeAiError('Gemini', 404).message).toContain('ほかのモデル');
    expect(describeAiError('Claude', 403, claude('permission_error', 'not allowed')).message).toContain('権限');
    expect(describeAiError('Claude', 418).message).toContain('418');
  });
});
