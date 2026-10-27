import { TableNew } from '@teable/icons';
import { cn } from '@teable/ui-lib/shadcn';
import { useBrand } from '@/features/app/hooks/useBrand';

export const TableLogo = ({ className }: { className: string }) => {
  const { brandName, brandLogo } = useBrand();

  if (!brandLogo) {
    return <TableNew className={cn('text-black', className)} />;
  }

  return (
    <img
      src={brandLogo}
      alt={brandName}
      width={64}
      height={64}
      className={cn('size-6', className)}
    />
  );
};
