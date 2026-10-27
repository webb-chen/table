import type { GetServerSideProps } from 'next';
import type { ReactElement } from 'react';
import { TableSkillPage } from '@/features/app/blocks/setting/teable-skill/TableSkillPage';
import { SettingLayout } from '@/features/app/layouts/SettingLayout';
import { settingConfig } from '@/features/i18n/setting.config';
import ensureLogin from '@/lib/ensureLogin';
import { getTranslationsProps } from '@/lib/i18n';
import type { NextPageWithLayout } from '@/lib/type';
import withEnv from '@/lib/withEnv';

const TableSkill: NextPageWithLayout = () => {
  return <TableSkillPage />;
};

export const getServerSideProps: GetServerSideProps = withEnv(
  ensureLogin(async (context) => {
    return {
      props: {
        ...(await getTranslationsProps(context, settingConfig.i18nNamespaces)),
      },
    };
  })
);

TableSkill.getLayout = function getLayout(page: ReactElement, pageProps) {
  return <SettingLayout {...pageProps}>{page}</SettingLayout>;
};

export default TableSkill;
