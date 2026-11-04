// テストでも、使う人ごとに違う値（src/lib/personal.ts・supabase/functions/_shared/personal.ts）を .env.local から読む。
// .env.local がなければ（GitHub から取ってきたときなど）、コードに書いた仮の値でテストする
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), '.env.local');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}
