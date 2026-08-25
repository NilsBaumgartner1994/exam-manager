const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pdf-lib (es-Build) importiert "tslib", dessen ESM-Einstieg
// (tslib/modules/index.js) unter Metro bricht ("Cannot destructure
// '__extends' of 'tslib.default'"). Deshalb tslib immer auf die
// CJS-Variante auflösen.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') {
    // tslib 1.x hat keine "./package.json"-Export-Subpath, daher fester Pfad
    // relativ zum Workspace-Root.
    return {
      type: 'sourceFile',
      filePath: path.join(__dirname, '..', '..', 'node_modules', 'tslib', 'tslib.js'),
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
