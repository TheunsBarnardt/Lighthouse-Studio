# Schema Designer User Guide

The Schema Designer is the visual editor for defining and managing your database schemas. It supports PostgreSQL, SQL Server (MSSQL), and MongoDB, and keeps three synchronized views — Diagram, Table, and Code — in sync at all times.

---

## Getting Started

### Opening a Schema

From the Data Management page, click any schema card to open it in the designer. If you have no schemas yet, click **+ New Schema**.

### Creating a Schema

1. Click **+ New Schema** on the Data Management page.
2. Select a template (Blank, Blog, CRM, Task Tracker, or E-Commerce).
3. Fill in the name and slug. The slug is used in URLs and API paths.
4. Choose a database driver (PostgreSQL, SQL Server, or MongoDB).
5. Click **Create Schema**. The designer opens immediately.

---

## The Three Views

Switch between views using the tabs at the top of the designer.

### Diagram View

The Diagram view shows tables as cards and foreign keys as connecting lines. Use it to understand and design relationships between tables.

**Creating a table:** Click **+ Table** in the toolbar.

**Moving tables:** Drag a table card to reposition it. Positions are saved automatically.

**Creating a foreign key:** Hover over a table's right edge until the connection handle appears, then drag to another table. A placeholder FK is created — fill in the details in the Table view.

**Zooming and panning:** Scroll to zoom; drag the background to pan. Click **Fit** to fit all tables in the viewport.

### Table View

The Table view shows a spreadsheet-like editor for each table's columns. Use it to define column names, types, nullability, and PII status precisely.

**Selecting a table:** Click a table name in the left sidebar.

**Adding a column:** Click **+ Add Column** below the column list.

**Editing a column:**

- Click any cell to edit it inline.
- **Name:** snake_case identifiers. Reserved words are flagged.
- **Type:** Choose from the normalized type list. Types unsupported by your database driver are disabled with an explanation tooltip.
- **Nullable:** Check to allow NULL values.
- **PII:** Check to mark the column as containing personal data. Select a category from the dropdown.
- **Description:** Optional documentation string.

**Removing a column:** Hover over the row and click the × button. Columns that are part of the primary key cannot be removed.

### Code View

The Code view shows the full schema as JSON in a Monaco editor (the same editor as VS Code). Use it for bulk edits or to paste in schema definitions.

**Editing:** Type directly in the editor. Changes are applied to the store 600ms after you stop typing (debounced).

**Invalid JSON:** A red error badge appears in the toolbar. The previous valid schema is preserved until you fix the syntax error.

**Format:** Click **Format** to pretty-print the JSON with canonical key ordering.

---

## Saving and Deploying

Changes are held in memory until you deploy. The deploy bar at the bottom appears when you have unsaved changes.

### Validate

Click **Validate** to check the schema for errors, warnings, and informational notices. Errors block deployment; warnings and info are advisory.

### Preview Migration

After validation passes, click **Preview Migration** to see what SQL (or MongoDB commands) will run to bring the live database in line with your schema. Destructive changes (column drops, type changes) are called out explicitly.

### Deploy

Click **Deploy** and confirm. The migration runs against the live database. The version number increments on success.

### Discard

Click **Discard** to throw away all unsaved changes and revert to the last deployed version.

---

## Version History

Click the **History** tab to see all previous versions of the schema. Each version shows:

- Version number
- Who deployed it and when
- How many tables were in the schema

Click **Rollback** on any non-current version to revert the live database and schema to that point.

---

## Database Driver Differences

Some features are only available on certain database drivers:

| Feature                 | PostgreSQL | SQL Server | MongoDB       |
| ----------------------- | ---------- | ---------- | ------------- |
| Arrays                  | ✓          | —          | ✓             |
| JSONB                   | ✓          | —          | ✓             |
| Row-Level Security      | ✓          | ✓          | —             |
| Generated columns       | ✓          | ✓          | —             |
| Check constraints       | ✓          | ✓          | —             |
| Foreign key enforcement | ✓          | ✓          | Advisory only |
| Change streams          | —          | —          | ✓             |

Unavailable controls are grayed out with a tooltip explaining the limitation.

---

## PII Tagging

Mark columns containing personal data by checking **PII** in the Table view. Select a category:

- **Contact** — email, phone, address
- **Identification** — national ID, passport, SSN
- **Financial** — credit card, bank account
- **Health** — medical records, diagnoses
- **Behavioral** — clickstream, preferences
- **Location** — GPS, IP address
- **Credential** — passwords, API keys
- **Other**

PII tags feed into the personal data registry (Objective 7) and are surfaced in compliance reports.

---

## API Explorer

Click the **API Explorer** tab to see the live OpenAPI spec for this schema's data API. Available once the REST API (Objective 12) is deployed.
