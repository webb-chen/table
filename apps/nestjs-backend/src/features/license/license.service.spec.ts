import crypto from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LicenseError, LicenseService } from './license.service';

const MACHINE_CODE = '00112233445566778899aabbccddeeff';

describe('LicenseService (ULP v1)', () => {
  let dir: string;
  let privateKey: KeyObject;
  let publicKeyPem: string;
  const originalEnv = {
    LICENSE_ENFORCE: process.env.LICENSE_ENFORCE,
    LICENSE_PUBLIC_KEY: process.env.LICENSE_PUBLIC_KEY,
    LICENSE_PATH: process.env.LICENSE_PATH,
    LICENSE_MACHINE_CODE: process.env.LICENSE_MACHINE_CODE,
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teable-license-'));
    const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = keyPair.privateKey;
    publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

    process.env.LICENSE_ENFORCE = 'true';
    process.env.LICENSE_PUBLIC_KEY = publicKeyPem;
    process.env.LICENSE_PATH = path.join(dir, 'license.lic');
    process.env.LICENSE_MACHINE_CODE = MACHINE_CODE;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function payload(overrides: Record<string, unknown> = {}) {
    const now = new Date();
    return {
      schema_version: 1,
      license_id: 'a'.repeat(32),
      platform: 'unified-license-platform',
      product: 'teable',
      customer: 'Acme',
      issued_at: now.toISOString(),
      expire_time: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      grace_days: 7,
      machine_code: '*',
      ...overrides,
    };
  }

  function sign(value: Record<string, unknown>): Buffer {
    const payloadBytes = Buffer.from(JSON.stringify(value));
    const signature = crypto.sign('RSA-SHA256', payloadBytes, privateKey);
    return Buffer.from(
      JSON.stringify({
        data: payloadBytes.toString('base64'),
        sign: signature.toString('base64'),
      })
    );
  }

  it('reports license_missing when no file exists', () => {
    const service = new LicenseService();
    expect(service.status().code).toBe('license_missing');
  });

  it('accepts a valid license and exposes the license view', () => {
    const service = new LicenseService();
    const status = service.install(sign(payload()));
    expect(status.valid).toBe(true);
    expect(status.code).toBe('ok');
    expect(status.license?.customer).toBe('Acme');
  });

  it('supports permanent licenses', () => {
    const service = new LicenseService();
    const status = service.install(sign(payload({ expire_time: null })));
    expect(status.valid).toBe(true);
    expect(status.remaining_days).toBe(-1);
    expect(status.license?.permanent).toBe(true);
  });

  it('keeps valid=true during the grace period', () => {
    const service = new LicenseService();
    const expired = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const status = service.install(sign(payload({ expire_time: expired, grace_days: 7 })));
    expect(status.code).toBe('license_grace');
    expect(status.valid).toBe(true);
    expect(status.in_grace).toBe(true);
  });

  it('rejects tampered payloads with license_bad_signature', () => {
    const service = new LicenseService();
    const envelope = JSON.parse(sign(payload()).toString()) as { data: string; sign: string };
    const payloadBytes = Buffer.from(envelope.data, 'base64').toString('utf8');
    envelope.data = Buffer.from(payloadBytes.replace('"machine_code":"*"', '"machine_code":"x"')).toString(
      'base64'
    );
    expect(() => service.install(Buffer.from(JSON.stringify(envelope)))).toThrowError(LicenseError);
  });

  it('rejects licenses for another product', () => {
    const service = new LicenseService();
    try {
      service.install(sign(payload({ product: 'other' })));
      throw new Error('expected rejection');
    } catch (error) {
      expect((error as LicenseError).code).toBe('license_product_mismatch');
    }
  });

  it('rejects licenses bound to another machine', () => {
    const service = new LicenseService();
    try {
      service.install(sign(payload({ machine_code: 'f'.repeat(32) })));
      throw new Error('expected rejection');
    } catch (error) {
      expect((error as LicenseError).code).toBe('license_machine_mismatch');
    }
  });

  it('treats an empty machine_code as malformed', () => {
    const service = new LicenseService();
    try {
      service.install(sign(payload({ machine_code: '' })));
      throw new Error('expected rejection');
    } catch (error) {
      expect((error as LicenseError).code).toBe('license_malformed');
    }
  });

  it('does not overwrite a valid license with an invalid upload', () => {
    const service = new LicenseService();
    const good = sign(payload());
    service.install(good);
    expect(() => service.install(Buffer.from('{"data":"bad","sign":"bad"}'))).toThrow();
    expect(fs.readFileSync(process.env.LICENSE_PATH as string).equals(good)).toBe(true);
  });

  it('detects a clock rollback from a valid checkpoint', () => {
    const service = new LicenseService();
    service.install(sign(payload()));
    const future = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const mac = crypto
      .createHmac('sha256', 'teable-license-clock-v1')
      .update(String(future))
      .digest('hex');
    fs.writeFileSync(path.join(dir, 'license-clock.dat'), `${future}|${mac}`);
    expect(service.reload().code).toBe('license_clock_rollback');
  });
});
