---
name: xiaohongshu-writer
description: "Write xiaohongshu (RED/Little Red Book) style posts with hook titles, emoji-rich formatting, trending hashtags, and engagement-optimized structure. Use when: (1) user asks to write xiaohongshu content, RED notes, or social media posts for xiaohongshu, (2) user wants to create product reviews, lifestyle sharing, or tutorial posts in xiaohongshu style, (3) user says 'write a xiaohongshu post' or 'help me create RED content'. NOT for: WeChat articles, formal business writing, academic papers, or non-Chinese social platforms."
---

# Xiaohongshu Writer

Create high-engagement xiaohongshu (RED) posts optimized for the platform's algorithm and user behavior patterns.

## When to Use

Use this skill when the user asks any of:

- "write a xiaohongshu post about..."
- "help me create RED content"
- "generate a product review for xiaohongshu"
- "write a lifestyle/tutorial post in xiaohongshu style"
- any request mentioning xiaohongshu, RED, or Little Red Book content creation

## When NOT to Use

- WeChat Official Account articles (use `wechat-article` skill instead)
- Douyin/TikTok video scripts (different format and pacing)
- Formal business reports or proposals
- Academic or technical writing
- English-language social media content

## Writing Framework

### Title Formula (pick one per post)

1. **Number + Pain Point + Solution**: "5 skincare habits that actually work, #3 surprises everyone"
2. **Question + Suspense**: "Why does your makeup always look cakey? You're missing this one step"
3. **Before/After + Shock**: "From dull skin to glass skin in 2 weeks, here's my exact routine"
4. **Authority + Insider**: "As a dermatologist, these are the 3 products I actually use"
5. **Negative Hook + Reversal**: "Stop doing this skincare step wrong! The correct method saves you money"

Rules for titles:
- Must contain a hook within the first 10 characters
- Use numbers when possible (odd numbers perform better: 3, 5, 7)
- Include one emoji at the beginning or end of the title
- Keep under 20 Chinese characters (excluding emoji)

### Body Structure

```
Line 1-2: Hook (emotional resonance or surprising fact)
Line 3-4: Pain point acknowledgment (reader thinks "that's me!")
Line 5+: Solution content (organized in numbered or bulleted points)
  - Each point: emoji + concise statement + brief explanation
  - Keep each point to 2-3 lines max
Near end: Personal experience or data to build trust
Last 2 lines: Call to action (save/like/follow prompt)
```

### Formatting Rules

- Maximum 3 lines per paragraph (visual breathing room)
- Start each key point with a relevant emoji
- Use line breaks generously (dense text kills engagement)
- Bold or bracket key terms: [important concept] or *key phrase*
- Insert divider emojis between sections (like a row of the same emoji)

### Hashtag Strategy

- Include 5-10 hashtags at the end
- Format: #keyword (with # prefix, space-separated)
- Mix: 2-3 broad tags + 3-4 niche tags + 1-2 trending tags
- Place hashtags after the main content, separated by a blank line

### Tone Guidelines

- Conversational, like talking to a close friend
- Use exclamation marks and rhetorical questions naturally
- First person ("I tried this and...")
- Inclusive language ("sisters", "friends", colloquial Chinese)
- Confident but not preachy
- Show vulnerability when sharing personal experience

## Output Format

Always output in this structure:

```
[Title]
(hook title with emoji, under 20 Chinese characters)

[Body]
(following the structure above, 300-500 Chinese characters)

[Hashtags]
#tag1 #tag2 #tag3 #tag4 #tag5
```

## Example

**User input**: Write a xiaohongshu post about summer sunscreen tips

**Output**:

[Title]
summer sunscreen: these 3 mistakes mean you applied it for nothing! (with correct methods)

[Body]
Sisters!! Summer is here and it's sunscreen battle season again

I used to think slapping on sunscreen = protected
Until a dermatologist friend told me I was doing it ALL wrong...

Here are 3 common mistakes (I was guilty of all of them):

(point 1 with emoji) Not using enough product
Most people use about 1/3 of the recommended amount. The correct amount is a full coin-size for your face alone. Less than that and your SPF 50 becomes SPF 15.

(point 2 with emoji) Not reapplying
Sunscreen effectiveness drops significantly after 2 hours. If you're outdoors, set an alarm to reapply. This is the step most people skip.

(point 3 with emoji) Applying right before going out
Chemical sunscreens need 15-20 minutes to activate. Apply before getting dressed, not at the door. Physical sunscreens work immediately though.

I fixed these 3 habits last summer and the difference was dramatic. No more tanning even after beach trips.

Save this for reference! Like if it helped. Drop your sunscreen questions in the comments.

[Hashtags]
#sunscreen #summer skincare #sunscreen tips #skincare routine #UV protection #beauty tips #skincare sharing

## Notes

- Always write in Chinese unless the user explicitly requests another language
- Adapt emoji density to the topic (beauty/lifestyle = more emojis, finance/tech = fewer)
- If the user provides a product name, do NOT make false claims about efficacy
- When writing product reviews, include both pros and cons for authenticity
- Length sweet spot: 300-500 Chinese characters for the body (not counting title and hashtags)
