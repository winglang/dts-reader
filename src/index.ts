import fs from 'fs';
import path from 'path';
import { Parser } from './decl';

const dtsFile = process.argv[2];
if (!dtsFile) {
  console.error(`Usage: ${path.basename(process.argv[1])} <package-name>`);
  process.exit(1);
}

const parser = new Parser(dtsFile);
const types = parser.parse();

const outfile = `${path.basename(path.dirname(dtsFile))}.types.json`;

fs.writeFileSync(outfile, JSON.stringify(types, undefined, 2));

console.log(outfile);