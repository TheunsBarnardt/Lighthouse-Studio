'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';

import { useAuth } from '@/context/auth-context';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { useThemeEditor } from '@/state/theme-editor-store';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { AdvancedEditor } from '@/components/branding/advanced';
import { PresetPicker } from '@/components/branding/preset-picker';
import { ThemeExportDialog } from '@/components/branding/theme-export-dialog';
import { TokensPanel } from '@/components/branding/tokens-panel';

export default function WorkspaceBrandingPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const auth = useAuth();
  const userId = auth.user?.id ?? 'system';
  const { theme, loading, error, save, saving, saveError } = useWorkspaceTheme(slug);

  const setInitial = useThemeEditor((s) => s.setInitial);
  const applyPreset = useThemeEditor((s) => s.applyPreset);
  const current = useThemeEditor((s) => s.current);
  const baseline = useThemeEditor((s) => s.baseline);

  useEffect(() => {
    if (theme) setInitial(theme);
  }, [theme, setInitial]);

  if (loading || !theme || !current || !baseline) {
    return (
      <div className="text-sm text-muted-foreground" aria-live="polite">
        Loading theme…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    );
  }

  function handleCustomize(next: typeof current): void {
    if (!next) return;
    setInitial(next);
  }

  async function handleSave(): Promise<void> {
    if (!current) return;
    const saved = await save(current);
    if (saved) setInitial(saved);
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Branding</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Define this workspace's visual identity. Every project inside the workspace inherits these tokens.
          </p>
        </div>
        <ThemeExportDialog theme={current} />
      </div>

      <Tabs defaultValue="presets">
        <TabsList>
          <TabsTrigger value="presets">Presets</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        <TabsContent value="presets" className="mt-4">
          <PresetPicker
            theme={current}
            onApplyPreset={(id) => applyPreset(id, userId)}
            onCustomize={handleCustomize}
            onSave={() => void handleSave()}
            saving={saving}
            saveError={saveError}
            user={userId}
          />
        </TabsContent>
        <TabsContent value="tokens" className="mt-4">
          <TokensPanel
            current={current}
            onSave={() => void handleSave()}
            saving={saving}
            saveError={saveError}
          />
        </TabsContent>
        <TabsContent value="advanced" className="mt-4">
          <AdvancedEditor
            baseline={baseline}
            current={current}
            onSave={() => void handleSave()}
            saving={saving}
            saveError={saveError}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
