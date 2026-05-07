'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { SignalsListPanel } from './panels/SignalsListPanel';
import { ChangeRequestsPanel } from './panels/ChangeRequestsPanel';
import { DependencyAdvisoriesPanel } from './panels/DependencyAdvisoriesPanel';
import { OutcomeTrackingPanel } from './panels/OutcomeTrackingPanel';

type Tab = 'signals' | 'requests' | 'advisories' | 'outcomes';

const DEMO_COUNTS = { signals: 3, requests: 2, advisories: 1, outcomes: 0 };

export default function MaintenancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('signals');

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Stage 10: Maintenance & Evolution</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Production signals, change requests, dependency advisories, and outcome tracking.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as Tab)} className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="signals" className="gap-1.5">
            Signals
            {DEMO_COUNTS.signals > 0 && <Badge variant="destructive" className="text-xs h-4 px-1">{DEMO_COUNTS.signals}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5">
            Change Requests
            {DEMO_COUNTS.requests > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{DEMO_COUNTS.requests}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="advisories" className="gap-1.5">
            Advisories
            {DEMO_COUNTS.advisories > 0 && <Badge variant="outline" className="text-xs h-4 px-1">{DEMO_COUNTS.advisories}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="signals" className="h-full m-0 overflow-y-auto">
            <SignalsListPanel />
          </TabsContent>
          <TabsContent value="requests" className="h-full m-0 overflow-y-auto">
            <ChangeRequestsPanel />
          </TabsContent>
          <TabsContent value="advisories" className="h-full m-0 overflow-y-auto">
            <DependencyAdvisoriesPanel />
          </TabsContent>
          <TabsContent value="outcomes" className="h-full m-0 overflow-y-auto">
            <OutcomeTrackingPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
