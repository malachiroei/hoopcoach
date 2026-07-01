// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Bundle TFLite weights via require('./model.tflite') — must be in assetExts, not sourceExts.
const TFLITE_EXT = 'tflite';
if (!config.resolver.assetExts.includes(TFLITE_EXT)) {
  config.resolver.assetExts.push(TFLITE_EXT);
}
if (config.resolver.sourceExts.includes(TFLITE_EXT)) {
  config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== TFLITE_EXT);
}

module.exports = config;
