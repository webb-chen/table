import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';

import { LicensePage } from './LicensePage';
import { useLicenseStatus } from './use-license-status';

/**
 * App-level license gate.
 *
 * - License pages themselves render normally (they are the recovery path).
 * - When the license is invalid, every page is replaced by the license panel.
 * - While the status request is in flight a lightweight splash is rendered so
 *   protected UI never flashes before verification completes.
 */
export function LicenseGate(props: PropsWithChildren) {
  const router = useRouter();
  const { status, loading, refresh } = useLicenseStatus();

  if (router.pathname === '/license') {
    return <>{props.children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (status?.valid) {
    return <>{props.children}</>;
  }

  return <LicensePage onActivated={() => void refresh()} />;
}
