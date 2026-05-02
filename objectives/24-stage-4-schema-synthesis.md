# Objective 24: Stage 4 — Schema Synthesis

**Status:** Ready for development
**Prerequisites:** Objectives 11 (Schema Designer), 20 (AI Pipeline Foundation), 22 (Stage 2: PRD Generation) complete
**Blocks:** Objective 25 (Stage 5: Data Migration), Objective 26 (Stage 6: UI Generation), Objective 27 (Stage 7: Code Generation)

---

## 1. Purpose

Take an approved PRD and produce a **complete database schema** ready to deploy to the customer's chosen database (Postgres, MSSQL, or MongoDB). This is the stage where the AI pipeline meets the data plane — the schema synthesis stage uses Objective 11's Schema Designer as its UI surface, so the customer sees the AI's output through the same tool they'd use to author a schema by hand.

The two halves of the platform converge here. The Data Management Module is "build a schema yourself with great tooling." The AI pipeline at this stage is "the AI builds the schema; you review through the same great tooling." Same surface, different starting point.

A good synthesized schema is:

- **Normalized correctly** for the chosen database (3NF for SQL; document-oriented for Mongo with sensible denormalization)
- **Capability-aware** — uses array columns on Postgres but not MSSQL; uses references in Mongo with advisory FKs
- **Performance-conscious** — indexes on FK columns, on filterable columns, on commonly-sorted columns
- **Privacy-aware** — PII columns identified and tagged
- **Traceable** — every table and column traces back to PRD requirements
- **Reviewable** — every choice has reasoning the user can read and contest

Done well, the customer reviews a schema that's already 90% right and adjusts edges. Done poorly, they're rewriting from scratch and wondering why they bothered with the AI.

---

## 2. Scope

### In Scope

- **Schema synthesis from PRD**: produces a complete `CustomerSchema` (using Objective 11's model)
- **Database-aware generation**: respects the workspace's chosen database driver (Postgres/MSSQL/Mongo)
- **Capability-aware decisions**: uses features the database supports; works around what it doesn't
- **PII detection and tagging**: columns containing PII are identified and tagged automatically
- **Index recommendations**: FK indexes; indexes on filterable/sortable columns from PRD
- **Foreign key inference**: relationships between tables based on PRD entity relationships
- **Default value suggestions**: reasonable defaults per column type
- **Validation against PRD coverage**: every entity mentioned in PRD has a corresponding table; every functional requirement involving data has appropriate columns
- **Iterative refinement**: regenerate single table or whole schema with feedback
- **Approval routing**: schema goes through approval per workspace's `schema` stage configuration
- **Conflict resolution with existing schemas**: if the workspace already has a schema, the AI proposes additions/modifications rather than wiping
- **Integration with Schema Designer**: synthesized schema lands in Objective 11's UI; user reviews/edits there
- **Export formats**: SQL DDL (per dialect), JSON, YAML — for customers who want to take the schema elsewhere
- **Traceability**: every table/column traces back to PRD elements
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Data migration (Stage 5) — transforming existing data to fit the new schema
- API surface (covered by Objective 12 — auto-generated from the schema)
- Stored procedures, triggers, views, functions (deferred)
- Advanced performance tuning (partitioning strategies, materialized views, custom indexes beyond standard recommendations)
- Multi-database synthesis (e.g., split data across Postgres + Mongo for one project) — deferred indefinitely; pick one database per workspace
- Schema versioning beyond what Objective 11 already provides
- Cross-workspace schema sharing — deferred

---

## 3. Locked Decisions

| Decision                  | Choice                                                                                                                      | Rationale                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Output target             | Objective 11's `CustomerSchema` model — the canonical platform schema representation                                        | Single source of truth                                                |
| Generation pattern        | Whole-schema generation with per-table refinement; no per-column independent prompts                                        | Tables have natural cohesion; columns within a table are interrelated |
| Database driver awareness | The workspace's chosen driver constrains generation; capabilities matrix from Objective 4c                                  | Schemas only contain features the target supports                     |
| PII detection             | Heuristic + AI judgment; flagged columns require user confirmation                                                          | Prompts user without blocking                                         |
| FK inference              | AI proposes; platform validates referential integrity intent                                                                | AI may miss; platform catches obvious gaps                            |
| Index strategy            | Auto-add indexes on: PKs (always), FK columns (always), columns mentioned as "filterable" or "sortable" in PRD requirements | Sensible defaults; expandable                                         |
| Existing schema handling  | Diff-based: AI proposes additions; user reviews changes incrementally                                                       | Preserves existing work                                               |
| Approval routing          | Per workspace's `schema` stage configuration (typically architect approval in enterprise; owner in solo)                    | Reuses the engine                                                     |
| UI surface                | Objective 11's Schema Designer — generated schema appears as a draft; user uses existing UI to review/edit                  | Consistency; no parallel UI                                           |
| Naming conventions        | snake_case (matching Objective 11's enforcement)                                                                            | Consistency                                                           |
| Default value strategy    | Sensible defaults per column type and column name pattern (e.g., `created_at` defaults to `now()`)                          | Reduces user-side toil                                                |
| Cost target               | $0.50–$3.00 per schema generation                                                                                           | Cost-aware                                                            |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│              APPROVED PRD + (optional) EXISTING SCHEMA                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  SCHEMA SYNTHESIS SERVICE                              │
│                                                                       │
│   1. Extract entities and relationships from PRD                      │
│   2. Generate table per entity                                        │
│   3. Generate columns per table (with types, nullability, defaults)   │
│   4. Infer foreign keys from relationships                            │
│   5. Detect PII columns                                               │
│   6. Recommend indexes                                                │
│   7. Validate capability compatibility (database-aware)                │
│   8. Validate PRD coverage (every entity covered?)                     │
│   9. Validate naming, normalization                                    │
│  10. Diff against existing schema (if any)                             │
│  11. Output as draft CustomerSchema                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │  OBJECTIVE 11's SCHEMA  │
                │  DESIGNER UI            │
                │                          │
                │  - User sees draft       │
                │  - Reviews per table     │
                │  - Edits inline          │
                │  - Approves and deploys  │
                │  - Same migration flow   │
                │    as hand-authored      │
                └─────────────────────────┘
                             │
                             ▼
                  Tables created in workspace's database
                  Foundation for Stages 5, 6, 7
```

---

## 5. The Hard Parts

**5.1 Database-aware synthesis**

The same PRD produces meaningfully different schemas on Postgres vs. Mongo. The AI knows the target:

**Postgres**:

- Normalized to 3NF where appropriate
- Uses array columns for many-to-many simple relationships
- JSONB columns for unstructured/extensible data
- Triggers and constraints expressible
- Standard SQL types

**MSSQL**:

- Similar normalization to Postgres
- No array columns (capability flag) — uses junction tables
- JSON columns for unstructured data (with constraints)
- Cleaner integration with Microsoft ecosystem assumptions

**Mongo**:

- Document-oriented; some denormalization expected
- Embedded documents for owned-by relationships
- References (advisory FKs) for many-to-many or owned-by-multiple
- No joins at the database level; the schema design considers how queries will work

The AI uses the capability matrix from Objective 4c to know what's available. The synthesis prompts have database-specific variants where the differences matter (relationship modeling, column types). The PII handling, naming, indexing patterns are shared.

**5.2 The "extract entities" step**

The PRD describes user-facing concepts: "users", "posts", "comments", "tags". The schema needs database-level entities: tables, junction tables, lookup tables. The AI:

- Reads the PRD's user stories, functional requirements, target users sections
- Identifies nouns that represent persistent state ("post", "user", "comment")
- Identifies relationships ("a post has many comments", "a user follows other users")
- Decides which need their own table vs. embedding (Mongo) vs. junction table
- Names tables in snake_case plural convention (`posts`, `users`, `post_tags`)

A separate prompt does this entity extraction; subsequent prompts operate on the extracted list.

**5.3 Per-table column generation**

For each table, generate columns:

- Standard columns first: `id` (UUID v7), `created_at`, `updated_at`, `_version` (optimistic locking)
- Domain columns based on what the entity represents
- For each domain column: name, type, nullability, default value, description, PII flag

The AI considers:

- What the PRD says about the entity (functional requirements describing operations on it)
- Common patterns for similar entities (a `user` table almost always has `email`, `display_name`, etc.)
- The customer's domain (a CRM `contact` is different from a blog `author`)

Each column has reasoning: "added `email` column because user stories US-3 and US-7 require email-based authentication."

**5.4 Foreign key inference**

Relationships in the PRD become foreign keys in the schema:

- "A comment belongs to a post" → `comments.post_id REFERENCES posts(id)`
- "A user has many posts" → `posts.author_id REFERENCES users(id)`
- "Posts have many tags" → junction table `post_tags(post_id, tag_id)`

The AI proposes; the platform validates:

- Referential integrity is expressible (Mongo gets advisory FKs)
- Cascade behavior is reasonable (deleting a user shouldn't cascade-delete their posts unless intended)
- Indexes are added on FK columns

For ambiguous relationships ("posts can be associated with users in multiple ways"), the AI surfaces the ambiguity for user confirmation rather than guessing.

**5.5 PII detection**

Columns commonly contain PII; the platform detects and flags:

**Heuristic patterns**:

- Column names matching `email`, `phone`, `name`, `address`, `birth*`, `ssn`, `tax_id`, `credit_card`, etc.
- Domain knowledge: in a `users` table, almost everything is PII; in a `posts` table, content may be

**AI judgment**:

- The AI considers context: a column called `name` in a `tags` table is just a tag name; in a `users` table it's PII
- Reasoning explains why the column is flagged

**User confirmation**:

- Heuristic-flagged columns prompt the user during review
- User can accept, reject, or change PII category
- Confirmation stored in the schema metadata

PII flags integrate with Objective 7's compliance machinery automatically — no separate setup needed.

**5.6 Index recommendations**

The AI recommends indexes based on:

- **PKs**: always indexed (Objective 11 enforces this)
- **FKs**: always indexed
- **Columns mentioned as "filterable" in PRD**: indexed
- **Columns mentioned as "sortable" in PRD**: indexed
- **Composite indexes**: where multiple columns are commonly filtered together

The AI doesn't go overboard — indexes have write costs. The recommendation is "minimum viable for the queries the PRD implies."

For databases that support specialized indexes (Postgres GIN/GiST, full-text), the AI uses them where appropriate. The capability matrix tells the AI what's available.

**5.7 Existing schema handling**

If a workspace already has a schema (the user is iterating on an existing project), the synthesis is diff-based:

- AI receives the current schema as input alongside the PRD
- Proposes additions: new tables, new columns, new indexes
- Proposes modifications: columns to add to existing tables, FKs to add
- **Does NOT propose destructive changes by default**: dropping tables, removing columns, changing types — these come from the user, not the AI
- The user reviews proposed changes; can request specific modifications via feedback

This respects work the user has already done. The AI is additive by default; destructive changes happen via the schema designer (Objective 11), not via auto-suggestion.

**5.8 PRD coverage validation**

After generation, a separate prompt validates coverage:

- Every entity mentioned in the PRD's user stories or functional requirements has a corresponding table
- Every entity attribute mentioned has a corresponding column
- Every relationship has a foreign key (or junction table or embedded structure)
- Functional requirements involving data operations are supported by the schema (e.g., FR-5 "users can search posts by tag" requires a `tags` field/table and proper indexing)

Missing coverage is surfaced as warnings, not blocking failures. The user reviews and decides whether to address them or accept (sometimes the PRD is over-broad and not everything needs schema support yet).

**5.9 Naming and convention enforcement**

Objective 11 enforces naming conventions (snake_case, no reserved words, length limits). The AI generates compliant names. A validation prompt catches edge cases:

- Reserved words for the chosen database (`order`, `user`, `group` for SQL; checking dialect-specific lists)
- Length limits (Postgres 63 chars; MSSQL 128; Mongo varies)
- Convention conflicts (e.g., a column named `name` is fine, but `Name` would violate snake_case)

Conflicts are auto-resolved where unambiguous (`Name` → `name`); flagged for user confirmation when judgment is needed.

**5.10 Iterating on the schema**

After generation, the user reviews in the Schema Designer (Objective 11's UI). Common iterations:

- "Add a column `archived_at` to all tables for soft-delete support"
- "Make `email` unique across the `users` table"
- "Add a `metadata` JSON column to `events` for extensibility"

These are inline edits in the Schema Designer. The user doesn't need to re-engage the AI for simple changes; they edit directly.

For larger changes ("rethink how `orders` relate to `customers`"), the user can request a regeneration of specific tables with feedback. The AI re-runs that table's generation with the constraint of the existing schema (so other tables aren't disrupted).

**5.11 Approval and deployment**

The schema goes through approval per the workspace's configuration:

- **Solo**: workspace owner approves; one click also deploys
- **Enterprise**: architect approves the schema; deployment may be a separate gate

Once approved, the schema deploys via Objective 11's standard migration flow — same edit-validate-preview-apply pipeline. The fact that the schema came from AI synthesis vs. hand authoring doesn't change the deployment path.

This keeps the deployment path consistent and well-tested. AI-generated schemas don't get a special "auto-deploy" privilege; they go through the same checks as everything else.

**5.12 Quality signals**

Beyond Objective 20's generic signals:

- **Coverage rate**: did the synthesized schema cover all PRD-mentioned entities?
- **PII detection accuracy**: did the user accept the AI's PII flags?
- **Index recommendation quality**: were the indexes useful or did the user remove many?
- **FK inference accuracy**: did the user accept the proposed relationships?
- **Edits before approval**: how many table/column changes between AI output and approval?
- **Downstream issues**: did Stage 6 (UI Generation) or Stage 7 (Code Generation) hit schema issues?

These signals reveal which prompts produce schemas that work in practice vs. need heavy revision.

---

## 6. Component Specifications

### 6.1 SchemaSynthesisService

```typescript
// packages/core/src/services/ai/schema-synthesis/schema-synthesis.service.ts

export class SchemaSynthesisService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly schemas: SchemaService, // Objective 11's service
    private readonly capabilities: CapabilityRegistry,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  /** Synthesize a schema from a PRD; optionally with existing schema context. */
  async synthesizeSchema(ctx: RequestContext, input: SynthesizeSchemaInput): Promise<Result<Artifact<SynthesizedSchema>, AppError>>;

  /** Get the synthesized schema artifact. */
  async getSynthesis(ctx: RequestContext, artifactId: string): Promise<Result<Artifact<SynthesizedSchema>, AppError>>;

  /** Regenerate a single table. */
  async regenerateTable(ctx: RequestContext, artifactId: string, tableId: string, feedback?: string): Promise<Result<Artifact<SynthesizedSchema>, AppError>>;

  /** Regenerate the full schema. */
  async regenerateAll(ctx: RequestContext, artifactId: string, feedback?: string): Promise<Result<Artifact<SynthesizedSchema>, AppError>>;

  /** Validate coverage of the synthesized schema against the PRD. */
  async validateCoverage(ctx: RequestContext, artifactId: string): Promise<Result<CoverageReport, AppError>>;

  /** Apply the synthesized schema as a draft in the Schema Designer. */
  async applyToSchemaDesigner(
    ctx: RequestContext,
    artifactId: string,
    targetSchemaId?: string, // null = create new
  ): Promise<Result<{ schemaId: string }, AppError>>;

  /** Submit for approval. */
  async submitForApproval(ctx: RequestContext, artifactId: string): Promise<Result<Artifact<SynthesizedSchema>, AppError>>;
}
```

### 6.2 The Synthesized Schema Artifact

```typescript
interface SynthesizedSchema {
  prdArtifactId: string; // parent
  existingSchemaId?: string; // if iterating on existing
  databaseDriver: 'postgres' | 'mssql' | 'mongo';

  // The actual schema (matches Objective 11's CustomerSchema shape)
  schema: CustomerSchema;

  // Metadata about the synthesis
  entityExtraction: EntityExtractionRecord;
  coverageReport: CoverageReport;
  piiDetectionRecord: PiiDetectionRecord;
  indexRecommendations: IndexRecommendation[];

  // Diff (if existing schema present)
  diff?: SchemaDiff;
}

interface EntityExtractionRecord {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  ambiguitiesFlagged: string[];
}

interface CoverageReport {
  prdEntitiesCovered: { entityName: string; tableId: string }[];
  prdEntitiesUncovered: { entityName: string; reason: string }[];
  prdRequirementsCovered: { requirementId: string; supportingTableIds: string[] }[];
  prdRequirementsUnsupported: { requirementId: string; missingSchema: string }[];
}

interface PiiDetectionRecord {
  detectedColumns: { tableId: string; columnId: string; categories: PiiCategory[]; reasoning: string }[];
  userConfirmations: { tableId: string; columnId: string; accepted: boolean; modifiedCategories?: PiiCategory[] }[];
}

interface IndexRecommendation {
  tableId: string;
  columnIds: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  reasoning: string;
  estimatedBenefit: 'high' | 'medium' | 'low';
}

interface SchemaDiff {
  newTables: TableDefinition[];
  modifiedTables: { tableId: string; changes: TableChange[] }[];
  newIndexes: IndexDefinition[];
  newForeignKeys: ForeignKeyDefinition[];
}
```

### 6.3 The Generation Prompts

In `packages/core/src/ai/prompts/schema-synthesis/`:

- `entity-extraction.prompt.ts` — extract entities + relationships from PRD
- `table-generation.prompt.ts` — generate a single table (columns, types, defaults) — has database-specific variants
- `relationship-modeling.prompt.ts` — translate relationships to FKs/junctions/embeds
- `pii-detection.prompt.ts` — detect PII columns (heuristic + AI)
- `index-recommendation.prompt.ts` — recommend indexes
- `coverage-validation.prompt.ts` — verify PRD coverage
- `naming-validation.prompt.ts` — check names against database rules
- `regeneration.prompt.ts` — table-level regeneration with feedback
- `diff-generation.prompt.ts` — generate diff against existing schema
- `orchestrator.prompt.ts` — top-level synthesis orchestrator

Database-specific table generation variants in `schema-synthesis/postgres/`, `schema-synthesis/mssql/`, `schema-synthesis/mongo/`.

### 6.4 Capability Awareness

The synthesis prompts receive the workspace's capability set (from Objective 4c) as context:

```typescript
interface CapabilityContext {
  driver: 'postgres' | 'mssql' | 'mongo';
  capabilities: {
    arrayColumns: boolean; // Postgres yes, MSSQL no, Mongo yes (as document arrays)
    jsonColumns: boolean;
    foreignKeysEnforced: boolean; // Postgres/MSSQL yes, Mongo advisory
    fullTextSearch: boolean;
    geospatial: boolean;
    materializedViews: boolean;
    triggers: boolean;
    storedProcedures: boolean;
    // ... full capability matrix
  };
  reservedWords: string[];
  identifierMaxLength: number;
  preferredIndexTypes: string[];
}
```

The prompts use this to generate appropriate schemas. A table generation prompt for Postgres might suggest an array column; the same prompt for MSSQL would suggest a junction table; for Mongo it might suggest an embedded array.

### 6.5 The User Flow

The user experience integrates with Objective 11's Schema Designer:

1. User triggers "Synthesize Schema from PRD" from the AI pipeline UI or from the Schema Designer
2. Brief loading state with progress ("Extracting entities...", "Generating tables...", "Validating coverage...")
3. Synthesis completes; user is redirected to the Schema Designer with the synthesized schema as a draft
4. The Schema Designer's UI shows:
   - The diagram view (entity relationship diagram of the synthesized schema)
   - A side panel highlighting AI-generated reasoning per table/column
   - PII detection results with confirm/reject options
   - Coverage warnings if any
5. User reviews; edits; approves; deploys
6. The synthesis artifact references the Schema Designer's schema artifact via `childArtifactIds`

This approach reuses the entire Schema Designer UX rather than duplicating it. The AI is the input; the rest of the flow is identical to hand-authored schemas.

### 6.6 New UI Components in the Schema Designer

A few additions to Objective 11's Schema Designer UI:

- `panels/AiReasoningPanel.tsx` — when a table or column was AI-generated, show its reasoning
- `panels/PiiConfirmationPanel.tsx` — confirm/reject AI-detected PII
- `panels/CoverageWarningsPanel.tsx` — show PRD coverage gaps
- `dialogs/RegenerateTableDialog.tsx` — request regeneration of a specific table with feedback
- `dialogs/RegenerateSchemaDialog.tsx` — full schema regeneration

These panels appear when a schema has an associated synthesis artifact; otherwise they're hidden. Hand-authored schemas don't see AI-specific UI.

### 6.7 Audit Events

```
ai.schema_synthesis.synthesis_started
ai.schema_synthesis.synthesis_completed
ai.schema_synthesis.table_regenerated
ai.schema_synthesis.full_regenerated
ai.schema_synthesis.coverage_validated
ai.schema_synthesis.pii_detected
ai.schema_synthesis.pii_confirmed
ai.schema_synthesis.applied_to_designer
ai.schema_synthesis.submitted_for_approval
ai.schema_synthesis.approved
ai.schema_synthesis.rejected
```

### 6.8 Permissions

```
ai.schema_synthesis.create
ai.schema_synthesis.read
ai.schema_synthesis.regenerate
ai.schema_synthesis.apply         — applies to Schema Designer (requires schema.create or schema.update from Objective 11)
ai.schema_synthesis.approve
```

Default role mappings:

- `workspace_owner`, `workspace_admin`: all
- `architect`: all (architects own data design in the master plan)
- `business_analyst`: read
- `developer`: read, regenerate (proposals only, not approve)
- `qa`, `reviewer`, `viewer`: read
- Custom roles configurable

### 6.9 Database Schema

Synthesized schemas are artifacts; no new tables required beyond what Objective 20 provides. The artifact's `content` is the SynthesizedSchema structure.

### 6.10 Quality Signal Specifics

```typescript
interface SchemaSynthesisQualitySignals {
  artifactId: string;

  // Coverage
  prdEntityCoverageRate: number; // 0-1; entities covered / total entities
  prdRequirementCoverageRate: number;

  // PII detection
  piiDetectionsAccepted: number;
  piiDetectionsRejected: number;
  piiDetectionsModified: number;
  piiDetectionsMissed: number; // user added PII flags after the fact

  // FK inference
  fksAccepted: number;
  fksRejected: number;
  fksAdded: number; // user added after the fact

  // Indexes
  indexesAccepted: number;
  indexesRejected: number;
  indexesAdded: number;

  // Edits
  totalTableEdits: number;
  totalColumnEdits: number;
  totalRegenerations: number;

  // Time
  totalTimeToApprovalMinutes: number;

  // Downstream
  causedDownstreamIssue: boolean; // Stage 6/7 hit schema problems
  downstreamIssueDescription?: string;
}
```

### 6.11 Operational Runbooks

- `schema-synthesis-coverage-gaps.md` — diagnosing when many synthesis runs fail coverage validation
- `schema-synthesis-database-mismatch.md` — when the AI generates schemas not suitable for the chosen database
- `schema-synthesis-pii-detection-tuning.md` — adjusting PII detection thresholds per workspace
- `schema-synthesis-conflict-with-existing.md` — handling synthesis when existing schema has conflicts

---

## 7. Implementation Order

1. **Synthesized schema schema** locked in TypeScript types + zod.

2. **Capability context loading** from Objective 4c.

3. **Entity extraction prompt** with test suite.

4. **Table generation prompts** (database-specific variants).

5. **Relationship modeling prompt.**

6. **PII detection prompt** with heuristic preprocessing.

7. **Index recommendation prompt.**

8. **Coverage validation prompt.**

9. **Naming validation prompt.**

10. **Diff generation prompt** for existing schema scenarios.

11. **Orchestrator prompt.**

12. **SchemaSynthesisService skeleton.**

13. **Synthesis end-to-end** producing a SynthesizedSchema artifact.

14. **Apply-to-Schema-Designer flow** — synthesis becomes a draft in Objective 11's UI.

15. **AI reasoning panel** in Schema Designer UI.

16. **PII confirmation panel.**

17. **Coverage warnings panel.**

18. **Regenerate table / regenerate full schema dialogs.**

19. **Stage pipeline integration** (submit, approve, reject).

20. **Conflict handling with existing schemas** — diff-based proposals.

21. **Cross-database tests** — synthesis produces equivalent quality on all three drivers.

22. **End-to-end test**: PRD → synthesis → Schema Designer → approval → deployment.

23. **Documentation, ADRs, runbooks.**

24. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0178: Synthesis Targets the Canonical Schema Model** — single source of truth; reuses Schema Designer
- **ADR-0179: Database-Aware Synthesis** — same PRD, different schema per driver; capability-driven
- **ADR-0180: Whole-Schema Generation, Per-Table Refinement** — tables have natural cohesion
- **ADR-0181: PII Detection Requires User Confirmation** — heuristic + AI judgment + human verification
- **ADR-0182: Diff-Based Proposals for Existing Schemas** — additive by default; destructive changes via Schema Designer
- **ADR-0183: Coverage Validation as Warning, Not Block** — gaps surfaced; user decides whether to address

---

## 9. Verification Steps

1. **Synthesize from a simple PRD** (CRM-style); produces tables for users, contacts, deals, activities; relationships correct.

2. **Database-specific generation**: same PRD on Postgres workspace produces JSONB and array columns; on MSSQL produces equivalent without arrays; on Mongo produces document-oriented schema.

3. **PII detection**: a `users` table's `email`, `phone`, `name` columns flagged; user confirms/modifies.

4. **FK inference**: relationships in PRD become FKs (or junctions where appropriate).

5. **Index recommendations**: PKs and FKs indexed; columns mentioned as filterable indexed.

6. **Coverage validation**: PRD entity not represented surfaces as warning.

7. **Reasoning visible**: each table and column has reasoning the user can read.

8. **Apply to Schema Designer**: synthesized schema appears as a draft; user navigates to Schema Designer and reviews.

9. **Regenerate single table**: user requests regeneration with feedback; only that table regenerates; others preserved.

10. **Regenerate full schema**: user requests; full schema regenerates with feedback.

11. **Existing schema scenario**: workspace has 5 tables; synthesis proposes 3 new tables, 4 new columns on existing tables, no destructive changes; diff shown clearly.

12. **Approval flow**: synthesis → submit → approve (per workspace config) → deploy via Schema Designer's standard flow.

13. **Reject and revise**: user rejects with feedback; user revises and resubmits.

14. **Naming validation**: AI generates a column named `order` (reserved); platform catches and renames.

15. **Capability respect**: Mongo schema uses embedded documents where appropriate; Postgres uses arrays; MSSQL uses junctions.

16. **Provider failover**: synthesis mid-flight fails over to backup provider; result attributed correctly.

17. **Output schema validation**: malformed AI output triggers retry; persistent failure surfaces error.

18. **Cost tracking**: synthesis cost recorded; per-prompt costs visible.

19. **Audit events**: all lifecycle actions emit expected entries.

20. **Stale on PRD change**: modifying upstream PRD marks synthesis stale; affected tables identifiable.

21. **Cross-database conformance**: synthesis works equivalently on all three drivers.

22. **PRD coverage report**: produced; shows covered/uncovered entities.

23. **Performance**: synthesis of typical schema (10-15 tables) within 2-3 minutes.

24. **Quality signals**: PII acceptance rate, edit volume, etc. recorded.

If all 24 pass, the objective is met.

---

## 10. Definition of Done

**Schema & Types**

- [ ] SynthesizedSchema artifact type
- [ ] All sub-structures (CoverageReport, PiiDetectionRecord, IndexRecommendation, SchemaDiff)
- [ ] Capability context loading

**Prompts**

- [ ] Entity extraction prompt
- [ ] Table generation prompts (per database)
- [ ] Relationship modeling prompt
- [ ] PII detection prompt
- [ ] Index recommendation prompt
- [ ] Coverage validation prompt
- [ ] Naming validation prompt
- [ ] Diff generation prompt
- [ ] Regeneration prompt
- [ ] Orchestrator prompt
- [ ] Test suites per prompt

**Service Layer**

- [ ] SchemaSynthesisService implemented
- [ ] All synthesis, regeneration, validation methods
- [ ] Apply to Schema Designer flow
- [ ] Stage pipeline integration

**UI Integration with Schema Designer**

- [ ] AI reasoning panel
- [ ] PII confirmation panel
- [ ] Coverage warnings panel
- [ ] Regenerate dialogs

**Quality & Observability**

- [ ] Quality signals recorded
- [ ] Per-prompt dashboards
- [ ] Stage-specific metrics

**Permissions**

- [ ] Stage permissions added
- [ ] Default role grants

**Cross-Database**

- [ ] Conformance tests pass on all three drivers
- [ ] Capability-aware synthesis verified

**Documentation**

- [ ] ADRs 0178–0183 written and Accepted
- [ ] All runbooks in Section 6.11 written
- [ ] Customer-facing schema synthesis guide
- [ ] Example synthesis walkthroughs (CRM, blog, dashboard)

**Verification**

- [ ] All 24 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Generating a schema that doesn't respect the database's capabilities.** Capability matrix is sacred.
- **Auto-flagging PII without user confirmation.** Heuristic + AI judgment + human verification.
- **Destructive changes to existing schemas without user direction.** Additive by default.
- **Skipping coverage validation.** PRD entities should be covered; gaps surfaced.
- **Generating schemas that bypass Objective 11's Schema Designer.** Same surface, same review flow.
- **Special "auto-deploy" privilege for AI schemas.** Goes through standard approval and migration flow.
- **Hardcoding entity-extraction logic.** Lives in a prompt; iterable.
- **Letting AI propose strange types just because they're technically possible.** AI uses well-supported types; exotic types only when PRD requires them.
- **Indexing every column "just in case".** Indexes have write costs; recommend the minimum useful set.
- **Silent failures during synthesis.** Failures surface to user with clear messages.

---

## 12. Open Questions for Confirmation Before Starting

1. **Whole-schema generation as default** — confirmed? Some teams might prefer entity-by-entity. Recommendation: whole schema by default; per-table regeneration handles iterations.

2. **PII confirmation step required** — proposing yes; user must explicitly accept or reject AI-detected PII. Some users will find this annoying. Recommendation: required for first-time synthesis; subsequent runs respect prior decisions.

3. **Index recommendations conservative or aggressive** — proposing conservative (PKs, FKs, explicitly-mentioned filterable/sortable). Some teams prefer aggressive (anticipate query patterns). Recommendation: conservative; users add more as they observe query patterns.

4. **Database-specific prompts vs. general prompt with capability hints** — proposing database-specific prompts. Cleaner separation but more code. Recommendation: yes, separate prompts.

5. **Existing schema diff defaults to additive only** — confirmed? Or should it propose destructive changes when the AI is confident they're needed? Recommendation: additive only; destructive changes via Schema Designer.

6. **Cost target $0.50–$3.00** — appropriate for a typical schema (10-15 tables)? Recommendation: yes; configurable per workspace.

---

## 13. What Comes Next

With Objective 24 complete, the schema for the customer's project is generated and deployed to their database. The data plane (REST + GraphQL + Realtime + Storage from earlier objectives) automatically becomes available — APIs, real-time subscriptions, and the data browser all work against the new schema without additional work.

**Objective 25: Stage 5 — Data Migration** is next. For projects starting with existing data (a rebuild of a legacy system, an import from spreadsheets, etc.), the AI helps map old data structures to the new schema and generates migration scripts. Skipped for greenfield projects.

The remaining stages chain forward:

- **26: UI Generation** — components from tokens + schema
- **27: Code Generation** — server-side logic, integrations
- **28: Test Generation** — from acceptance criteria
- **29: Deployment** — through environments
- **30: Maintenance** — feedback loops

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 25._
