export default {
  extends: ["stylelint-config-standard-scss"],
  overrides: [
    {
      files: ["**/*.vue"],
      customSyntax: "postcss-html",
    },
  ],
};
