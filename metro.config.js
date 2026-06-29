// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Bundle TFLite model files as static assets (no ESM / experimental resolver flags)
config.resolver.assetExts.push('tflite');

module.exports = config;
