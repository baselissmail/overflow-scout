import { i18n } from '#i18n';

export function App() {
  return (
    <main className="flex min-h-dvh flex-col gap-4 p-3">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-semibold">{i18n.t('extName')}</h1>
        <p className="text-fg-muted">{i18n.t('tagline')}</p>
      </header>
      <p className="rounded-card border border-line bg-surface p-3 text-fg-muted">
        {i18n.t('rebuildNotice')}
      </p>
    </main>
  );
}
