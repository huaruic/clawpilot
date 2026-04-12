---
name: csv-processor
description: "Process, clean, transform, and merge CSV/Excel data. Use when: (1) user has CSV or tabular data that needs cleaning, filtering, or restructuring, (2) user asks to merge multiple data sources, (3) user says 'clean this CSV' or 'fix this spreadsheet data', (4) user wants to extract specific columns or filter rows. NOT for: data analysis and insights (use data-analyzer), creating charts, or database operations."
---

# CSV Processor

Clean, transform, filter, and restructure CSV/tabular data.

## When to Use

- "Clean up this CSV data"
- "Remove duplicate rows"
- "Merge these two tables"
- "Extract only the [column] where [condition]"
- "Convert this data format to [other format]"
- "Fix the messy data in this spreadsheet"

## When NOT to Use

- Analyzing data for insights (use `data-analyzer` — this skill transforms, that one interprets)
- Generating charts or visualizations
- Database SQL operations
- Data entry or data collection

## Processing Operations

### Cleaning
- Remove duplicate rows
- Handle missing values (remove row, fill with default, flag)
- Trim whitespace from all fields
- Normalize text (consistent capitalization, encoding)
- Fix date formats to consistent standard
- Remove empty rows/columns

### Filtering
- Keep/remove rows matching conditions
- Select specific columns
- Filter by date range, numeric range, or text pattern
- Deduplicate by specific key columns

### Transforming
- Rename columns
- Split one column into multiple (e.g., "full name" → "first" + "last")
- Combine columns (e.g., "city" + "country" → "location")
- Convert data types (text → number, date parsing)
- Add calculated columns (percentages, differences, rankings)

### Merging
- Combine rows from multiple sources (append/union)
- Join tables on a common key column (like VLOOKUP)
- Handle conflicts when merging (keep first, keep latest, flag)

## Output Format

Always output the processed data as a clean CSV or Markdown table, plus a processing summary:

```
[Processed data in requested format]

---
Processing summary:
- Input: N rows, M columns
- Output: N rows, M columns
- Operations applied: [list]
- Rows removed: N (reason: duplicates/empty/filtered)
- Issues found: [any data quality problems noted]
```

## Notes

- When cleaning, explain what was changed and why before modifying
- For large datasets (100+ rows), show a preview of the first 10 rows and ask user to confirm before processing all
- Preserve original column order unless user asks to reorder
- When merging, always report unmatched rows from both sides
- Default to UTF-8 encoding for output
