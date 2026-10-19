// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions は Deno で動くので、アプリの設定では見ない
    ignores: ['dist/*', '.expo/*', 'supabase/functions/*'],
  },
]);
