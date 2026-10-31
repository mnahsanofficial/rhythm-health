/* global __dirname */
// SDK 58 detects npm workspaces; no legacy watchFolders/resolver overrides needed.
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
