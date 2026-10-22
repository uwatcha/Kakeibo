/**
 * Gmail で動かす Apps Script のコード（設定の「メールからの記録」から共有して、script.google.com に貼る）。
 * 10分ごとに、対象の送信元の未読メールの本文を Edge Function email-import に送り、受け付けられたものを既読にする。
 * 読み取り方はサーバー側にあるので、メールの形が変わってもこのコードは貼り直さなくてよい
 */
export const EMAIL_SENDERS = ['debit@example.com', 'bank@example.com', 'card@example.com'] as const;

export function buildAppsScript(endpoint: string, token: string): string {
  return `// 家計簿: メールからの記録（10分ごとに動く）
// 初めて貼ったら、上の関数の選択で「setup」を選んで「実行」し、Gmail を読む許可を出してください。
const ENDPOINT = '${endpoint}';
const TOKEN = '${token}';
const SENDERS = ${JSON.stringify(EMAIL_SENDERS)};

function run() {
  const query = 'is:unread newer_than:7d (' + SENDERS.map(function (s) { return 'from:' + s; }).join(' OR ') + ')';
  const byId = {};
  const messages = [];
  GmailApp.search(query, 0, 50).forEach(function (thread) {
    thread.getMessages().forEach(function (m) {
      if (!m.isUnread()) return;
      byId[m.getId()] = m;
      messages.push({
        id: m.getId(),
        from: m.getFrom(),
        subject: m.getSubject(),
        date: m.getDate().toISOString(),
        body: m.getPlainBody().slice(0, 20000),
      });
    });
  });
  // メールがなくても送る（AI の混み合いで待ちになっていた分を、サーバーが処理し直す）
  const res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ token: TOKEN, messages: messages }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    console.error(res.getResponseCode() + ' ' + res.getContentText());
    return;
  }
  (JSON.parse(res.getContentText()).accepted || []).forEach(function (id) {
    if (byId[id]) byId[id].markRead();
  });
}

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('run').timeBased().everyMinutes(10).create();
  run();
}
`;
}
