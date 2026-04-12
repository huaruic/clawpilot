---
name: search-researcher
description: "Conduct multi-angle web research on a topic using web_search, then synthesize findings into a structured report. Use when: (1) user asks to research a topic, trend, or question, (2) user wants competitive intelligence or market research, (3) user says 'research this' or 'find out about'. NOT for: scraping a specific URL (use web-scraper), writing content (use content skills), or academic paper review. Requires: web_search tool (needs search API key configured in Settings)."
---

# Search Researcher

Conduct structured web research on any topic and deliver a synthesized report with sources.

## When to Use

- "Research the latest trends in [topic]"
- "Find out what competitors are doing about [X]"
- "What's the current state of [industry/technology]?"
- "Help me understand [complex topic]"
- Any request that needs information gathering from multiple web sources

## When NOT to Use

- Extracting data from a specific URL (use `web-scraper`)
- Writing content based on research (do research first, then use a writing skill)
- Real-time data like stock prices or live scores
- Academic literature review (web search doesn't cover academic databases well)

## Prerequisites

This skill requires `web_search` to be configured. If not set up, inform the user:
"Web search requires an API key. Go to Settings > Search Provider to configure one (Brave Search offers 2,000 free queries/month)."

## Research Workflow

### Step 1: Decompose the Question

Break the user's request into 3-5 specific search queries from different angles:

- **Factual angle**: What are the basic facts?
- **Trend angle**: What's changing or emerging?
- **Opinion angle**: What do experts/users think?
- **Comparison angle**: How does X compare to Y?
- **Problem angle**: What are the challenges or criticisms?

### Step 2: Execute Searches

Run each query via `web_search`. For each result:
- Note the source URL and credibility
- Extract key claims and data points
- Flag conflicting information across sources

### Step 3: Synthesize

Combine findings into a structured report. Do NOT just list search results — synthesize across sources.

## Output Format

```markdown
# Research Report: [Topic]

## Key Findings
- Finding 1 (supported by N sources)
- Finding 2
- Finding 3

## Detailed Analysis

### [Angle 1]
[Synthesized narrative with inline source references]

### [Angle 2]
[Synthesized narrative]

## Conflicting Information
- [Claim A] vs [Claim B] — sources disagree on this point

## Sources
1. [Source title] — [URL]
2. [Source title] — [URL]

_Research conducted on YYYY-MM-DD. N queries across M sources._
```

## Notes

- Default to 3-5 search queries per research task; ask user before doing more
- Always cite sources — never present web findings as your own knowledge
- Flag low-credibility sources (forums, anonymous blogs) vs high-credibility (official sites, established publications)
- If web_search is not available, inform the user and suggest configuring it in Settings
