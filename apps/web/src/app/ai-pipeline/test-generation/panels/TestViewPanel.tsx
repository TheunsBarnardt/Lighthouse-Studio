'use client';

import { Check, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { RegenerateTestDialog } from '../dialogs/RegenerateTestDialog';

const DEMO_SOURCE = `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';

import { Button } from '@/components/ui/button';

describe('AuthService.register', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService({
      users: {
        findByEmail: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'u-1', email: 'test@example.com' })
      },
      hasher: { hash: vi.fn().mockResolvedValue('$hashed') }
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
  whyThisTestExists:
    'AC-001 requires that user passwords are hashed before storage. This unit test verifies the hashing step in isolation.',
  whatItVerifies:
    'That AuthService.register calls the hasher with the plain text password and stores the hash, not the plain text.',
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
  const [activeTab, setActiveTab] = useState<'source' | 'reasoning'>('source');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="font-mono text-sm"
            style={{
              fontSize: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 280,
            }}
          >
            src/__tests__/unit/tc-ac001-unit-1.test.ts
          </span>
          <span
            className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${approved ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'}`}
          >
            {approved ? 'Approved' : 'Draft'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              setShowRegenerate(true);
            }}
          >
            <RefreshCw style={{ width: 12, height: 12, marginRight: 6 }} />
            Regenerate
          </Button>
          {!approved && (
            <Button
              size="sm"
              type="button"
              onClick={() => {
                setApproved(true);
              }}
            >
              <Check style={{ width: 12, height: 12, marginRight: 6 }} />
              Approve
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '0 16px',
          marginTop: 8,
        }}
      >
        {(['source', 'reasoning'] as const).map((tab) => (
          <Button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
            }}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: activeTab === tab ? 'var(--accent-primary)' : 'var(--fg-secondary)',
              borderBottom:
                activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>

      {activeTab === 'source' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <pre
            className="font-mono text-sm"
            style={{
              padding: 16,
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre',
              overflowX: 'auto',
              margin: 0,
            }}
          >
            {DEMO_SOURCE}
          </pre>
        </div>
      )}

      {activeTab === 'reasoning' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 4,
                }}
              >
                Why This Test Exists
              </p>
              <p style={{ fontSize: 13 }}>{DEMO_REASONING.whyThisTestExists}</p>
            </div>
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 4,
                }}
              >
                What It Verifies
              </p>
              <p style={{ fontSize: 13 }}>{DEMO_REASONING.whatItVerifies}</p>
            </div>
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 4,
                }}
              >
                Design Decisions
              </p>
              <ul
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  paddingLeft: 0,
                  listStyle: 'none',
                }}
              >
                {DEMO_REASONING.designDecisions.map((d, i) => (
                  <li key={i} style={{ fontSize: 13, display: 'flex', gap: 8 }}>
                    <span style={{ marginTop: 2 }}>•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showRegenerate && (
        <RegenerateTestDialog
          testFileId={testFileId}
          onClose={() => {
            setShowRegenerate(false);
          }}
        />
      )}
    </div>
  );
}
