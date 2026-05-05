'use client';

import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useRef } from 'react';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'sql_postgres' | 'sql_mssql';
  onRun: () => void;
  workspaceId: string;
  schemaId: string;
}

export function SqlEditor({ value, onChange, language, onRun }: SqlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const monacoLanguage = language === 'sql_postgres' ? 'pgsql' : 'sql';

  function handleMount(ed: editor.IStandaloneCodeEditor) {
    editorRef.current = ed;
    ed.addCommand(
      // Cmd+Enter / Ctrl+Enter to run
      // eslint-disable-next-line no-bitwise
      2048 | 3, // KeyMod.CtrlCmd | KeyCode.Enter
      () => { onRun(); },
    );
  }

  return (
    <Editor
      height="100%"
      language={monacoLanguage}
      value={value}
      onChange={(v) => { onChange(v ?? ''); }}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
      }}
      theme="vs-dark"
    />
  );
}
