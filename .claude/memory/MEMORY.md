# Memory Index (shared — committed to repo)

> **Private addendum:** at session start, also read `.claude/memory-private/MEMORY.md` if it exists (gitignored). Personal preferences and non-shareable context live there.

- [Project-level skills available](project_skills.md) — three repo-scoped skills (objective-verifier, service-shape-check, adr-writer) live in .claude/skills/ for use during objective work
- [Proactively scan new objectives for skill gaps](feedback_skill_gap_check.md) — before implementing any objective, check if a missing skill would speed up this and future objectives; propose before coding
- [Never claim an objective is complete without full verification](feedback_verify_before_done.md) — run objective-verifier and confirm every Definition of Done item is ✅ before saying "done"; prior failure on Objective 6
- [Always produce an Aggregate Verification Report after objective-verifier runs](feedback_aggregate_report.md) — structured headline + table + blockers + recommendation; never skip even for single-objective runs
- [Verification claims must cite concrete file evidence](feedback_verify_with_files.md) — never mark ❌/⚠️ without reading the actual file; reminder to repeat in subagent prompts
- [Evolutionary self-improvement after each task](feedback_evolutionary_improvement.md) — reflect for memory/skill/hook/agent upgrades; propose (don't silently apply) and prune stale memories
