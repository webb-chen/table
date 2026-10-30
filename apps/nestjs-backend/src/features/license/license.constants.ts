/**
 * Unified License Platform (ULP) license constants.
 *
 * The product id must match the ULP project configuration exactly.
 */
export const LICENSE_PRODUCT = 'teable';
export const LICENSE_PLATFORM = 'unified-license-platform';
export const LICENSE_SCHEMA_VERSION = 1;
export const LICENSE_UNIVERSAL_MACHINE_CODE = '*';

export const LICENSE_CODE = {
  ok: 'ok',
  grace: 'license_grace',
  disabled: 'license_disabled',
  notInit: 'license_not_init',
  missing: 'license_missing',
  malformed: 'license_malformed',
  badSignature: 'license_bad_signature',
  expired: 'license_expired',
  clockRollback: 'license_clock_rollback',
  machineMismatch: 'license_machine_mismatch',
  productMismatch: 'license_product_mismatch',
  noPublicKey: 'license_no_public_key',
} as const;

export type LicenseCode = (typeof LICENSE_CODE)[keyof typeof LICENSE_CODE];

/** Embedded ULP public key for the `teable` project. Public keys are safe to ship. */
export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw3/FDyV/PT3sBVbvK6KJ
3muKoqbXrydJGNCzapAB8NOopFvZOlwPvyHrtN8SpLyNkVWMUlo5PVal04aj7T1q
ejTsJre/ukWQFuKkh8+HfWmMmcUweRWzJ/EXGVF7xUtUlmFUuigH5nJQfwiq1LLk
qf3PWuZ6GgY3+eVV/vxsh43bIF6j+rNdRA0WMUCgIV1FLKtVzKsEBdX8PjWLG8Qb
B58nzVRTFq2rqpHjIR+VSbeZYeyW/vrU6Plu8fz9pSAoGvtKa4QPZVk8Co012hs0
eHVFmhNbQpIxlaBLksenfyKtxI6W4xcLe0FMAHuZ6CzD+2blnaGKKfqS9mIym0Wd
aQIDAQAB
-----END PUBLIC KEY-----`;

export const LICENSE_PUBLIC_KEY_PLACEHOLDER = 'REPLACE_WITH_YOUR_PUBLIC_KEY';

/** Paths that require a valid license (business capabilities). */
export const LICENSE_GUARDED_PREFIXES = ['/api', '/sockjs'];

/** Paths that must stay reachable when the license is invalid (recovery). */
export const LICENSE_RECOVERY_PREFIXES = [
  '/api/license',
  '/api/health',
  '/api/auth',
  '/api/user',
  '/api/admin/auth',
  '/api/settings',
];

/** Filesystem locations. */
export const LICENSE_DEFAULT_PATH = './license.lic';
export const LICENSE_CLOCK_FILE = 'license-clock.dat';
export const LICENSE_CLOCK_TOLERANCE_MS = 10 * 60 * 1000;
export const LICENSE_MAX_FILE_BYTES = 1024 * 1024;
export const LICENSE_STATUS_TTL_MS = 5000;
export const LICENSE_CLOCK_SECRET = 'teable-license-clock-v1';
