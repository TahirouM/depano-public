// Expo (SDK 52+) configure Metro automatiquement pour le monorepo pnpm :
// watchFolders et nodeModulesPaths sont déduits de la racine du workspace.
// Les paquets @depano/* sont consommés en source via la condition d'export « react-native ».
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
