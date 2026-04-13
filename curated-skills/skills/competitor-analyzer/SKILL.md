---
name: competitor-analyzer
description: "Analyze competitor content strategy by examining their posts, topics, engagement patterns, and content gaps. Use when: (1) user provides competitor accounts or URLs to analyze, (2) user asks 'what are my competitors doing', (3) user wants to understand why competitor content performs well, (4) user asks for competitive content analysis. NOT for: general topic research (use topic-generator), writing content (use writing skills), or business strategy beyond content."
---

# Competitor Analyzer

Break down competitor content strategy to find winning patterns and content gaps.

## When to Use

- "Analyze what [competitor] is posting"
- "Why is this account doing so well?"
- "What content strategy is [competitor] using?"
- "Find content gaps between me and [competitor]"
- User provides competitor URLs or account names for analysis

## When NOT to Use

- General topic brainstorming without competitor context (use `topic-generator`)
- Writing content (use writing skills after analysis)
- Business/pricing/product competitive analysis (this is content-focused only)

## Analysis Workflow

### Step 1: Gather Content

If user provides a URL: use `web_fetch` to get the page content.
If user provides an account name: ask for specific URLs or the platform to guide analysis.

### Step 2: Analyze Patterns

For each piece of competitor content, identify:

| Dimension | What to look for |
|-----------|-----------------|
| Topic themes | What subjects do they cover repeatedly? |
| Content format | How-to, listicle, story, comparison, Q&A? |
| Title patterns | What hooks do they use? Numbers? Questions? |
| Posting cadence | How often do they publish? |
| Engagement signals | Which posts seem to perform best? (likes, comments, shares if visible) |
| Audience targeting | Who are they writing for? Beginners? Experts? |
| Unique angle | What perspective or voice makes them different? |

### Step 3: Find Gaps

Compare competitor content to user's niche:
- Topics competitor covers that user doesn't
- Topics competitor ignores (opportunity)
- Formats competitor uses that user could adopt
- Audience segments competitor doesn't serve well

## Output Format

```markdown
# Competitor Analysis: [Competitor Name/URL]

## Content Strategy Summary
- Primary topics: [list]
- Posting frequency: [estimate]
- Target audience: [description]
- Content format mix: [breakdown]

## Top-Performing Content Patterns
1. [Pattern]: [explanation + example]
2. [Pattern]: [explanation + example]

## Their Strengths
- [What they do well]

## Content Gaps (Your Opportunities)
- [Gap 1]: They don't cover [topic] — you could own this
- [Gap 2]: Their [content type] is weak — you could do better

## Actionable Recommendations
1. [Specific action the user can take]
2. [Specific action]
3. [Specific action]
```

## Notes

- This skill analyzes publicly visible content only — no private data
- Analysis quality depends on how much content is accessible via web_fetch
- For social media accounts (xiaohongshu, weibo), web_fetch may not capture all posts — work with what's available and be transparent about limitations
- Focus analysis on content strategy, not vanity metrics
