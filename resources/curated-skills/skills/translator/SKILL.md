---
name: translator
description: "Translate text between languages while preserving tone, context, and cultural nuances. Use when: (1) user asks to translate text to another language, (2) user provides foreign-language content and asks what it means, (3) user says 'translate this' or 'how do you say X in Y'. NOT for: rewriting in the same language (use content-rewriter), summarizing foreign content (translate first then summarize), or transcription of audio/video."
---

# Translator

Translate content between languages with attention to tone, cultural context, and natural expression.

## When to Use

- "Translate this to English/Chinese/Japanese/..."
- "What does this mean in Chinese?"
- "How do you say [phrase] in [language]?"
- User provides content in one language and asks for another

## When NOT to Use

- Same-language rewriting (use `content-rewriter`)
- Audio/video transcription
- Language learning exercises (just answer directly)

## Translation Framework

### Step 1: Identify Source and Target

- Detect source language (or ask if ambiguous)
- Confirm target language
- Identify content register: casual, formal, technical, literary

### Step 2: Translate

Priorities (in order):
1. **Accuracy**: Meaning must be correct
2. **Naturalness**: Read like it was originally written in the target language
3. **Tone preservation**: Casual stays casual, formal stays formal
4. **Cultural adaptation**: Idioms, references, humor adapted appropriately

### Translation Quality Rules

| Rule | Example |
|------|---------|
| No translationese | Not "he expressed that he was very happy" → "he said he was thrilled" |
| Preserve register | Formal Chinese → formal English, not casual |
| Adapt idioms | Not literal "pull up seedlings to help them grow" → "trying to rush things" |
| Keep proper nouns | Brand names, place names, person names stay as-is (add original in parentheses if needed) |
| Technical terms | Use standard target-language terminology, not word-for-word translation |

### Step 3: Handle Ambiguity

When a phrase has multiple possible translations:
- Provide the best fit in context
- Note alternatives in parentheses if the distinction matters
- If truly ambiguous, ask the user

## Output Format

```
[Translated text]

---
Translation notes:
- Source: [language] → Target: [language]
- Register: [casual/formal/technical]
- [Any adaptation choices worth noting, e.g., "Adapted [idiom] to equivalent expression"]
```

For short phrases, skip the notes section.

## Notes

- Default: Chinese ↔ English (most common for the target audience)
- For Chinese → English social media content, adapt cultural references rather than translating literally
- Preserve formatting (paragraphs, bullet points, emphasis) from the original
- If the source text has errors, translate the intended meaning and note the issue
- For technical documents, maintain consistent terminology throughout (don't translate the same term differently in different paragraphs)
