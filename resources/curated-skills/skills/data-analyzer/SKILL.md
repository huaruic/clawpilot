---
name: data-analyzer
description: "Analyze data provided by the user (numbers, tables, CSV content, statistics) and produce insights, trends, and visualization recommendations. Use when: (1) user shares data and asks to analyze it, (2) user wants to find patterns or trends in numbers, (3) user asks 'what does this data tell me' or 'analyze these numbers', (4) user provides a table or spreadsheet content for interpretation. NOT for: web scraping (use web-scraper), creating charts (recommend tools), or database queries."
---

# Data Analyzer

Analyze user-provided data to extract insights, identify trends, and recommend actions.

## When to Use

- User pastes a data table and asks "what does this tell me?"
- "Analyze these sales numbers"
- "Find trends in this data"
- "Compare these metrics across months"
- User shares CSV content or structured data

## When NOT to Use

- Fetching data from URLs (use `web-scraper` first, then analyze)
- Creating actual chart images (recommend charting tools instead)
- SQL queries or database operations
- Data that requires domain-specific expertise (medical, legal, financial advice)

## Analysis Framework

### Step 1: Understand the Data

- Identify columns/fields and their types (numeric, categorical, date, text)
- Count rows and check for missing values
- Determine the time range if dates are present

### Step 2: Basic Statistics

For numeric fields, calculate:
- Count, min, max, average, median
- Top/bottom performers
- Distribution shape (clustered? spread out? outliers?)

For categorical fields:
- Unique values and their frequency
- Most/least common categories

### Step 3: Find Patterns

- **Trends**: Is the metric going up, down, or flat over time?
- **Correlations**: Do two metrics move together?
- **Outliers**: Are there unusual data points? What might explain them?
- **Segments**: Do different groups show different patterns?

### Step 4: Deliver Insights

Structure findings as actionable insights, not just numbers.

Bad: "Average revenue is 50,000"
Good: "Revenue averaged 50,000/month but shows a clear upward trend — the last 3 months are 20% above the first 3 months, suggesting growth is accelerating"

## Output Format

```markdown
# Data Analysis: [Dataset Description]

## Data Overview
- Rows: N | Columns: N
- Time range: [if applicable]
- Data quality: [any missing values or issues noted]

## Key Findings

### 1. [Most Important Finding]
[Explanation with specific numbers]

### 2. [Second Finding]
[Explanation]

### 3. [Third Finding]
[Explanation]

## Detailed Breakdown
[Tables comparing segments, time periods, or categories]

## Visualization Recommendations
- [Metric X] over time → line chart
- [Category distribution] → bar chart
- [Comparison A vs B] → grouped bar chart

## Suggested Next Steps
1. [Action based on findings]
2. [Action]
```

## Notes

- Always show your math — don't just state conclusions without the numbers behind them
- When data is ambiguous, present multiple interpretations rather than guessing
- If the dataset is too small for reliable conclusions, say so
- Round numbers appropriately for readability (not 49,872.3456 — say ~50,000)
- For percentage changes, always state the base: "up 20% from X to Y"
