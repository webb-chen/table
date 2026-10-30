#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const metaDatabaseUrl =
  process.env.PRISMA_META_DATABASE_URL ??
  process.env.PRISMA_DATABASE_URL ??
  process.env.DATABASE_URL;

const extraEnv = metaDatabaseUrl
  ? {
      ...process.env,
      PRISMA_DATABASE_URL: metaDatabaseUrl,
    }
  : process.env;

// Prefer the workspace-local Prisma CLI so runtime never depends on pnpm/corepack
// (corepack tries to fetch the pnpm binary over the network, which hangs offline).
const localPrismaBin = path.resolve(process.cwd(), 'node_modules/.bin/prisma');
const args = process.argv.slice(2);

let result;
if (existsSync(localPrismaBin)) {
  // Sonar S4036: fixed workspace-relative path, not resolved through PATH.
  result = spawnSync(localPrismaBin, args, { stdio: 'inherit', env: extraEnv });
} else {
  result = spawnSync('pnpm', ['prisma', ...args], {
    stdio: 'inherit',
    env: extraEnv,
    shell: process.platform === 'win32',
  });
}

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
