import { Button } from '@/shared/components/ui/button';
import { useLocale } from '@/shared/hooks/use-locale';
import { t } from '@/shared/lib/i18n';

/** EN/TH toggle, styled and placed like `ThemeToggle` — a two-letter badge rather than a flag or globe icon, since a glyph can't disambiguate which of two states it means the way Sun/Moon can. */
export function LanguageToggle() {
  const { locale, toggleLocale } = useLocale();
  const isThai = locale === 'th';
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t(isThai ? 'locale.toggle.to_en' : 'locale.toggle.to_th')}
      onClick={toggleLocale}
      className="font-mono text-xs font-semibold tracking-wide"
    >
      {isThai ? 'TH' : 'EN'}
    </Button>
  );
}
