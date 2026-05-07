'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight } from 'lucide-react';

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

export function EngageStageDialog({ requestId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set(['ui_generation']));

  const toggleStage = (id: string) => {
    setSelectedStages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Engage Pipeline Stage</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Select which pipeline stages to re-engage for this change request.
            Only the minimum required stages will be re-run.
          </p>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Stages</p>
            <div className="space-y-1.5">
              {STAGES.map(stage => (
                <label key={stage.id} className="flex items-center gap-3 p-2 rounded border cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedStages.has(stage.id)}
                    onChange={() => toggleStage(stage.id)}
                    className="rounded"
                  />
                  <span className="text-sm">{stage.label}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedStages.size > 0 && (
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Will re-engage:</p>
              <div className="flex flex-wrap gap-1">
                {STAGES.filter(s => selectedStages.has(s.id)).map(s => (
                  <Badge key={s.id} variant="outline" className="text-xs">{s.label}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleEngage} disabled={loading || selectedStages.size === 0}>
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Engaging…</>
              : <>Engage {selectedStages.size} stage{selectedStages.size !== 1 ? 's' : ''} <ArrowRight className="h-3 w-3 ml-1" /></>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
