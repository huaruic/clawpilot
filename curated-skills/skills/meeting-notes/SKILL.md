---
name: meeting-notes
description: "Organize raw meeting notes, transcripts, or conversation logs into structured minutes with decisions, action items, and key discussion points. Use when: (1) user pastes meeting notes or transcript and asks to organize them, (2) user says 'clean up these meeting notes' or 'create minutes from this', (3) user wants action items extracted from a conversation. NOT for: scheduling meetings, sending meeting invites, or summarizing non-meeting content (use summarizer)."
---

# Meeting Notes

Transform raw meeting notes or transcripts into structured, actionable minutes.

## When to Use

- "Organize these meeting notes"
- "Extract action items from this meeting"
- "Create minutes from this transcript"
- "Clean up these notes into a proper format"
- User pastes raw/messy meeting notes

## When NOT to Use

- Summarizing articles or documents (use `summarizer`)
- Scheduling or sending calendar invites
- Writing meeting agendas (different from notes)
- Real-time transcription

## Processing Workflow

### Step 1: Parse the Raw Input

Identify from the messy notes:
- **Participants**: Who was mentioned or speaking?
- **Topics discussed**: Group scattered notes by theme
- **Decisions made**: Explicit "we decided" or "agreed to" statements
- **Action items**: Tasks assigned, with owner and deadline if mentioned
- **Open questions**: Unresolved issues that need follow-up

### Step 2: Structure the Output

Organize chronologically within each section, but group by topic rather than strict time order.

### Step 3: Highlight What Matters

Action items and decisions are the most important output — they should be immediately visible, not buried in prose.

## Output Format

```markdown
# Meeting Minutes: [Topic/Title]

**Date**: [date if mentioned]
**Participants**: [names if mentioned]

## Key Decisions
1. [Decision with context]
2. [Decision]

## Action Items
| # | Task | Owner | Deadline | Status |
|---|------|-------|----------|--------|
| 1 | [task description] | [name] | [date] | Pending |
| 2 | [task description] | [name] | [date] | Pending |

## Discussion Summary

### [Topic 1]
[Key points discussed, 2-3 sentences]

### [Topic 2]
[Key points discussed]

## Open Questions
- [Unresolved question 1]
- [Unresolved question 2]

## Next Steps
- [Follow-up meeting or checkpoint if mentioned]
```

## Notes

- If no names are mentioned, use "TBD" for action item owners and suggest the user fill them in
- If no dates are mentioned for deadlines, note "No deadline set" rather than guessing
- Distinguish between decisions (confirmed) and suggestions (proposed but not agreed)
- If the raw notes are very short or unclear, output what you can and flag gaps: "Could not determine: [what's missing]"
- Default to the same language as the input notes
