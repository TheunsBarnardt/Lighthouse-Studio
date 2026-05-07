# Schema Synthesis Guide (Stage 4)

Schema Synthesis is Stage 4 of the AI Build Pipeline. It takes an approved PRD and produces a complete database schema ready to review in the Schema Designer and deploy to your database.

---

## Prerequisites

- A PRD in **Fully Approved** status (all 13 sections approved)
- Navigate to **AI Pipeline → Schema Synthesis** to begin

---

## Choosing Your Database

Select your target database before synthesis runs:

| Database | Best for |
|----------|---------|
| **PostgreSQL** | Most projects; full SQL feature set including array columns, JSONB, full-text search |
| **SQL Server (MSSQL)** | Microsoft-stack environments; enterprise compliance requirements |
| **MongoDB** | Document-oriented data; flexible schemas; rapid iteration |

The synthesized schema is tailored to your chosen database. You can't change the database after synthesis; start a new synthesis if needed.

---

## Running Synthesis

Click **Synthesize Schema**. The AI will:

1. Extract entities and relationships from your PRD
2. Generate tables with columns, types, and defaults
3. Model relationships (foreign keys, junction tables, or references)
4. Detect PII columns
5. Recommend indexes
6. Validate coverage against the PRD

Synthesis typically takes 2–3 minutes for a typical schema (10–15 tables).

---

## Reviewing the Summary

After synthesis, you'll see:

- **Tables generated** — total table count
- **PRD entity coverage** — what % of PRD-mentioned entities have tables
- **PII to confirm** — how many columns need PII confirmation

### Coverage Gaps

If the AI omitted PRD entities, they appear as warnings. Review them and decide whether to add the missing tables manually in Schema Designer. Coverage gaps don't block approval; they're advisory.

---

## Opening in Schema Designer

Click **Open in Schema Designer** to load the synthesized schema as a draft.

In the Schema Designer, you'll see three additional panels:

### AI Reasoning Panel
Every AI-generated table and column shows the reasoning behind its design. Click any table or column to see:
- Why the AI included this table
- Which PRD requirements it addresses
- Design decisions made for your database

### PII Confirmation Panel
Columns flagged as containing personal data appear here. For each:
- **Accept** — confirm the column contains PII as described
- **Reject** — the column doesn't contain PII

You must confirm all PII detections before submitting for approval. The Schema Designer shows a pending count.

### Coverage Warnings Panel
Shows any PRD entities without tables. Review and add tables as needed.

---

## Making Edits

Edit the schema as you would any hand-authored schema:
- Click a table to edit columns, types, constraints
- Drag to reposition in the diagram view
- Add new tables using the + button
- Delete tables or columns using the context menu

---

## Regenerating

### Regenerate a Single Table
Right-click any table → **Regenerate with AI**. Provide feedback:

> *"Add a status column with values: draft, active, archived"*
> *"Include soft-delete support (deleted_at column)"*

Only that table regenerates; all others are unchanged.

### Regenerate Full Schema
Click **Regenerate** in the synthesis summary. The AI re-runs the full synthesis with your feedback. All tables are replaced.

---

## Existing Schemas (Iterating on an Existing Project)

If your workspace already has a schema:

- Synthesis runs in **diff mode**: only additions are proposed
- New tables appear as "AI proposed" in the Schema Designer
- New columns on existing tables are shown as proposals
- Nothing is deleted; destructive changes happen via the Schema Designer's migration flow

---

## Submitting for Approval

Once satisfied:

1. Resolve all PII confirmations (pending PII blocks approval)
2. Review coverage warnings (address if needed; they don't block)
3. Click **Submit for Approval**

In **solo workspaces**, your submission is immediately approved. In **team workspaces**, the configured approvers (typically architects) receive a notification.

Once approved, the schema deploys via the Schema Designer's standard migration flow.

---

## What Comes Next

With an approved schema, the data plane activates:
- **REST API** and **GraphQL API** are available on your schema via Objective 12
- **Real-time subscriptions** work on your new tables via Objective 14
- **Data Browser** (Objective 13) can query your data immediately

Then you can proceed to:
- **Stage 5: Data Migration** (if you have existing data to import)
- **Stage 6: UI Generation** (components from design tokens + schema)

---

## Cost

Schema synthesis typically costs **$0.50–$3.00** depending on schema complexity. Cost is tracked per workspace in the usage dashboard.
