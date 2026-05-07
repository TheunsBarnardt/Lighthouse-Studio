'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, RefreshCw } from 'lucide-react';
import { RegenerateTestDialog } from '../dialogs/RegenerateTestDialog';

const DEMO_SOURCE = `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';

describe('AuthService.register', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService({
      users: {
        findByEmail: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'u-1', email: 'test@example.com' }),
      },
      hasher: { hash: vi.fn().mockResolvedValue('$hashed') },
    });
  });

  it('should hash the password before storing', async () => {
    // Given a new user with plain text password
    const input = { email: 'test@example.com', password: 'plaintext' };

    // When they register
    const result = await service.register(input);

    // Then the password is hashed
    expect(result.isOk()).toBe(true);
    expect(service['deps'].hasher.hash).toHaveBeenCalledWith('plaintext');
    expect(service['deps'].users.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: '$hashed' })
    );
  });
});`;

const DEMO_REASONING = {
  whyThisTestExists: 'AC-001 requires that user passwords are hashed before storage. This unit test verifies the hashing step in isolation.',
  whatItVerifies: 'That AuthService.register calls the hasher with the plain text password and stores the hash, not the plain text.',
  designDecisions: [
    'Unit test rather than integration because hashing logic is pure business logic',
    'Mock hasher to verify it is called correctly without depending on bcrypt',
    'Mock user repository to isolate from database',
  ],
};

interface Props {
  testFileId: string;
}

export function TestViewPanel({ testFileId }: Props) {
  const [approved, setApproved] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-muted-foreground truncate max-w-xs">
            src/__tests__/unit/tc-ac001-unit-1.test.ts
          </span>
          <Badge variant={approved ? 'default' : 'secondary'}>
            {approved ? 'Approved' : 'Draft'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRegenerate(true)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Regenerate
          </Button>
          {!approved && (
            <Button size="sm" onClick={() => setApproved(true)}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Approve
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="source" className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-4 mt-2 w-fit">
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
        </TabsList>

        <TabsContent value="source" className="flex-1 overflow-auto m-0 mt-2">
          <pre className="p-4 text-sm font-mono leading-relaxed text-foreground whitespace-pre overflow-x-auto">
            {DEMO_SOURCE}
          </pre>
        </TabsContent>

        <TabsContent value="reasoning" className="flex-1 overflow-auto m-0 mt-2 p-4">
          <div className="space-y-4 max-w-2xl">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Why This Test Exists</p>
              <p className="text-sm">{DEMO_REASONING.whyThisTestExists}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">What It Verifies</p>
              <p className="text-sm">{DEMO_REASONING.whatItVerifies}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Design Decisions</p>
              <ul className="space-y-1">
                {DEMO_REASONING.designDecisions.map((d, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-muted-foreground mt-0.5">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {showRegenerate && (
        <RegenerateTestDialog
          testFileId={testFileId}
          onClose={() => setShowRegenerate(false)}
        />
      )}
    </div>
  );
}
