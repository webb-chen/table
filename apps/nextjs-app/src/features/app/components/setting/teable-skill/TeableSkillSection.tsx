import { useTranslation } from 'next-i18next';
import { SettingTabShell } from '@/features/app/components/setting/SettingTabShell';
import { TableSkillContent } from './TableSkillContent';

export const TableSkillSection = () => {
  const { t } = useTranslation('common');

  return (
    <SettingTabShell title={t('settings.setting.teableSkill')}>
      <TableSkillContent showTitle={false} />
    </SettingTabShell>
  );
};
