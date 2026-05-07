import { z } from 'zod';

// ── Information Architecture ───────────────────────────────────────────────────

export interface TraceabilityRef {
  prdSectionId: string;
  requirementId: string;
}

export interface PermissionRequirement {
  action: string;
  resource?: string;
  required: boolean;
}

export interface ComponentRef {
  componentId: string;
  role: string;
}

export interface NavigationItem {
  label: string;
  path: string;
  icon?: string;
  children?: NavigationItem[];
  permission?: string;
}

export interface NavigationDefinition {
  type: 'sidebar' | 'topbar' | 'both';
  items: NavigationItem[];
  userMenuItems: NavigationItem[];
}

export type PageType = 'list' | 'detail' | 'create' | 'edit' | 'workflow' | 'dashboard' | 'custom';

export interface PageDefinition {
  id: string;
  path: string;
  title: string;
  pageType: PageType;
  primaryEntity?: string;
  components: ComponentRef[];
  permissions: PermissionRequirement[];
  realtimeEnabled: boolean;
  tracesTo: TraceabilityRef[];
  reasoning?: string;
}

export interface AuthPageDefinition {
  id: string;
  path: string;
  type: 'sign_in' | 'sign_up' | 'forgot_password' | 'reset_password' | 'verify_email';
}

export interface LayoutDefinition {
  id: string;
  name: string;
  type: 'app_shell' | 'auth_layout' | 'blank';
  slots: string[];
}

export interface InformationArchitecture {
  pages: PageDefinition[];
  navigation: NavigationDefinition;
  authPages: AuthPageDefinition[];
  globalLayouts: LayoutDefinition[];
  reasoning?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export type ComponentType = 'page' | 'list' | 'form' | 'detail' | 'modal' | 'navigation' | 'layout' | 'utility';

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface ComponentSpec {
  componentName: string;
  componentType: ComponentType;
  primaryEntity?: string;
  props: PropDefinition[];
  uses: { sdk: string[]; libraries: string[] };
}

export type FileType = 'component' | 'page' | 'config' | 'style' | 'story' | 'manifest' | 'other';

export interface ProjectFile {
  path: string;
  content: string;
  fileType: FileType;
  generatedBy?: string;
  hash: string;
}

export interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  nodes: string[];
}

export interface AccessibilityReport {
  componentId: string;
  passed: boolean;
  violations: AxeViolation[];
  warnings: string[];
  suggestions: string[];
}

export interface TypeCheckReport {
  passed: boolean;
  errors: Array<{ file: string; line: number; message: string }>;
  warnings: Array<{ file: string; line: number; message: string }>;
}

export interface ConsistencyReport {
  passed: boolean;
  issues: Array<{ component: string; issue: string }>;
}

export interface ComponentQualitySignals {
  accessibilityPassed: boolean;
  typeCheckPassed: boolean;
  generationAttempts: number;
  userEdited: boolean;
  editCharsAfterApproval: number;
}

export interface UiComponent {
  id: string;
  projectId: string;
  pageId?: string;
  componentSpec: ComponentSpec;
  files: ProjectFile[];
  reasoning: Record<string, string>;
  qualitySignals: ComponentQualitySignals;
  status: 'draft' | 'approved' | 'rejected';
  version: number;
}

// ── Build Config ──────────────────────────────────────────────────────────────

export interface BuildConfig {
  packageJson: Record<string, unknown>;
  tsConfig: Record<string, unknown>;
  viteConfig: string;
  tailwindConfig: string;
  eslintConfig: Record<string, unknown>;
  prettierConfig: Record<string, unknown>;
}

// ── UI Project ────────────────────────────────────────────────────────────────

export type UiProjectStatus = 'generating' | 'draft' | 'partially_approved' | 'approved' | 'exported';

export interface UiProject {
  prdArtifactId: string;
  designTokensArtifactId: string;
  schemaArtifactId: string;
  ia: InformationArchitecture;
  files: ProjectFile[];
  pageArtifactIds: string[];
  componentArtifactIds: string[];
  buildConfig: BuildConfig;
  accessibilityReport: AccessibilityReport;
  typeCheckReport: TypeCheckReport;
  consistencyReport: ConsistencyReport;
}

export interface UiProjectArtifact {
  id: string;
  workspaceId: string;
  project: UiProject;
  status: UiProjectStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Quality Signals ───────────────────────────────────────────────────────────

export interface UiGenerationQualitySignals {
  projectArtifactId: string;
  totalComponents: number;
  componentsAcceptedFirstPass: number;
  componentsRegenerated: number;
  initialAccessibilityPassRate: number;
  finalAccessibilityPassRate: number;
  initialTypeCheckPassRate: number;
  finalTypeCheckPassRate: number;
  componentsEditedAfterApproval: number;
  totalEditChars: number;
  totalGenerationTimeMinutes: number;
  totalApprovalTimeHours: number;
  causedDownstreamCodeGenIssue: boolean;
  causedDownstreamTestGenIssue: boolean;
}

// ── Service Inputs ────────────────────────────────────────────────────────────

export const GenerateProjectInputSchema = z.object({
  workspaceId: z.string().uuid(),
  prdArtifactId: z.string().min(1),
  designTokensArtifactId: z.string().min(1),
  schemaArtifactId: z.string().min(1),
  options: z.object({
    generateStories: z.boolean().default(true),
    includeAuthPages: z.boolean().default(true),
    realtimeByDefault: z.boolean().default(true),
  }).optional(),
});
export type GenerateProjectInput = z.infer<typeof GenerateProjectInputSchema>;

export const GenerateIaInputSchema = z.object({
  workspaceId: z.string().uuid(),
  prdArtifactId: z.string().min(1),
  schemaArtifactId: z.string().min(1),
});
export type GenerateIaInput = z.infer<typeof GenerateIaInputSchema>;

export const RegenerateComponentInputSchema = z.object({
  componentArtifactId: z.string().min(1),
  feedback: z.string().optional(),
});
export type RegenerateComponentInput = z.infer<typeof RegenerateComponentInputSchema>;

// ── Audit Events ──────────────────────────────────────────────────────────────

export const UI_GENERATION_AUDIT_EVENTS = {
  PROJECT_GENERATION_STARTED: 'ai.ui_generation.project_generation_started',
  IA_GENERATED: 'ai.ui_generation.ia_generated',
  PAGE_GENERATED: 'ai.ui_generation.page_generated',
  COMPONENT_GENERATED: 'ai.ui_generation.component_generated',
  COMPONENT_REGENERATED: 'ai.ui_generation.component_regenerated',
  ACCESSIBILITY_FAILURE: 'ai.ui_generation.accessibility_failure',
  TYPECHECK_FAILURE: 'ai.ui_generation.typecheck_failure',
  PREVIEW_RENDERED: 'ai.ui_generation.preview_rendered',
  COMPONENT_APPROVED: 'ai.ui_generation.component_approved',
  COMPONENT_REJECTED: 'ai.ui_generation.component_rejected',
  PROJECT_APPROVED: 'ai.ui_generation.project_approved',
  EXPORTED: 'ai.ui_generation.exported',
} as const;

export type UiGenerationAuditEventType = (typeof UI_GENERATION_AUDIT_EVENTS)[keyof typeof UI_GENERATION_AUDIT_EVENTS];

// ── Permissions ───────────────────────────────────────────────────────────────

export const UI_GENERATION_PERMISSIONS = {
  CREATE: 'ai.ui_generation.create',
  READ: 'ai.ui_generation.read',
  REGENERATE: 'ai.ui_generation.regenerate',
  APPROVE: 'ai.ui_generation.approve',
  EXPORT: 'ai.ui_generation.export',
} as const;

export const UI_GENERATION_DEFAULT_GRANTS: Record<string, string[]> = {
  workspace_owner: Object.values(UI_GENERATION_PERMISSIONS),
  workspace_admin: Object.values(UI_GENERATION_PERMISSIONS),
  designer: Object.values(UI_GENERATION_PERMISSIONS),
  developer: Object.values(UI_GENERATION_PERMISSIONS),
  architect: Object.values(UI_GENERATION_PERMISSIONS),
  business_analyst: [UI_GENERATION_PERMISSIONS.READ, UI_GENERATION_PERMISSIONS.REGENERATE, UI_GENERATION_PERMISSIONS.APPROVE],
  reviewer: [UI_GENERATION_PERMISSIONS.READ],
  viewer: [UI_GENERATION_PERMISSIONS.READ],
  qa: [UI_GENERATION_PERMISSIONS.READ],
};
