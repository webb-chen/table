import { Button } from '@teable/ui-lib/shadcn';
import { useTranslation } from 'next-i18next';
import { useRef, useState } from 'react';

import { reloadLicense, uploadLicense, useLicenseStatus } from './use-license-status';

interface LicensePageProps {
  /** Called after a successful upload/reload so the app can continue booting. */
  onActivated?: () => void;
}

function formatExpire(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function LicensePage(props: LicensePageProps) {
  const { t } = useTranslation('common');
  const { status, machineCode, loading, error, refresh } = useLicenseStatus();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<string>('');

  const current = status;
  const license = current?.license ?? null;
  const valid = current?.valid ?? false;

  async function handleFile(file: File) {
    setUploading(true);
    setFeedback('');
    try {
      const result = await uploadLicense(file);
      if (result.valid) {
        await refresh();
        props.onActivated?.();
      } else {
        setFeedback(result.message || t('license.uploadFailed'));
      }
    } catch (uploadError) {
      setFeedback((uploadError as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRecheck() {
    setChecking(true);
    setFeedback('');
    try {
      const result = await reloadLicense();
      await refresh();
      if (result.valid) {
        props.onActivated?.();
      } else {
        setFeedback(result.message || t('license.uploadFailed'));
      }
    } catch (reloadError) {
      setFeedback((reloadError as Error).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">
            {valid ? t('license.validTitle') : loading ? t('license.checking') : t('license.required')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? t('license.checkingDescription')
              : current?.message || t('license.description')}
          </p>
          {current?.code ? (
            <p className="font-mono text-xs text-muted-foreground">{current.code}</p>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-6 h-24 animate-pulse rounded-md bg-muted" />
        ) : (
          <>
            {(license || error) && (
              <dl className="mt-6 grid grid-cols-[96px_1fr] gap-x-4 gap-y-1 rounded-md bg-muted/50 p-4 text-sm">
                <dt className="text-muted-foreground">{t('license.product')}</dt>
                <dd>{license?.product_display || license?.product || '—'}</dd>
                <dt className="text-muted-foreground">{t('license.customer')}</dt>
                <dd>{license?.customer || '—'}</dd>
                <dt className="text-muted-foreground">{t('license.expireTime')}</dt>
                <dd>
                  {license?.permanent
                    ? t('license.permanent')
                    : formatExpire(license?.expire_time) || '—'}
                </dd>
                <dt className="text-muted-foreground">{t('license.machineCode')}</dt>
                <dd className="break-all font-mono text-xs">
                  {machineCode || license?.machine_code || '—'}
                </dd>
              </dl>
            )}

            {error ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {t('license.networkError')}
              </p>
            ) : null}

            <div className="mt-6 space-y-3">
              <label className="block text-sm font-medium" htmlFor="license-file">
                {t('license.uploadLabel')}
              </label>
              <input
                ref={inputRef}
                id="license-file"
                type="file"
                accept=".lic,application/json"
                className="block w-full cursor-pointer rounded-md border bg-background px-3 py-2 text-sm"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <p className="text-xs text-muted-foreground">{t('license.uploadHint')}</p>
            </div>

            {feedback ? (
              <p className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {feedback}
              </p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={checking}
                onClick={() => void handleRecheck()}
              >
                {checking ? t('license.checking') : t('license.recheck')}
              </Button>
              {valid ? (
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    window.location.href = '/';
                  }}
                >
                  {t('license.enter')}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
