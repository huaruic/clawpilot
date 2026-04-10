---
name: topic-generator
description: "Generate content topic ideas based on audience, niche, trends, and content gaps. Use when: (1) user asks for content ideas or topic suggestions, (2) user needs a content calendar or topic plan, (3) user says 'what should I write about' or 'give me topic ideas', (4) user wants to brainstorm content angles. NOT for: writing the actual content (use writing skills), keyword research for SEO, or academic topic selection."
---

# Topic Generator

Generate targeted content topic ideas with angles, hooks, and audience fit analysis.

## When to Use

- "What should I write about this week?"
- "Give me 10 topic ideas for [niche]"
- "Help me plan content for next month"
- "What's trending in [field] that I should cover?"
- "I'm running out of content ideas"

## When NOT to Use

- Writing the actual content (use `xiaohongshu-writer`, `wechat-article`, etc.)
- SEO keyword research (this generates topics, not keyword lists)
- Academic research topic selection

## Topic Generation Framework

### Step 1: Understand Context

Ask or infer:
- **Niche/field**: What does the user create content about?
- **Platform**: Xiaohongshu, WeChat, Douyin, general blog?
- **Audience**: Who reads their content?
- **Past content**: What have they covered recently? (avoid repetition)

### Step 2: Generate from Multiple Angles

For each topic, generate ideas from these 6 angles:

| Angle | Pattern | Example (skincare niche) |
|-------|---------|------------------------|
| Pain point | "[Audience] struggles with [problem]" | "Why your moisturizer isn't working in winter" |
| How-to | "How to [achieve result] in [timeframe]" | "How to build a 3-step morning routine in 5 minutes" |
| Myth-busting | "[Common belief] is actually wrong" | "5 skincare myths your dermatologist wishes you'd stop believing" |
| Comparison | "[A] vs [B]: which is better for [use case]" | "Retinol vs vitamin C: which anti-aging ingredient to start with" |
| Personal story | "I tried [X] for [time] and here's what happened" | "I switched to oil cleansing for 30 days — honest review" |
| Trend | "[Emerging trend] explained + should you try it" | "Skin cycling is everywhere — here's if it actually works" |

### Step 3: Evaluate and Rank

For each topic, provide:
- **Engagement potential**: High / Medium / Low
- **Difficulty**: Easy (opinion/experience) / Medium (research needed) / Hard (expert knowledge)
- **Best platform**: Which platform fits this topic best

## Output Format

```markdown
# Topic Ideas: [Niche] — [Month/Week]

## High Priority (publish first)

1. **[Topic title]**
   Angle: [angle type] | Platform: [best fit] | Difficulty: [level]
   Hook: [one-line hook to grab attention]

2. **[Topic title]**
   ...

## Good Ideas (backlog)

3. **[Topic title]**
   ...

## Content Calendar Suggestion
- Week 1: [Topic] (easy, build momentum)
- Week 2: [Topic] (medium, deeper value)
- Week 3: [Topic] (trend-based, timely)
- Week 4: [Topic] (personal story, build connection)
```

## Notes

- Default to 10 topic ideas unless user specifies a number
- Mix angles — don't give 10 how-to topics, variety keeps the audience engaged
- If user hasn't specified a niche, ask before generating
- For trend-based topics, note that trends have a shelf life — publish quickly
