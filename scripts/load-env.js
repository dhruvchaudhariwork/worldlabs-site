import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnvironment() {
  const argument = process.argv.find(value => value.startsWith('--env-file='));
  const file = resolve(argument ? argument.slice('--env-file='.length) : '.env.local');
  if (existsSync(file)) process.loadEnvFile(file);
}
