import Link from 'next/link';
import { Trans } from 'next-i18next';
import { TableLogo } from '@/components/TableLogo';
import { useBrand } from '@/features/app/hooks/useBrand';

export const BrandFooter = () => {
  const { brandName } = useBrand();

  return (
    <div className="flex w-full items-center justify-center">
      <span className="h-px w-16 bg-border" />
      <div className="mx-4 flex items-center gap-2 text-xs text-muted-foreground">
        {brandName.toLowerCase() === 'teable' ? (
          <Trans
            ns="common"
            i18nKey="poweredBy"
            components={[
              <Link
                key={'brandFooter'}
                href="https://www.webb.sale"
                target="_blank"
                className="flex items-center text-sm text-black dark:text-white"
              >
                <TableLogo className="text-xl" />
                <span className="ms-1 font-semibold">{brandName}</span>
              </Link>,
            ]}
          />
        ) : (
          <Link href="/" target="_blank" className="flex items-center">
            <TableLogo className="text-xl" />
            <span className="ms-1 font-semibold">{brandName}</span>
          </Link>
        )}
      </div>
      <span className="h-px w-16 bg-border" />
    </div>
  );
};
