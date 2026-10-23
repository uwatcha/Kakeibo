// jest-expo の設定に、アプリと同じく React Compiler を通す指定を足す。
// React Compiler は書き方によって、描画のたびに読む値を変える（例: クロージャの中の `x!.y` を描画時に読む）。
// テストでもアプリと同じ変換をしないと、実機でだけ落ちる不具合を見逃す（2026-10-23 記録の入力画面が落ちた件）
const preset = require('jest-expo/jest-preset');

const transform = Object.fromEntries(
  Object.entries(preset.transform).map(([pattern, value]) =>
    Array.isArray(value) && value[0] === 'babel-jest'
      ? [pattern, ['babel-jest', { ...value[1], caller: { ...value[1].caller, supportsReactCompiler: true } }]]
      : [pattern, value],
  ),
);

module.exports = { ...preset, transform };
