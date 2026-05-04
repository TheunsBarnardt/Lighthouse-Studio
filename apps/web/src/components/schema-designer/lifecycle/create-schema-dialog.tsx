'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { CreateSchemaInput, DatabaseDriver, TemplateId } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useCreateSchema } from '@/hooks/useSchemaService';
import { SCHEMA_TEMPLATES } from '@/lib/types';

interface Props {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function CreateSchemaDialog({ workspaceId, open, onClose }: Props) {
  const router = useRouter();
  const createSchema = useCreateSchema(workspaceId);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState('');
  const [driver, setDriver] = useState<DatabaseDriver>('postgres');
  const [templateId, setTemplateId] = useState<TemplateId>('blank');
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManual) setSlug(slugify(value));
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugManual(true);
  };

  const handleSubmit = () => {
    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required.');
      return;
    }
    setError(null);
    const trimmedDesc = description.trim();
    const input: CreateSchemaInput = {
      name: name.trim(),
      slug: slug.trim(),
      databaseDriver: driver,
      ...(trimmedDesc ? { description: trimmedDesc } : {}),
      ...(templateId !== 'blank' ? { templateId } : {}),
    };
    createSchema.mutate(input, {
      onSuccess: () => {
        onClose();
        router.push(`/data-management/${slug.trim()}`);
      },
      onError: (e) => {
        setError(e instanceof Error ? e.message : 'Failed to create schema.');
      },
    });
  };

  const handleClose = () => {
    setName('');
    setSlug('');
    setSlugManual(false);
    setDescription('');
    setDriver('postgres');
    setTemplateId('blank');
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Create Schema"
      description="Choose a template and configure your new schema."
      size="lg"
    >
      {/* Template selector */}
      <div className="mb-6">
        <Label className="mb-2 block text-sm font-medium">Template</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SCHEMA_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTemplateId(t.id);
              }}
              className={[
                'rounded-lg border p-3 text-left transition-colors',
                templateId === t.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/40',
              ].join(' ')}
            >
              <div className="text-sm font-medium">{t.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
              {t.tableCount > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {t.tableCount} tables · {t.previewTables.join(', ')}…
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="schema-name" className="mb-1 block text-sm font-medium">
            Name
          </Label>
          <Input
            id="schema-name"
            value={name}
            onChange={(e) => {
              handleNameChange(e.target.value);
            }}
            placeholder="My Schema"
            aria-required="true"
          />
        </div>

        <div>
          <Label htmlFor="schema-slug" className="mb-1 block text-sm font-medium">
            Slug
          </Label>
          <Input
            id="schema-slug"
            value={slug}
            onChange={(e) => {
              handleSlugChange(e.target.value);
            }}
            placeholder="my-schema"
            aria-required="true"
            aria-describedby="slug-hint"
          />
          <p id="slug-hint" className="mt-1 text-xs text-muted-foreground">
            Used in URLs and API paths. Lowercase letters, numbers, and hyphens only.
          </p>
        </div>

        <div>
          <Label htmlFor="schema-description" className="mb-1 block text-sm font-medium">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="schema-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            placeholder="What this schema is for"
          />
        </div>

        <div>
          <Label htmlFor="schema-driver" className="mb-1 block text-sm font-medium">
            Database Driver
          </Label>
          <Select
            id="schema-driver"
            value={driver}
            onChange={(e) => {
              setDriver(e.target.value as DatabaseDriver);
            }}
            aria-label="Database driver"
          >
            <option value="postgres">PostgreSQL</option>
            <option value="mssql">SQL Server (MSSQL)</option>
            <option value="mongo">MongoDB</option>
          </Select>
        </div>

        {error && (
          <p className="rounded bg-error/10 px-3 py-2 text-sm text-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={handleClose}
          disabled={createSchema.isPending}
          aria-label="Cancel"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createSchema.isPending || !name.trim() || !slug.trim()}
        >
          {createSchema.isPending ? 'Creating…' : 'Create Schema'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
