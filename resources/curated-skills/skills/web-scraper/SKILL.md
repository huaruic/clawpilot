---
name: web-scraper
description: "Extract structured data from web pages given a URL, using the built-in web_fetch tool. Organizes scraped content into tables, lists, or CSV. Use when: (1) user provides a URL and wants data extracted and organized, (2) user asks to scrape product listings, articles, or any structured content from a web page, (3) user says 'scrape this page' or 'extract data from this URL'. NOT for: pages requiring login, JavaScript-heavy single-page apps (React/Vue SPAs), real-time monitoring, or bulk scraping across hundreds of pages. Requires: web_fetch tool (built-in, no setup needed). For search-based research without a specific URL, use search-researcher skill instead."
---

# Web Scraper

Extract and organize structured data from web pages. Works with the built-in `web_fetch` tool — no additional setup required.

## When to Use

Use this skill when the user:

- Provides a URL and asks to extract data from it
- Wants product listings, prices, or reviews organized into a table
- Asks to "scrape this page" or "grab data from this link"
- Needs article content extracted and structured
- Wants to compare items listed on a web page

## When NOT to Use

- No URL provided and user wants to search the web (use `search-researcher` skill)
- Login-required pages (agent cannot authenticate)
- JavaScript-rendered single-page apps (web_fetch does not execute JS — inform the user)
- Bulk scraping across many pages (rate limits and ethical concerns)
- Downloading images, videos, or binary files

## Capabilities and Limitations

**What works (built-in web_fetch):**
- Static HTML pages (news, blogs, e-commerce listings, wikis, documentation)
- Pages with server-rendered content
- Content behind simple redirects (up to 3 hops)
- Cached results for 15 minutes (repeated fetches are fast)

**What does NOT work without additional setup:**
- JavaScript-rendered content (React, Vue, Angular SPAs) — returns empty or partial content
- CAPTCHAs or anti-bot-protected pages
- Login-gated content
- Search queries (requires search API key — guide user to Settings > Search Provider)

When web_fetch returns incomplete content, inform the user clearly and suggest alternatives.

## Scraping Workflow

### Step 1: Validate the URL

Before fetching:
- Confirm the URL is provided and looks valid
- If the user describes what they want but gives no URL, ask for it

### Step 2: Fetch the Page

Use `web_fetch` to retrieve the page content. The tool returns markdown-formatted text extracted from the HTML.

### Step 3: Identify Data Structure

Analyze the fetched content to find:
- Repeating patterns (product cards, list items, table rows)
- Key fields per item (title, price, rating, date, author, link)
- Any summary data (total count, page number)

### Step 4: Organize Output

Format the extracted data based on user needs:

- **Default**: Markdown table with numbered rows
- **If user asks for CSV**: Comma-separated format
- **If user asks for summary**: Key statistics only

Always include at the end:
- Source URL
- Extraction timestamp
- Item count
- Any fields that were incomplete or missing

## Output Format

**Markdown table (default):**

```markdown
| # | Field A | Field B | Field C |
|---|---------|---------|---------|
| 1 | Value   | Value   | Value   |
| 2 | Value   | Value   | Value   |

**Summary**: N items extracted from [URL]. Scraped at YYYY-MM-DD HH:MM.
```

**CSV (when requested):**

```csv
field_a,field_b,field_c
"Value","Value","Value"
```

## Pagination

If the page has pagination links:

1. Extract data from the current page first
2. Ask the user: "This page has [N] more pages. How many should I scrape?"
3. Default to current page only if user doesn't specify
4. For each additional page, fetch and append results

## Error Handling

| Situation | Response |
|-----------|----------|
| web_fetch returns empty or minimal content | "This page may use JavaScript rendering. web_fetch can only extract static HTML content. The page might work better if opened in a browser tool." |
| URL returns 403 or 404 | "The page returned [status]. Please check the URL or try again later." |
| Content doesn't have clear structure | "I found the page content but couldn't identify a repeating data structure. Here's the raw content — would you like me to extract specific fields?" |
| URL not provided | "Please provide the URL of the page you'd like me to scrape." |

## Example

**User**: Scrape the product list from https://example.com/deals

**Agent response**:

| # | Product | Price | Discount | Rating |
|---|---------|-------|----------|--------|
| 1 | Wireless Earbuds | $29.99 | 40% off | 4.5/5 |
| 2 | Phone Stand | $12.99 | 25% off | 4.2/5 |
| 3 | USB-C Cable 3-pack | $9.99 | 30% off | 4.7/5 |

**Summary**: 3 items extracted from https://example.com/deals. Scraped at 2026-04-10 15:30. All fields complete.

## Notes

- web_fetch is built into ClawPilot — no API keys or extra setup needed
- Results are cached for 15 minutes; repeated fetches of the same URL are instant
- For search-based research (no specific URL), guide the user to configure a search provider in Settings, or use the `search-researcher` skill
- Always respect rate limits: if scraping multiple pages, wait between requests
- Clean extracted data: trim whitespace, normalize numbers, remove HTML artifacts
