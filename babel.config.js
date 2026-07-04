module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Must be listed last — https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started
      'react-native-reanimated/plugin',
    ],
  };
};
