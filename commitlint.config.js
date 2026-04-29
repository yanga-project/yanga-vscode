module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => /\[skip ci\]/.test(message)],
};
