import {
  createHash,
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify as verifySignature,
  type KeyObject,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { hostname, networkInterfaces } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import {
  LICENSE_CLOCK_FILE,
  LICENSE_CLOCK_SECRET,
  LICENSE_CLOCK_TOLERANCE_MS,
  LICENSE_CODE,
  LICENSE_DEFAULT_PATH,
  LICENSE_PLATFORM,
  LICENSE_PRODUCT,
  LICENSE_PUBLIC_KEY,
  LICENSE_PUBLIC_KEY_PLACEHOLDER,
  LICENSE_SCHEMA_VERSION,
  LICENSE_STATUS_TTL_MS,
  LICENSE_UNIVERSAL_MACHINE_CODE,
} from './license.constants';
import type { LicensePayload, LicenseStatus } from './license.types';

export class LicenseError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'LicenseError';
  }
}

interface Envelope {
  data?: unknown;
  sign?: unknown;
}

const NOW = () => Date.now();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Strict standard base64 decode: invalid alphabets/padding are malformed input. */
function decodeBase64(value: string): Buffer {
  const normalized = value.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new LicenseError(LICENSE_CODE.malformed, '授权内容或签名不是合法的 base64');
  }
  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.length === 0) {
    throw new LicenseError(LICENSE_CODE.malformed, '授权内容或签名解码为空');
  }
  return decoded;
}

function resolveEnforce(): boolean {
  const value = (process.env.LICENSE_ENFORCE ?? '').trim().toLowerCase();
  return !['false', '0', 'off', 'no'].includes(value);
}

function resolveLicensePath(): string {
  const configured = (process.env.LICENSE_PATH ?? '').trim() || LICENSE_DEFAULT_PATH;
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
}

/**
 * Offline license verification for the Unified License Platform (ULP) v1 format.
 *
 * - Only the public key is embedded; signing happens exclusively in the ULP.
 * - The signature is verified against the **raw bytes** of base64-decoded `data`,
 *   never against a re-serialized JSON object.
 * - Invalid licenses never fail open: initialization errors make the app refuse
 *   to start, and runtime failures return 403/503 with a unified code.
 */
@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly enforce: boolean;
  private readonly licensePath: string;
  private readonly clockPath: string;
  private readonly publicKey: KeyObject | null = null;
  private cached: LicenseStatus | null = null;
  private cachedAt = 0;
  private machineCodeCache: string | null = null;

  constructor() {
    this.enforce = resolveEnforce();
    this.licensePath = resolveLicensePath();
    this.clockPath = join(dirname(this.licensePath), LICENSE_CLOCK_FILE);

    if (!this.enforce) {
      this.logger.warn(
        'LICENSE_ENFORCE=false: offline license verification is disabled (development only)'
      );
      return;
    }

    const publicKeyPem = (process.env.LICENSE_PUBLIC_KEY ?? '').trim() || LICENSE_PUBLIC_KEY;
    if (!publicKeyPem || publicKeyPem.includes(LICENSE_PUBLIC_KEY_PLACEHOLDER)) {
      throw new Error(`license_no_public_key: 内置公钥未配置`);
    }
    try {
      this.publicKey = createPublicKey(publicKeyPem);
    } catch (error) {
      throw new Error(`license_no_public_key: 解析内置公钥失败: ${(error as Error).message}`);
    }

    mkdirSync(dirname(this.licensePath), { recursive: true });
    this.status(true);
  }

  /** Current license status (cached for a few seconds). */
  status(force = false): LicenseStatus {
    if (!this.enforce) {
      return {
        code: LICENSE_CODE.disabled,
        valid: true,
        message: '授权校验已关闭（LICENSE_ENFORCE=false），仅供本地开发使用',
        in_grace: false,
        remaining_days: 0,
        checked_at: new Date().toISOString(),
        license: null,
      };
    }
    const now = NOW();
    if (!force && this.cached && now - this.cachedAt < LICENSE_STATUS_TTL_MS) {
      return this.cached;
    }
    const status = this.evaluateFile();
    this.cached = status;
    this.cachedAt = now;
    return status;
  }

  /** Force a re-read of the license file. */
  reload(): LicenseStatus {
    return this.status(true);
  }

  /**
   * Validate then install a new license file.
   * Invalid input throws before touching the existing (possibly valid) file.
   */
  install(content: Buffer): LicenseStatus {
    if (!this.enforce) {
      throw new LicenseError(LICENSE_CODE.disabled, '授权校验未启用');
    }
    const status = this.evaluateBuffer(content, new Date(), false);
    if (!status.valid) {
      throw new LicenseError(status.code, status.message);
    }

    if (existsSync(this.licensePath)) {
      try {
        const previous = readFileSync(this.licensePath);
        if (previous.length > 0) {
          writeFileSync(`${this.licensePath}.bak`, previous, { mode: 0o600 });
        }
      } catch {
        // A failed backup must not block replacing a license that is already invalid.
      }
    }

    mkdirSync(dirname(this.licensePath), { recursive: true });
    const tmp = `${this.licensePath}.tmp`;
    writeFileSync(tmp, content, { mode: 0o600 });
    renameSync(tmp, this.licensePath);
    return this.status(true);
  }

  /** Unified machine code: sha256("ULP-LICENSE-V1:" + raw) first 16 bytes, lowercase hex. */
  machineCode(): string {
    const override = (process.env.LICENSE_MACHINE_CODE ?? '').trim();
    if (override) return override;
    if (this.machineCodeCache) return this.machineCodeCache;

    const raw = this.rawMachineIdentity();
    this.machineCodeCache = createHash('sha256')
      .update(`ULP-LICENSE-V1:${raw}`)
      .digest('hex')
      .slice(0, 32);
    return this.machineCodeCache;
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------
  private evaluateFile(): LicenseStatus {
    const now = new Date();
    if (!existsSync(this.licensePath)) {
      return this.failure(LICENSE_CODE.missing, '未找到授权文件，请在授权管理页上传授权文件', now);
    }
    try {
      const text = readFileSync(this.licensePath, 'utf8');
      return this.evaluate(text, now, true);
    } catch (error) {
      return this.failure(
        LICENSE_CODE.malformed,
        `读取授权文件失败: ${(error as Error).message}`,
        now
      );
    }
  }

  private evaluateBuffer(content: Buffer, now: Date, checkClock: boolean): LicenseStatus {
    try {
      return this.evaluate(content.toString('utf8'), now, checkClock);
    } catch (error) {
      const code = error instanceof LicenseError ? error.code : LICENSE_CODE.malformed;
      return this.failure(code, (error as Error).message, now);
    }
  }

  private evaluate(text: string, now: Date, checkClock: boolean): LicenseStatus {
    let payload: LicensePayload;
    try {
      payload = this.verify(text);
    } catch (error) {
      const code = error instanceof LicenseError ? error.code : LICENSE_CODE.malformed;
      return this.failure(code, (error as Error).message, now);
    }

    if (checkClock) {
      const rollback = this.checkClock(now.getTime());
      if (rollback) {
        return {
          ...this.failure(LICENSE_CODE.clockRollback, rollback, now),
          license: this.licenseView(payload),
        };
      }
    }

    if (payload.expire_time == null) {
      return {
        code: LICENSE_CODE.ok,
        valid: true,
        message: '授权有效（永久授权）',
        in_grace: false,
        remaining_days: -1,
        checked_at: now.toISOString(),
        license: this.licenseView(payload),
      };
    }

    const expireMs = Date.parse(payload.expire_time);
    if (Number.isNaN(expireMs)) {
      return this.failure(LICENSE_CODE.malformed, '授权到期时间格式无效', now);
    }
    const remainingMs = expireMs - now.getTime();
    const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
    if (remainingMs > 0) {
      return {
        code: LICENSE_CODE.ok,
        valid: true,
        message: `授权有效，到期时间 ${new Date(expireMs).toLocaleString()}`,
        in_grace: false,
        remaining_days: remainingDays,
        checked_at: now.toISOString(),
        license: this.licenseView(payload),
      };
    }

    const graceMs = Math.max(0, payload.grace_days) * 24 * 60 * 60 * 1000;
    if (payload.grace_days > 0 && -remainingMs <= graceMs) {
      return {
        code: LICENSE_CODE.grace,
        valid: true,
        message: `授权已于 ${new Date(expireMs).toLocaleString()} 到期，当前处于 ${
          payload.grace_days
        } 天宽限期，请尽快续期`,
        in_grace: true,
        remaining_days: remainingDays,
        checked_at: now.toISOString(),
        license: this.licenseView(payload),
      };
    }

    return {
      code: LICENSE_CODE.expired,
      valid: false,
      message: `授权已于 ${new Date(expireMs).toLocaleString()} 到期，系统功能已停用，请上传新的授权文件`,
      in_grace: false,
      remaining_days: remainingDays,
      checked_at: now.toISOString(),
      license: this.licenseView(payload),
    };
  }

  /** Decode envelope → verify raw bytes → parse payload → validate business fields. */
  private verify(text: string): LicensePayload {
    if (!this.publicKey) {
      throw new LicenseError(LICENSE_CODE.noPublicKey, '内置公钥未配置，无法校验授权');
    }

    let envelope: Envelope;
    try {
      envelope = JSON.parse(text) as Envelope;
    } catch {
      throw new LicenseError(
        LICENSE_CODE.malformed,
        '授权文件格式错误，请确认上传的是 .lic 授权文件'
      );
    }
    if (!isRecord(envelope)) {
      throw new LicenseError(LICENSE_CODE.malformed, '授权文件外层结构错误');
    }
    if (typeof envelope.data !== 'string' || envelope.data.trim() === '') {
      throw new LicenseError(LICENSE_CODE.malformed, '授权文件缺少 data 字段');
    }
    if (typeof envelope.sign !== 'string' || envelope.sign.trim() === '') {
      throw new LicenseError(LICENSE_CODE.malformed, '授权文件缺少 sign 字段');
    }

    const payloadBytes = decodeBase64(envelope.data);
    const signature = decodeBase64(envelope.sign);

    // ★ Invariant 1: verify the raw decoded bytes, never a re-serialized object.
    const signed = verifySignature('RSA-SHA256', payloadBytes, this.publicKey, signature);
    if (!signed) {
      throw new LicenseError(
        LICENSE_CODE.badSignature,
        '授权文件签名校验失败，文件可能已被篡改或非统一授权平台签发'
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(payloadBytes.toString('utf8'));
    } catch {
      throw new LicenseError(LICENSE_CODE.malformed, '授权载荷 JSON 解析失败');
    }
    if (!isRecord(raw)) {
      throw new LicenseError(LICENSE_CODE.malformed, '授权载荷结构错误');
    }

    const payload: LicensePayload = {
      schema_version: Number(raw.schema_version ?? 0),
      license_id: String(raw.license_id ?? ''),
      platform: String(raw.platform ?? ''),
      product: String(raw.product ?? ''),
      product_display: String(raw.product_display ?? ''),
      customer: String(raw.customer ?? ''),
      customer_contact: String(raw.customer_contact ?? ''),
      issued_at: typeof raw.issued_at === 'string' ? raw.issued_at : null,
      expire_time: typeof raw.expire_time === 'string' ? raw.expire_time : null,
      grace_days: Math.max(0, Number(raw.grace_days ?? 0) || 0),
      machine_code: String(raw.machine_code ?? ''),
      instance_id: String(raw.instance_id ?? ''),
      features: isRecord(raw.features) ? raw.features : {},
      issued_by: String(raw.issued_by ?? ''),
      note: String(raw.note ?? ''),
    };

    // Legacy payloads (no schema_version) are accepted read-only during migration.
    if (payload.schema_version === 0) {
      payload.legacy = true;
      if (!payload.machine_code.trim()) {
        payload.machine_code = LICENSE_UNIVERSAL_MACHINE_CODE;
      }
      return payload;
    }
    if (payload.schema_version !== LICENSE_SCHEMA_VERSION) {
      throw new LicenseError(
        LICENSE_CODE.malformed,
        `不支持的授权文件版本 schema_version=${payload.schema_version}`
      );
    }
    if (payload.platform !== LICENSE_PLATFORM) {
      throw new LicenseError(
        LICENSE_CODE.productMismatch,
        '授权签发方标识不匹配，非统一授权平台签发的文件'
      );
    }
    if (payload.product !== LICENSE_PRODUCT) {
      throw new LicenseError(
        LICENSE_CODE.productMismatch,
        `授权文件属于产品 "${payload.product}"，与当前程序产品 "${LICENSE_PRODUCT}" 不符`
      );
    }
    if (!payload.machine_code.trim()) {
      throw new LicenseError(
        LICENSE_CODE.malformed,
        '授权文件缺少 machine_code 字段（通用授权必须显式写 "*"）'
      );
    }
    if (payload.machine_code !== LICENSE_UNIVERSAL_MACHINE_CODE) {
      if (payload.machine_code !== this.machineCode()) {
        throw new LicenseError(
          LICENSE_CODE.machineMismatch,
          '授权文件绑定了其他机器，与本机机器码不匹配'
        );
      }
    }
    return payload;
  }

  private checkClock(nowMs: number): string | null {
    const last = this.readClock();
    if (last != null && nowMs + LICENSE_CLOCK_TOLERANCE_MS < last) {
      return `检测到系统时间被回拨（上次校验时间 ${new Date(
        last
      ).toLocaleString()}），授权校验失败`;
    }
    if (last == null || nowMs > last) {
      this.writeClock(nowMs);
    }
    return null;
  }

  private readClock(): number | null {
    try {
      const raw = readFileSync(this.clockPath, 'utf8').trim();
      const [secondsText, mac] = raw.split('|', 2);
      const seconds = Number(secondsText);
      if (!Number.isFinite(seconds) || !mac) return null;
      const expected = createHmac('sha256', LICENSE_CLOCK_SECRET)
        .update(String(Math.trunc(seconds)))
        .digest();
      const actual = Buffer.from(mac, 'hex');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        // Tampered checkpoint: treat as no baseline instead of a false rollback.
        return null;
      }
      return Math.trunc(seconds) * 1000;
    } catch {
      return null;
    }
  }

  private writeClock(nowMs: number): void {
    const seconds = Math.trunc(nowMs / 1000);
    const mac = createHmac('sha256', LICENSE_CLOCK_SECRET)
      .update(String(seconds))
      .digest('hex');
    try {
      mkdirSync(dirname(this.clockPath), { recursive: true });
      writeFileSync(this.clockPath, `${seconds}|${mac}`, { mode: 0o600 });
    } catch {
      // Clock checkpoint is best-effort; a write failure must not break requests.
    }
  }

  private rawMachineIdentity(): string {
    for (const candidate of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try {
        const value = readFileSync(candidate, 'utf8').trim();
        if (value) return value;
      } catch {
        // try next source
      }
    }
    const host = hostname().trim();
    if (host) return host;
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses ?? []) {
        if (!address.internal && address.mac && address.mac !== '00:00:00:00:00:00') {
          return address.mac;
        }
      }
    }
    return 'unknown';
  }

  private failure(code: string, message: string, now: Date): LicenseStatus {
    return {
      code,
      valid: false,
      message,
      in_grace: false,
      remaining_days: 0,
      checked_at: now.toISOString(),
      license: null,
    };
  }

  private licenseView(payload: LicensePayload): LicenseStatus['license'] {
    return {
      license_id: payload.license_id,
      product: payload.product,
      product_display: payload.product_display ?? '',
      customer: payload.customer ?? '',
      customer_contact: payload.customer_contact ?? '',
      issued_at: payload.issued_at ?? null,
      expire_time: payload.expire_time ?? null,
      grace_days: payload.grace_days,
      machine_code: payload.machine_code,
      instance_id: payload.instance_id ?? '',
      features: payload.features ?? {},
      permanent: payload.expire_time == null,
    };
  }
}
