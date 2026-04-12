---
name: summarizer
description: "Summarize long text, articles, documents, or pasted content into concise key points. Use when: (1) user provides long text and asks for a summary, (2) user says 'summarize this' or 'give me the key points', (3) user pastes an article or document for condensing, (4) user asks for meeting/conversation highlights. NOT for: rewriting with style changes (use content-rewriter), translation (use translator), or summarizing web pages by URL (use web-scraper to fetch first)."
---

# Summarizer

Condense long content into clear, structured summaries while preserving key information.

## When to Use

- "Summarize this article"
- "Give me the key points"
- "TL;DR this"
- "What are the main takeaways?"
- User pastes a long block of text

## When NOT to Use

- Rewriting in a different style (use `content-rewriter`)
- Summarizing a web page by URL (use `web-scraper` to fetch content first, then summarize)
- Translating (use `translator`)
- Extracting structured data from text (use `data-analyzer`)

## Summary Framework

### Step 1: Assess Content Type

| Content Type | Summary Approach |
|-------------|-----------------|
| News article | Who, what, when, where, why |
| Opinion/essay | Core argument + key supporting points |
| Meeting notes | Decisions made + action items + open questions |
| Technical doc | Purpose + key concepts + implications |
| Long conversation | Main topics discussed + conclusions |

### Step 2: Determine Length

| User Signal | Summary Length |
|------------|---------------|
| "TL;DR" or "one sentence" | 1-2 sentences |
| "Key points" or "highlights" | 3-5 bullet points |
| "Summary" (default) | 1 paragraph (100-200 words) |
| "Detailed summary" | Multiple paragraphs with sections |

### Step 3: Summarize

Rules:
- Lead with the most important point, not chronological order
- Use the author's key terms (don't paraphrase technical terms)
- Preserve numbers, dates, and proper nouns exactly
- Distinguish facts from opinions in the summary
- If content contains action items or decisions, always highlight them

## Output Format

```markdown
## Summary

[Concise summary paragraph]

## Key Points
- [Most important point]
- [Second point]
- [Third point]

## Action Items (if applicable)
- [ ] [Action 1]
- [ ] [Action 2]

_Original length: ~N words → Summary: ~N words (N% reduction)_
```

## Notes

- Always state the reduction ratio (original vs summary length)
- If the original text is unclear or contradictory, note it rather than guessing the intent
- For meeting notes, always extract action items with owners if mentioned
- Default to the same language as the input text
- If user provides text in chunks, wait for all chunks before summarizing (ask "is there more?")
