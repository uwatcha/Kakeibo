/**
 * Gmail で動かす Apps Script のコード（設定の「メールからの記録」から共有して、script.google.com に貼る）。
 * 10分ごとに、対象の送信元の未読メールの本文を Edge Function email-import に送り、受け付けられたものを既読にする。
 * 読み取り方と見る送信元はサーバー側にあるので、メールの形が変わっても・送信元を足しても、このコードは貼り直さなくてよい
 * （送信元の一覧をサーバーから受け取るようにしたのは 2026-10-24。それより前に貼ったものは一度だけ貼り直す）
 */
export const EMAIL_SENDERS = [
  'debit@example.com',
  'bank@example.com',
  'card@example.com',
  'electricity@example.com',
  'gas@example.com',
] as const;

export function buildAppsScript(endpoint: string, token: string): string {
  return `// 家計簿: メールからの記録（10分ごとに動く）
// 初めて貼ったら、上の関数の選択で「setup」を選んで「実行」し、Gmail を読む許可を出してください。
const ENDPOINT = '${endpoint}';
const TOKEN = '${token}';
const SENDERS = ${JSON.stringify(EMAIL_SENDERS)};

// 見る送信元は、サーバーの返事（senders）で新しくなる（送信元を足しても、このコードを貼り直さなくてよい）
function senders() {
  const saved = PropertiesService.getScriptProperties().getProperty('senders');
  return saved ? JSON.parse(saved) : SENDERS;
}

function run() {
  const query = 'is:unread newer_than:7d (' + senders().map(function (s) { return 'from:' + s; }).join(' OR ') + ')';
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
  const result = JSON.parse(res.getContentText());
  (result.accepted || []).forEach(function (id) {
    if (byId[id]) byId[id].markRead();
  });
  if (result.senders) PropertiesService.getScriptProperties().setProperty('senders', JSON.stringify(result.senders));
}

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('run').timeBased().everyMinutes(10).create();
  run();
}
`;
}
