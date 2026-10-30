export interface LicensePayload {
  license_id: string;
  product: string;
  product_display: string;
  customer: string;
  customer_contact: string;
  issued_at: string | null;
  expire_time: string | null;
  grace_days: number;
  machine_code: string;
  instance_id: string;
  features: Record<string, unknown>;
  permanent: boolean;
}

export interface LicenseStatus {
  code: string;
  valid: boolean;
  message: string;
  in_grace: boolean;
  remaining_days: number;
  checked_at: string;
  license: LicensePayload | null;
}

export interface MachineCodeResponse {
  code: string;
  valid: boolean;
  message: string;
  machine_code: string;
}

/** Status codes from the unified ULP vocabulary (format spec section 7). */
export const LICENSE_CODE_TITLES: Record<string, string> = {
  ok: 'License is valid',
  license_grace: 'License expired (grace period)',
  license_disabled: 'License verification is disabled',
  license_not_init: 'License module is not ready',
  license_missing: 'License file not found',
  license_malformed: 'License file is malformed',
  license_bad_signature: 'License signature verification failed',
  license_expired: 'License has expired',
  license_clock_rollback: 'System clock rollback detected',
  license_machine_mismatch: 'License is bound to another machine',
  license_product_mismatch: 'License belongs to another product',
  license_no_public_key: 'License public key is not configured',
};
