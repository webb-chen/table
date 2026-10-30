import { useCallback, useEffect, useState } from 'react';

import type { LicenseStatus, MachineCodeResponse } from './license-types';

interface LicenseStatusState {
  status: LicenseStatus | null;
  machineCode: string;
  loading: boolean;
  error: string | null;
}

async function fetchStatus(): Promise<LicenseStatus> {
  const response = await fetch('/api/license/status', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`license status request failed: ${response.status}`);
  }
  return (await response.json()) as LicenseStatus;
}

async function fetchMachineCode(): Promise<string> {
  const response = await fetch('/api/license/machine-code', { cache: 'no-store' });
  if (!response.ok) return '';
  const data = (await response.json()) as MachineCodeResponse;
  return data.machine_code ?? '';
}

export function useLicenseStatus() {
  const [state, setState] = useState<LicenseStatusState>({
    status: null,
    machineCode: '',
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const [status, machineCode] = await Promise.all([fetchStatus(), fetchMachineCode()]);
      setState({ status, machineCode, loading: false, error: null });
      return status;
    } catch (error) {
      setState({
        status: null,
        machineCode: '',
        loading: false,
        error: (error as Error).message,
      });
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}

export async function reloadLicense(): Promise<LicenseStatus> {
  const response = await fetch('/api/license/reload', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`license reload failed: ${response.status}`);
  }
  return (await response.json()) as LicenseStatus;
}

export async function uploadLicense(file: File): Promise<LicenseStatus> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/license/upload', { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(`license upload failed: ${response.status}`);
  }
  return (await response.json()) as LicenseStatus;
}
