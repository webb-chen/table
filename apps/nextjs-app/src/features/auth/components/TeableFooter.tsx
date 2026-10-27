import { cn } from '@teable/ui-lib/shadcn';
import { TableLogo } from '@/components/TableLogo';
import { useBrand } from '@/features/app/hooks/useBrand';

interface ITableHeaderProps {
  className?: string;
  enableClick?: boolean;
}

export const TableFooter = (props: ITableHeaderProps) => {
  const { className, enableClick } = props;
  const { brandName } = useBrand();

  return (
    <div
      data-state={enableClick ? 'click' : undefined}
      className={cn(
        'max-w-6xl mx-auto w-full flex items-center justify-center gap-2 data-[state=click]:cursor-pointer font-bold',
        className
      )}
    >
      <TableLogo className="size-8 rounded-full" />
      {brandName}
    </div>
  );
};
