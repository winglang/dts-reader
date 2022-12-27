const { typescript, javascript } = require('projen');
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: 'main',
  name: 'bring-ts-research',
  packageManager: javascript.NodePackageManager.NPM,
  deps: ['typescript', '@jsii/spec'],
  devDeps: ['axios'],
  gitignore: ['.output'],
});
project.synth();