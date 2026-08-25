// Basis-URL nur beim Export für GitHub Pages setzen:
//   EXPO_BASE_URL=/exam-manager npx expo export --platform web
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_BASE_URL ?? '',
  },
});
