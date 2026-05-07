'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeploymentPlanPanel } from './panels/DeploymentPlanPanel';
import { DeploymentMonitorPanel } from './panels/DeploymentMonitorPanel';
import { EnvironmentStatusPanel } from './panels/EnvironmentStatusPanel';
import { LogsPanel } from './panels/LogsPanel';
import { HistoryPanel } from './panels/HistoryPanel';

type Tab = 'plan' | 'environments' | 'monitor' | 'logs' | 'history';

export default function DeploymentPage() {
  const [activeTab, setActiveTab] = useState<Tab>('plan');
  const [planApproved, setPlanApproved] = useState(false);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Stage 9: Deployment</h1>
          {planApproved && <Badge variant="default">Plan Approved</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'plan' && !planApproved && (
            <Button size="sm" onClick={() => setPlanApproved(true)}>
              Approve Plan
            </Button>
          )}
          {planApproved && activeTab === 'environments' && (
            <Button
              size="sm"
              onClick={() => { setActiveDeploymentId('dep-demo'); setActiveTab('monitor'); }}
            >
              Deploy to Dev
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as Tab)} className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="monitor" disabled={!activeDeploymentId}>
            Monitor {activeDeploymentId && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />}
          </TabsTrigger>
          <TabsTrigger value="logs" disabled={!activeDeploymentId}>Logs</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="plan" className="h-full m-0">
            <DeploymentPlanPanel onApproved={() => { setPlanApproved(true); setActiveTab('environments'); }} />
          </TabsContent>

          <TabsContent value="environments" className="h-full m-0">
            <EnvironmentStatusPanel
              onDeploy={(env) => { setActiveDeploymentId(`dep-${env}`); setActiveTab('monitor'); }}
            />
          </TabsContent>

          <TabsContent value="monitor" className="h-full m-0">
            {activeDeploymentId && (
              <DeploymentMonitorPanel deploymentId={activeDeploymentId} />
            )}
          </TabsContent>

          <TabsContent value="logs" className="h-full m-0">
            {activeDeploymentId && <LogsPanel deploymentId={activeDeploymentId} />}
          </TabsContent>

          <TabsContent value="history" className="h-full m-0">
            <HistoryPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
