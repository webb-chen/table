export interface LicensePayload {
  schema_version: number;
  license_id: string;
  platform: string;
  product: string;
  product_display?: string;
  customer?: string;
  customer_contact?: string;
  issued_at?: string | null;
  expire_time?: string | null;
  grace_days: number;
  machine_code: string;
  instance_id?: string;
  features?: Record<string, unknown>;
  issued_by?: string;
  note?: string;
  /** Compatibility marker for legacy payloads without schema_version. */
  legacy?: boolean;
}

export interface LicenseStatus {
  code: string;
  valid: boolean;
  message: string;
  in_grace: boolean;
  remaining_days: number;
  checked_at: string;
  license: {
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
  } | null;
}

export type LicenseErrorCode =
  | 'license_not_init'
  | 'license_missing'
  | 'license_malformed'
  | 'license_bad_signature'
  | 'license_expired'
  | 'license_clock_rollback'
  | 'license_machine_mismatch'
  | 'license_product_mismatch'
  | 'license_no_public_key';
