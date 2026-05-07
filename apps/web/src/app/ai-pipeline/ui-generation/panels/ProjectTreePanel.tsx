'use client';

interface ProjectTreePanelProps {
  selectedFile: string;
  onSelectFile: (path: string) => void;
}

interface TreeNode {
  name: string;
  path?: string;
  children?: TreeNode[];
  status?: 'approved' | 'draft' | 'issue';
}

const TREE: TreeNode[] = [
  { name: 'src', children: [
    { name: 'pages', children: [
      { name: 'ContactsListPage.tsx', path: 'src/pages/ContactsListPage.tsx', status: 'draft' },
      { name: 'ContactDetailPage.tsx', path: 'src/pages/ContactDetailPage.tsx', status: 'approved' },
      { name: 'ContactCreatePage.tsx', path: 'src/pages/ContactCreatePage.tsx', status: 'draft' },
      { name: 'DealsListPage.tsx', path: 'src/pages/DealsListPage.tsx', status: 'draft' },
      { name: 'DashboardPage.tsx', path: 'src/pages/DashboardPage.tsx', status: 'approved' },
    ]},
    { name: 'components', children: [
      { name: 'AppShell.tsx', path: 'src/components/AppShell.tsx', status: 'approved' },
      { name: 'Navigation.tsx', path: 'src/components/Navigation.tsx', status: 'approved' },
    ]},
    { name: 'auth', children: [
      { name: 'SignInPage.tsx', path: 'src/auth/SignInPage.tsx', status: 'approved' },
      { name: 'SignUpPage.tsx', path: 'src/auth/SignUpPage.tsx', status: 'draft' },
    ]},
    { name: 'router.tsx', path: 'src/router.tsx', status: 'approved' },
  ]},
  { name: 'package.json', path: 'package.json', status: 'approved' },
  { name: 'vite.config.ts', path: 'vite.config.ts', status: 'approved' },
  { name: 'tailwind.config.ts', path: 'tailwind.config.ts', status: 'approved' },
];

function statusIcon(status?: string) {
  if (status === 'approved') return <span className="text-green-500 text-xs">✓</span>;
  if (status === 'issue') return <span className="text-destructive text-xs">!</span>;
  return <span className="w-3" />;
}

function TreeNodeRow({ node, depth, selectedFile, onSelectFile }: { node: TreeNode; depth: number; selectedFile: string; onSelectFile: (p: string) => void }) {
  const [open, setOpen] = useState(true);
  const isFile = !!node.path;
  const isSelected = node.path === selectedFile;

  if (isFile) {
    return (
      <button
        onClick={() => onSelectFile(node.path!)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs text-left rounded ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted/50'}`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <span className="flex-1 truncate">{node.name}</span>
        {statusIcon(node.status)}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <span className="text-xs">{open ? '▾' : '▸'}</span>
        <span className="font-medium">{node.name}</span>
      </button>
      {open && node.children?.map(child => (
        <TreeNodeRow key={child.name} node={child} depth={depth + 1} selectedFile={selectedFile} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}

import { useState } from 'react';

export function ProjectTreePanel({ selectedFile, onSelectFile }: ProjectTreePanelProps) {
  return (
    <div className="py-2">
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border mb-1">
        Project Files
      </div>
      {TREE.map(node => (
        <TreeNodeRow key={node.name} node={node} depth={0} selectedFile={selectedFile} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}
