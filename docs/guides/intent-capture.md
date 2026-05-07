# Intent Capture: Customer Guide

Intent Capture is the first stage of the AI Build Pipeline. It's a guided AI conversation that transforms your project idea into a structured project brief — the foundation for everything the pipeline generates next.

---

## What Intent Capture Does

When you describe a project to the AI, a lot of important detail is implicit — things you know but haven't said, assumptions you're making, constraints you haven't articulated. Intent Capture surfaces that detail through a structured conversation.

By the end of an Intent Capture conversation, you have a **project brief**: a structured document that captures your project's goals, users, key features, constraints, and open questions. This brief is the input to the next pipeline stage (PRD generation).

Think of it as working with a business analyst who is skilled at asking the right questions — but who operates at the speed of AI.

---

## Starting a Conversation

1. Navigate to **AI Pipeline** in the left navigation.
2. Click **New Project**.
3. Choose a starter template (see below) or select **Start from scratch**.
4. Type your initial project description in the message field and press **Send** (or `Ctrl+Enter`).

Your first message can be as rough or as polished as you like. "I want to build a task manager for remote teams" is a perfectly valid starting point. The AI will ask clarifying questions to fill in the gaps.

---

## How the Conversation Works

The AI acts as an investigative collaborator. It will:

- **Ask clarifying questions** — one or two at a time, focused on the most important gaps. It won't overwhelm you with a long list.
- **Surface assumptions** — if it interprets something a specific way, it will tell you and check whether that's right.
- **Identify gaps** — things that need to be decided before the build pipeline can proceed (e.g., "You mentioned users — are these internal employees, paying customers, or both?").
- **Summarise understanding** — periodically, it will summarise what it has understood so far so you can correct any misinterpretations early.

The conversation is natural. You can redirect it, go back to a point, or add context at any time.

---

## The Brief Preview Panel

On the right side of the conversation screen, you'll see the **Brief Preview** panel. This updates in real time as the conversation progresses.

The brief has sections that correspond to the key areas of a project specification:

- **Overview** — what the project is and who it's for
- **Goals** — what success looks like
- **Users** — who will use the product and their key needs
- **Features** — the capabilities the product must have
- **Constraints** — technical, business, or time constraints
- **Open Questions** — things that need a decision before building can start

As the AI extracts information from the conversation, it populates these sections. You can watch the brief take shape in real time.

---

## Templates

Templates give you a head start by pre-loading common project patterns into the conversation. When you choose a template, the brief starts partially populated with the typical sections for that project type, and the AI's opening questions are tailored accordingly.

Available templates include:
- **SaaS Web Application** — multi-tenant web app with user accounts
- **Internal Tool** — employee-facing tool, usually single-tenant
- **Mobile App** — iOS/Android or cross-platform
- **API / Integration** — a backend service or integration layer
- **Data Pipeline** — data ingestion, transformation, or reporting

If your project doesn't fit a template, **Start from scratch** gives you a blank slate. The AI will ask broader initial questions to orient itself.

---

## The Bounded Conversation Limit

Each conversation has a limit of **25 turns** (25 messages from you + 25 AI responses). This limit exists to keep conversations focused and costs bounded.

25 turns is enough for most projects. If you reach the limit before the brief feels complete:

1. **Edit the brief directly** (see below) — for many projects, the most efficient path after the initial conversation is to edit the brief sections directly rather than continuing to converse.
2. **Start a follow-up conversation** — you can create a new conversation linked to the same project. The existing brief is carried over as context, so you pick up where you left off.

The turn counter is visible in the top right of the conversation panel.

---

## Editing the Brief Directly

At any point — mid-conversation or after — you can edit the brief directly. Click any section in the Brief Preview panel to enter edit mode.

Two editing modes are available:

- **Structured editing** — a form-based editor for each section. Best for precise, field-by-field edits.
- **Markdown editing** — a text editor where you can write the section content in Markdown. Best for longer, free-form sections or when you want to paste in existing content.

Changes you make directly to the brief are saved immediately. The AI will be aware of your direct edits in subsequent conversation turns (it reads the current brief state before generating each response).

---

## Submitting for Approval

If your workspace has approval routing configured, the brief must be approved before the pipeline can proceed to the next stage.

When the brief feels complete:

1. Click **Submit for Approval** in the top right.
2. Select the approver(s) from your workspace member list.
3. Add an optional note for context.
4. Click **Submit**.

Approvers receive a notification and can review the brief in the approval view. They can approve, reject with comments, or request changes. If rejected, you return to the conversation to address the feedback.

If your workspace does not have approval routing configured, the brief can move directly to the next stage by clicking **Proceed to PRD Generation**.

---

## The Cost Indicator

The cost indicator at the bottom of the conversation shows the estimated AI cost consumed by the current conversation. This counts tokens used for the AI's responses only (your messages are much cheaper to process).

The indicator shows:
- **Current conversation cost** — what this conversation has consumed so far
- **Remaining budget** — how much of your workspace's monthly AI budget is still available

If your workspace approaches its monthly budget limit, Intent Capture conversations will pause and you'll see a notification. See your workspace settings → AI Usage to review and adjust your budget allocation.

---

## Frequently Asked Questions

**Can I have multiple conversations for the same project?**

Yes. You can create multiple conversations linked to the same project. This is useful when you want to explore different directions before committing to a brief, or when you've hit the 25-turn limit and need to continue. Each conversation produces a brief snapshot; you choose which snapshot to use as the project brief.

**Can I share the brief with someone outside the platform?**

Briefs live within your workspace. You can share the brief with other workspace members by inviting them to the workspace or by sharing a read-only link (available from the brief's "Share" button if your installation admin has enabled external sharing). For external stakeholders, the export option (Brief Preview → Export → PDF or Markdown) produces a document you can share outside the platform.

**What happens if I close the browser mid-conversation?**

Your conversation is saved automatically after every turn. If you close the browser, the conversation is preserved exactly where you left it. The brief snapshot is also preserved. Reopen the conversation from the AI Pipeline section to continue where you left off.

**Can I rename or reorganise the brief sections?**

The brief section structure is fixed (it mirrors the 13-section PRD structure that the next pipeline stage uses). You cannot add or remove sections, but each section's content is entirely editable. The section names are shown in the Brief Preview panel and cannot be renamed.

**Why does the AI ask about technical implementation?**

In Intent Capture, the AI avoids technical implementation questions — it focuses on what and why, not how. If the AI asks about implementation, the system prompt for your installation may have been customised. Check with your workspace administrator.
