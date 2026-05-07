---
name: Auto-commit after every completed task
description: User requires automatic git commit after each task completion — never ask for confirmation, just commit
type: feedback
originSessionId: ff03b91b-1a72-4c85-961c-da6c482a0d0c
---

Always commit immediately after completing any implementation task. Do not ask "should I commit?" or wait for permission.

**Why:** User explicitly instructed: "complete a task and commit automatically must be by default now don't ask just do" — confirmed after losing Obj 22/23 work when a branch was cleaned up without committing.

**How to apply:** After every discrete piece of work (service implemented, component built, migration written, test added, gap closed), stage the relevant files and commit with a descriptive message before continuing to the next task. Never batch work across sessions without committing. Use `git -C "C:/private/Lighthouse Studio" add <files> && git -C "C:/private/Lighthouse Studio" commit -m "..."` pattern.
