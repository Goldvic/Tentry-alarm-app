module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
      // react-native-reanimated/plugin is NOT included — this project
      // doesn't use Reanimated, and the plugin must be last if it's ever
      // added later.
    ],
  };
};
