'use client';

import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useRef } from 'react';

interface MongoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
}

export function MongoEditor({ value, onChange, onRun }: MongoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  function handleMount(ed: editor.IStandaloneCodeEditor) {
    editorRef.current = ed;
    ed.addCommand(
      // eslint-disable-next-line no-bitwise
      2048 | 3,
      () => { onRun(); },
    );
  }

  return (
    <Editor
      height="100%"
      language="json"
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
