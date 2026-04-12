---
name: content-rewriter
description: "Rewrite existing content while preserving core meaning, changing expression style, tone, or structure. Use when: (1) user provides text and asks to rewrite, rephrase, or paraphrase it, (2) user wants to change tone (formal to casual, or vice versa), (3) user asks to make content more engaging or concise, (4) user says 'rewrite this' or 'rephrase'. NOT for: translation between languages (use translator), writing from scratch (use content creation skills), or summarizing (use summarizer)."
---

# Content Rewriter

Rewrite existing content with a different tone, style, or structure while preserving the core message.

## When to Use

- "Rewrite this in a more casual tone"
- "Make this more engaging"
- "Rephrase this paragraph"
- "Rewrite this for a different audience"
- "Make this more concise / more detailed"

## When NOT to Use

- Translating between languages (use `translator`)
- Writing new content from scratch (use `xiaohongshu-writer`, `wechat-article`, etc.)
- Summarizing long text (use `summarizer`)
- Fixing grammar only (just fix it directly, no skill needed)

## Rewriting Framework

### Step 1: Analyze the Original

Before rewriting, identify:
- **Core message**: What must be preserved?
- **Current tone**: Formal? Casual? Technical? Emotional?
- **Target audience**: Who was this written for?
- **Key data**: Numbers, names, quotes that must stay accurate

### Step 2: Determine the Target Style

If the user specifies a style, use it. If not, ask or default to:
- Same meaning, different words (standard rephrase)
- More concise (reduce by ~30% without losing meaning)
- More engaging (add hooks, questions, stronger verbs)

### Style Presets

| Preset | Characteristics |
|--------|----------------|
| Casual | Short sentences, contractions, conversational, relatable |
| Professional | Clear, structured, no slang, active voice |
| Persuasive | Strong verbs, emotional hooks, clear CTA |
| Concise | Remove filler, combine sentences, trim adjectives |
| Storytelling | Narrative arc, sensory details, personal angle |

### Step 3: Rewrite

Rules:
- Never invent facts not in the original
- Preserve all numerical data and proper nouns exactly
- Change at least 70% of the wording (not just synonym swaps)
- Maintain the same paragraph count unless user asks to restructure

## Output Format

```
[Rewritten version]

---
Changes made:
- [Brief note on what changed and why]
- Tone: [original] -> [new]
- Length: [original word count] -> [new word count]
```

## Notes

- If the original text contains factual claims, preserve them exactly — rewriting is about expression, not content
- For Chinese content, maintain natural Chinese phrasing rather than translationese
- When rewriting for social media, adjust paragraph length and add visual breaks
- If the user provides multiple paragraphs, rewrite each while maintaining logical flow between them
