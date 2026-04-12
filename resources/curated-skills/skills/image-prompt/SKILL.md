---
name: image-prompt
description: "Generate detailed, optimized prompts for AI image generation tools (Midjourney, Stable Diffusion, DALL-E, Flux). Use when: (1) user wants to create an AI-generated image and needs a prompt, (2) user says 'generate an image prompt' or 'write a Midjourney prompt', (3) user describes a visual they want created with AI. NOT for: editing existing photos, generating images directly (this creates prompts, not images), or designing layouts (use poster-designer)."
---

# AI Image Prompt Generator

Create detailed, platform-optimized prompts for AI image generation tools.

## When to Use

- "Write a Midjourney prompt for [description]"
- "I need an AI image of [scene]"
- "Create a prompt for [visual concept]"
- "Help me generate [type of image] with AI"

## When NOT to Use

- Actually generating images (this skill writes prompts — the user runs them in their tool)
- Photo editing or manipulation
- Layout or poster design (use `poster-designer`)
- Icon or logo design

## Prompt Construction Framework

### Core Structure

```
[Subject] + [Style] + [Details] + [Lighting/Mood] + [Technical Parameters]
```

### Step 1: Define Subject

Be specific about:
- Main subject and their action/pose
- Setting/environment
- Composition (close-up, wide shot, overhead, etc.)

### Step 2: Add Style

| Style Category | Examples |
|---------------|---------|
| Photography | cinematic, editorial, street photography, macro |
| Illustration | watercolor, flat design, anime, oil painting, pencil sketch |
| 3D | isometric, clay render, low poly, realistic 3D |
| Abstract | geometric, minimalist, surreal, gradient |

### Step 3: Refine Details

- Colors: dominant color palette
- Textures: smooth, grainy, metallic, organic
- Atmosphere: foggy, sunny, neon, dreamy
- Camera angle: bird's eye, eye level, low angle, Dutch angle

### Step 4: Platform-Specific Parameters

**Midjourney:**
```
[prompt] --ar 16:9 --v 6.1 --style raw --s 250
```
- `--ar`: aspect ratio (1:1, 16:9, 9:16, 4:3)
- `--v`: version (6.1 latest)
- `--style raw`: less Midjourney aesthetic, more literal
- `--s`: stylize value (0-1000, higher = more artistic)
- `--q`: quality (0.25, 0.5, 1, 2)

**Stable Diffusion:**
```
[positive prompt]
Negative prompt: [what to avoid]
Steps: 30, CFG: 7, Sampler: DPM++ 2M Karras
```

**DALL-E:**
- Natural language description, no special parameters
- Be explicit about style since DALL-E defaults to photorealistic

## Output Format

```markdown
# Image Prompt: [Brief Description]

## Midjourney Prompt
[Complete prompt with parameters]

## Stable Diffusion Prompt
Positive: [prompt]
Negative: [negative prompt]
Settings: [recommended settings]

## DALL-E Prompt
[Natural language prompt]

## Prompt Explanation
- Subject: [what and why]
- Style: [chosen style and reasoning]
- Key details: [what makes this prompt effective]

## Variations
1. [Alternative version emphasizing different aspect]
2. [Alternative version with different style]
```

## Notes

- Default to providing Midjourney format unless user specifies a tool
- For Chinese users who describe in Chinese, write the prompt in English (AI image tools work best with English prompts)
- Avoid copyrighted characters, real person names, or brand logos in prompts
- When user describes something vague ("a beautiful scene"), ask clarifying questions before generating
- Include negative prompts for SD to avoid common artifacts (extra fingers, blurry, watermark)
