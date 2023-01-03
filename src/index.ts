import fs from 'fs';
import path from 'path';
import { Parser } from './parser';

const dtsFile = process.argv[2];
if (!dtsFile) {
  console.error(`Usage: ${path.basename(process.argv[1])} <d.ts-file>`);
  process.exit(1);
}

const parser = new Parser(dtsFile);
const types = parser.parseSource();

const outdir = '.output';

fs.mkdirSync(outdir, { recursive: true });

const outfile = path.join(outdir, `${path.basename(path.dirname(dtsFile))}.types.json`);

fs.writeFileSync(outfile, JSON.stringify(types, undefined, 2));

console.log(outfile);