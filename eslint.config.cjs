const vue = require("eslint-plugin-vue");
const tseslint = require("typescript-eslint");

module.exports = [
  {
    ignores: [
      "dist/**",
      "server/dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...vue.configs["flat/essential"],
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: [".vue"],
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ["**/*.{js,cjs,mjs,vue}"],
    rules: {
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
      "vue/multi-word-component-names": "off",
      "vue/no-reserved-component-names": "off",
    },
  },
];
