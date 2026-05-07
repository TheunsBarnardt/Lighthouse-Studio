import type { PrdTemplate } from '../types.js';

export const BUILT_IN_PRD_TEMPLATES: ReadonlyArray<PrdTemplate> = [
  {
    id: 'prd-builtin-crm',
    workspaceId: null,
    name: 'CRM',
    description: 'Customer relationship management system with contacts, deals, and pipeline tracking.',
    category: 'business',
    sectionStarters: {
      purpose: 'This is a CRM for managing customer relationships, tracking deal pipelines, and improving sales team efficiency.',
      scope: 'Typical CRM scope: contact management, deal stages, activity logging, reporting dashboards. Out of scope in v1: email campaigns, billing integration, mobile app.',
      locked_decisions: 'Key decisions for CRM: multi-tenancy model, deal stage configurability, contact deduplication strategy.',
      component_specifications: 'Core CRM components: Contact, Deal, Activity, Pipeline, User, Organisation. Standard services: ContactService, DealService, PipelineService, ReportingService.',
    },
    builtIn: true,
    createdByUserId: null,
  },
  {
    id: 'prd-builtin-blog',
    workspaceId: null,
    name: 'Blog / Content Platform',
    description: 'Content publishing platform with posts, categories, comments, and author management.',
    category: 'content',
    sectionStarters: {
      purpose: 'A content publishing platform that allows authors to create, edit, and publish blog posts with rich media support.',
      scope: 'In scope: post creation/editing, categories/tags, comment moderation, author profiles, RSS feed. Out of scope: paid subscriptions, mobile app.',
      component_specifications: 'Core components: Post, Author, Category, Tag, Comment. Services: PostService, CommentModerationService, FeedService.',
    },
    builtIn: true,
    createdByUserId: null,
  },
  {
    id: 'prd-builtin-internal-tool',
    workspaceId: null,
    name: 'Internal Business Tool',
    description: 'Employee-facing tool for internal workflows, approvals, and data management.',
    category: 'internal',
    sectionStarters: {
      purpose: 'An internal tool for employees to manage workflows, submit approvals, and track operational data.',
      scope: 'In scope: workflow definitions, approval chains, data entry forms, reporting. Out of scope: customer-facing features, public APIs.',
      locked_decisions: 'Key decisions: SSO/LDAP integration, role-based access by department, audit trail requirements.',
      component_specifications: 'Core components: Workflow, ApprovalRequest, Form, Report. Services: WorkflowEngine, ApprovalService, AuditService.',
    },
    builtIn: true,
    createdByUserId: null,
  },
  {
    id: 'prd-builtin-customer-portal',
    workspaceId: null,
    name: 'Customer Portal',
    description: 'Self-service portal for customers to manage accounts, view invoices, and submit support requests.',
    category: 'customer',
    sectionStarters: {
      purpose: 'A self-service customer portal allowing customers to manage their account, view billing history, and submit support requests without contacting staff.',
      scope: 'In scope: account management, invoice viewing, support ticket submission and tracking. Out of scope: payment processing, live chat.',
      component_specifications: 'Core components: CustomerAccount, Invoice, SupportTicket, Notification. Services: AccountService, BillingService, TicketService.',
    },
    builtIn: true,
    createdByUserId: null,
  },
  {
    id: 'prd-builtin-dashboard',
    workspaceId: null,
    name: 'Analytics Dashboard',
    description: 'Data visualisation dashboard with charts, filters, and scheduled reports.',
    category: 'analytics',
    sectionStarters: {
      purpose: 'An analytics dashboard that surfaces key business metrics with interactive charts, flexible filtering, and scheduled report delivery.',
      scope: 'In scope: chart visualisations, date range filters, metric definitions, scheduled email reports. Out of scope: raw data export, ML predictions.',
      hard_parts: 'Key hard parts: query performance at scale, real-time vs. cached data trade-off, flexible metric definition without code changes.',
      component_specifications: 'Core components: Dashboard, Chart, MetricDefinition, DataSource, ReportSchedule. Services: QueryService, ChartRenderService, ReportingService.',
    },
    builtIn: true,
    createdByUserId: null,
  },
  {
    id: 'prd-builtin-ecommerce',
    workspaceId: null,
    name: 'E-Commerce Store',
    description: 'Online store with product catalog, shopping cart, checkout, and order management.',
    category: 'ecommerce',
    sectionStarters: {
      purpose: 'An online store allowing customers to browse products, add items to a cart, complete checkout, and track orders.',
      scope: 'In scope: product catalog, shopping cart, checkout flow, order management, basic inventory. Out of scope: marketplace (multi-vendor), subscription billing, mobile app.',
      locked_decisions: 'Key decisions: payment gateway selection, inventory management model, product variant handling, tax calculation approach.',
      hard_parts: 'Key hard parts: inventory consistency under concurrent orders, payment idempotency, cart abandonment handling.',
      component_specifications: 'Core components: Product, ProductVariant, Cart, Order, Payment, Inventory. Services: CatalogService, CartService, OrderService, PaymentService, InventoryService.',
    },
    builtIn: true,
    createdByUserId: null,
  },
];

export function getBuiltInPrdTemplates(): ReadonlyArray<PrdTemplate> {
  return BUILT_IN_PRD_TEMPLATES;
}

export function getBuiltInPrdTemplate(id: string): PrdTemplate | undefined {
  return BUILT_IN_PRD_TEMPLATES.find((t) => t.id === id);
}
