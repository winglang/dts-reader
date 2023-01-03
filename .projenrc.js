const { typescript, javascript } = require('projen');
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: 'main',
  name: 'dts-reader',
  description: 'Reads .d.ts files and generates a JSON representation of the API',
  packageManager: javascript.NodePackageManager.NPM,
  deps: ['typescript', '@jsii/spec'],
  devDeps: ['axios'],
  license: 'MIT',
  copyrightOwner: 'Monada, Inc.',
  gitignore: ['.output'],
});
project.synth();