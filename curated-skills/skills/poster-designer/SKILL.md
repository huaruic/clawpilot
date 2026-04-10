---
name: poster-designer
description: "Generate poster and visual design specifications including copy, layout guidelines, color schemes, and typography recommendations. Use when: (1) user needs poster copy and design direction, (2) user asks for banner, cover image, or social media visual guidelines, (3) user says 'design a poster' or 'create visual content for'. NOT for: generating actual images (recommend AI image tools), coding HTML/CSS layouts, or print production specifications."
---

# Poster Designer

Create poster copy and detailed visual design specifications for social media, marketing, and event materials.

## When to Use

- "Help me design a poster for [event/product]"
- "Write copy for a promotional banner"
- "What should my social media cover image look like?"
- "Create a visual concept for [campaign]"

## When NOT to Use

- Generating actual images (this skill produces design specs + copy, not images)
- Coding web layouts in HTML/CSS
- Print-ready production files (this is concept + direction)
- Logo design (different design discipline)

## Design Specification Framework

### Step 1: Understand the Brief

Clarify:
- **Purpose**: Promotion? Event? Brand awareness? Information?
- **Platform**: Xiaohongshu cover (1:1), WeChat banner (2.35:1), general poster (2:3)?
- **Audience**: Age, interests, aesthetic preference
- **Key message**: What's the ONE thing viewers should remember?

### Step 2: Generate Copy

**Headline**: 3-7 words, largest text, the hook
**Subheadline**: 1 sentence supporting the headline
**Body text**: 2-3 bullet points or short sentences (optional)
**CTA**: What should the viewer do? (scan QR, click link, visit store)

### Step 3: Layout Recommendation

Provide a text-based layout description:

```
┌─────────────────────────┐
│      [Logo/Brand]       │  ← top: brand identity
│                         │
│    [HEADLINE large]     │  ← center: primary message
│    [subheadline]        │
│                         │
│  [visual element area]  │  ← supporting imagery
│                         │
│   [CTA button/text]     │  ← bottom: action
│   [date/location/QR]    │
└─────────────────────────┘
```

### Step 4: Visual Direction

| Element | Specification |
|---------|--------------|
| Color palette | Primary + secondary + accent (provide hex codes) |
| Typography | Headline font style + body font style |
| Mood | Energetic / Calm / Professional / Playful / Elegant |
| Visual elements | Photography style / illustration style / abstract |

## Output Format

```markdown
# Poster Design: [Title]

## Copy
- **Headline**: [text]
- **Subheadline**: [text]
- **Body**: [text if needed]
- **CTA**: [text]

## Layout
[Text-based wireframe]

## Visual Direction
- **Colors**: [primary hex], [secondary hex], [accent hex]
- **Typography**: [headline style], [body style]
- **Mood**: [description]
- **Image style**: [description]

## Platform Specs
- Dimensions: [WxH pixels]
- Safe zone: [margins for text]
- File format: [PNG/JPG recommendation]

## AI Image Prompt (optional)
If using AI image tools, here's a prompt for the background/visual element:
"[detailed prompt for Midjourney/SD/DALL-E]"
```

## Notes

- Always provide hex color codes, not just color names
- Include platform-specific dimensions (xiaohongshu: 1080x1080, WeChat banner: 900x383)
- When suggesting colors, consider accessibility (contrast ratio for text readability)
- If the user wants an actual image generated, suggest using the `image-prompt` skill for detailed AI image prompts
