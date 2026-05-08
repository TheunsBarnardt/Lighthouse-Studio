'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

interface Props {
  requestId: string;
  onClose: () => void;
}

const STAGES = [
  { id: 'requirements', label: 'Requirements' },
  { id: 'prd_generation', label: 'PRD Generation' },
  { id: 'ux_design', label: 'UX Design' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'code_generation', label: 'Code Generation' },
  { id: 'ui_generation', label: 'UI Generation' },
  { id: 'test_generation', label: 'Test Generation' },
  { id: 'deployment', label: 'Deployment' },
];

export function EngageStageDialog({ requestId: _requestId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set(['ui_generation']));

  const toggleStage = (id: string) => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEngage = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 1800);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div className="pg-card" style={{ width: '100%', maxWidth: 440, padding: 24 }}>
        <div className="pg-card-header" style={{ marginBottom: 16 }}>
          <div className="pg-card-title">Engage Pipeline Stage</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
            Select which pipeline stages to re-engage for this change request. Only the minimum
            required stages will be re-run.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-primary)' }}>Stages</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STAGES.map((stage) => (
                <label
                  key={stage.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 8,
                    borderRadius: 4,
                    border: '1px solid var(--border-default)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedStages.has(stage.id)}
                    onChange={() => {
                      toggleStage(stage.id);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--fg-primary)' }}>{stage.label}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedStages.size > 0 && (
            <div
              style={{
                borderRadius: 4,
                background: 'var(--bg-surface)',
                padding: 12,
                fontSize: 12,
                color: 'var(--fg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <p style={{ fontWeight: 500, color: 'var(--fg-primary)' }}>Will re-engage:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {STAGES.filter((s) => selectedStages.has(s.id)).map((s) => (
                  <span key={s.id} className="pg-badge pg-badge-default">
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            className="pg-btn pg-btn-secondary pg-btn-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="pg-btn pg-btn-primary pg-btn-sm"
            onClick={handleEngage}
            disabled={loading || selectedStages.size === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {loading ? (
              'Engaging…'
            ) : (
              <>
                Engage {selectedStages.size} stage{selectedStages.size !== 1 ? 's' : ''}{' '}
                <ArrowRight style={{ width: 12, height: 12 }} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
