import { Buffer as NodeBuffer } from 'node:buffer';
import { createRequire } from 'node:module';

// Test suites boot modules without an installed license file; enforcement is
// covered by dedicated license tests. Production defaults to LICENSE_ENFORCE=true.
process.env.LICENSE_ENFORCE = process.env.LICENSE_ENFORCE ?? 'false';

const require = createRequire(import.meta.url);
const bufferModule = require('node:buffer') as { Buffer: typeof NodeBuffer; SlowBuffer?: unknown };
bufferModule.SlowBuffer ??= bufferModule.Buffer ?? NodeBuffer;
