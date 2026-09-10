import { readFile } from 'node:fs/promises';
import { evaluateRequiredProviderProtocols } from './provider-protocol-gate.ts';

const path = process.argv[2];
if (!path) throw new TypeError('provider screen evidence path is required');

const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
const result = evaluateRequiredProviderProtocols(parsed);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.pass) process.exitCode = 1;
