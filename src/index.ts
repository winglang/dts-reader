import fs from 'fs';
import path from 'path';
import { Parser } from './decl';

const packageName = process.argv[2];
if (!packageName) {
  throw new Error('No package specified');
}

const dir = require.resolve(`${packageName}/package.json`);
const pkg = JSON.parse(fs.readFileSync(dir, 'utf8'));
const filepath = path.join(path.dirname(dir), pkg.types);
const parser = new Parser(filepath);
const types = parser.parse();

fs.writeFileSync(`${path.basename(packageName)}.types.json`, JSON.stringify(types, undefined, 2));

