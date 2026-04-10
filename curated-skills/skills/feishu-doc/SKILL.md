---
name: feishu-doc
description: "Read, organize, and work with Feishu (Lark) document content. Use when: (1) user asks to create content for Feishu docs, (2) user wants to structure information in Feishu-friendly format, (3) user mentions Feishu/Lark document workflows. NOT for: sending Feishu messages (use Feishu channel integration), calendar operations, or Feishu approval workflows. Note: actual Feishu API access requires Feishu MCP configuration."
---

# Feishu Doc

Create and organize content optimized for Feishu (Lark) document format and workflows.

## When to Use

- "Create a Feishu doc for [topic]"
- "Format this content for Feishu"
- "Write a project brief in Feishu format"
- "Organize this into a Feishu-friendly structure"

## When NOT to Use

- Sending Feishu messages (use Feishu channel integration in ClawPilot)
- Feishu calendar or scheduling
- Feishu approval workflows
- Non-Feishu document formats

## Feishu Document Formatting

### Supported Elements

Feishu docs support rich formatting. Structure content using:

- **Headings**: H1-H3 for document hierarchy
- **Bullet lists**: For unordered items
- **Numbered lists**: For sequential steps
- **Task lists**: Checkbox items with assignees
- **Tables**: For structured data comparison
- **Callout blocks**: For warnings, tips, or highlights
- **Code blocks**: For technical content
- **Dividers**: For section separation

### Document Templates

**Project Brief:**
```markdown
# [Project Name]

## Background
[Why this project exists — 2-3 sentences]

## Objectives
1. [Primary objective]
2. [Secondary objective]

## Scope
**In scope:**
- [Item]

**Out of scope:**
- [Item]

## Timeline
| Milestone | Date | Owner |
|-----------|------|-------|
| [Milestone] | [Date] | [Name] |

## Risks
- [Risk 1]: Mitigation: [approach]
```

**Meeting Agenda:**
```markdown
# [Meeting Title] — [Date]

**Attendees**: [names]
**Duration**: [time]

## Agenda Items
1. [Topic] (N min) — [presenter]
2. [Topic] (N min) — [presenter]

## Pre-reading
- [Document link or context]

## Action Items from Last Meeting
- [ ] [Item] @[owner]
```

**Weekly Report:**
```markdown
# Weekly Report: [Team/Project] — [Week]

## Completed This Week
- [Achievement with impact noted]

## In Progress
- [Task] — [% complete] — [expected completion]

## Blockers
- [Blocker] — [who can unblock]

## Plan for Next Week
- [Priority 1]
- [Priority 2]
```

## Output Format

Always output in Markdown that's directly pasteable into Feishu:
- Use standard Markdown syntax (Feishu renders it natively)
- Include task items as `- [ ] task @owner` format
- Use tables for any comparative or timeline data
- Add callout blocks as `> [!TIP]` or `> [!WARNING]` for emphasis

## Notes

- Feishu renders standard Markdown well — no special syntax needed
- For actual Feishu API operations (creating docs programmatically, reading existing docs), the user needs Feishu MCP configured in ClawPilot
- This skill focuses on content creation and formatting, not API operations
- Default to Chinese for Feishu content unless user specifies otherwise
- Keep documents scannable — Feishu users often skim on mobile
