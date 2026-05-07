'use client';

import { useState } from 'react';
import { RegionPicker } from './components/RegionPicker';
import { PageOverridesPanel } from './components/PageOverridesPanel';
import { ChromePreview } from './components/ChromePreview';

type Layout = 'sidenav-with-topbar' | 'topnav-only';
type Tab = 'configure' | 'overrides';

interface RegionConfig {
  blockId: string;
  params: Record<string, unknown>;
}

interface ChromeState {
  layout: Layout;
  header?: RegionConfig;
  sidenav?: RegionConfig;
  breadcrumb?: RegionConfig;
  footer?: RegionConfig;
}

export default function AppChromePage() {
  const [activeTab, setActiveTab] = useState<Tab>('configure');
  const [isProposing, setIsProposing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [chrome, setChrome] = useState<ChromeState>({
    layout: 'sidenav-with-topbar',
    header: { blockId: 'chrome-header-app', params: { productName: 'My App', showSearch: true } },
    sidenav: { blockId: 'chrome-sidenav-vertical', params: { collapsible: true } },
    breadcrumb: { blockId: 'chrome-breadcrumb', params: { separator: '/' } },
    footer: { blockId: 'chrome-footer-minimal', params: { productName: 'My App' } },
  });

  async function handlePropose() {
    setIsProposing(true);
    await new Promise(r => setTimeout(r, 2000));
    setChrome({
      layout: 'sidenav-with-topbar',
      header: { blockId: 'chrome-header-app', params: { productName: 'CRM Pro', showSearch: true } },
      sidenav: { blockId: 'chrome-sidenav-vertical', params: { collapsible: true } },
      breadcrumb: { blockId: 'chrome-breadcrumb', params: { separator: '›' } },
      footer: { blockId: 'chrome-footer-minimal', params: { productName: 'CRM Pro' } },
    });
    setIsProposing(false);
  }

  async function handleSave() {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setIsSaving(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-foreground">Stage 6 — App Chrome</span>
          <span className="text-xs text-muted-foreground">Configure shared header, nav, breadcrumb, and footer</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePropose}
            disabled={isProposing}
            className="px-3 py-1.5 text-xs border border-border rounded-md disabled:opacity-50"
          >
            {isProposing ? 'Proposing…' : '⚡ AI Propose'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-border flex-shrink-0 flex flex-col overflow-hidden">
          <div className="flex border-b border-border">
            {(['configure', 'overrides'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium capitalize ${activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {tab === 'configure' ? 'Configure' : 'Page Overrides'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {activeTab === 'configure' ? (
              <div className="p-4 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Layout</label>
                  <div className="space-y-1.5">
                    {([
                      { id: 'sidenav-with-topbar', label: 'Side nav + Top bar', desc: 'Data-heavy apps' },
                      { id: 'topnav-only', label: 'Top nav only', desc: 'Consumer or marketing apps' },
                    ] as { id: Layout; label: string; desc: string }[]).map(opt => (
                      <label key={opt.id} className="flex items-start gap-2.5 p-2.5 border border-border rounded-md cursor-pointer hover:bg-muted/30">
                        <input
                          type="radio"
                          name="layout"
                          value={opt.id}
                          checked={chrome.layout === opt.id}
                          onChange={() => setChrome(c => ({ ...c, layout: opt.id }))}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-xs font-medium text-foreground">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <RegionPicker
                  label="Header"
                  region="header"
                  selected={chrome.header}
                  required
                  onChange={cfg => setChrome(c => ({ ...c, header: cfg }))}
                />

                {chrome.layout === 'sidenav-with-topbar' && (
                  <RegionPicker
                    label="Side Nav"
                    region="sidenav"
                    selected={chrome.sidenav}
                    onChange={cfg => setChrome(c => ({ ...c, sidenav: cfg }))}
                  />
                )}

                <RegionPicker
                  label="Breadcrumb"
                  region="breadcrumb"
                  selected={chrome.breadcrumb}
                  onChange={cfg => setChrome(c => ({ ...c, breadcrumb: cfg }))}
                />

                <RegionPicker
                  label="Footer"
                  region="footer"
                  selected={chrome.footer}
                  onChange={cfg => setChrome(c => ({ ...c, footer: cfg }))}
                />
              </div>
            ) : (
              <PageOverridesPanel layout={chrome.layout} />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-muted/20 p-6">
          <ChromePreview chrome={chrome} />
        </div>
      </div>
    </div>
  );
}
