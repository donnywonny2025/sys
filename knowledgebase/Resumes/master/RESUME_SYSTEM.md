# Resume Generation System - Technical Reference

> **This document is the permanent reference for how the branded resume PDF system works.**
> Any agent modifying resume generators MUST read this first.

## Why This Document Exists

In March 2026, a series of resume edits broke the PDF layout repeatedly. The root cause was agents rewriting the proven coordinate system with custom alternatives (LayoutManager classes, VerticalTracker objects, etc.) that used different font sizes, spacing values, and positioning logic. This caused:

- Footer text clipped or overlapping with Education section
- Content disappearing off the bottom of the page
- Font sizes silently changed (9.0 instead of 9.5, 10.0 instead of 10.5)
- Leading values silently changed (10.5/11.0 instead of 14.0/13.0)
- Job titles, bullet points, and entire roles getting truncated or dropped

**The fix was to stop rewriting the system and clone the proven generator verbatim.**

---

## The North Star: `gen_resume_general.py`

**Location**: `/Volumes/WORK 2TB/SAVE/AGENTMONEY/KNOWLEDGE_BASE/Resumes/gen_resume_general.py`

This file produces the correct, user-approved layout. Every new resume variant is created by copying this file and only changing text content. **Never modify the coordinate functions, spacing constants, or layout logic.**

---

## How the Coordinate System Works

ReportLab uses a **bottom-left origin** (0,0 is bottom-left corner). The page is 612 x 792 points (US Letter).

### Key Functions

```python
def ytop_to_baseline(y_top, font_size):
    return PAGE_H - y_top - (font_size * 1.074)
```

Converts a "top-down" coordinate (like you'd measure in a design tool from the top of the page) into a ReportLab baseline coordinate. The `1.074` factor accounts for the font ascender height.

**Used for**: All header elements (name, subtitle, contact lines, section headers) which have fixed, absolute positions measured from the top of the page.

```python
def fitz_ascender(font_size):
    return font_size * 1.074
```

Returns the ascender height for a given font size. Used to calculate spacing between elements of different font sizes so their baselines align properly.

```python
def draw_wrapped_at(c, text, x, y_baseline, font, size, color, max_width, leading, is_bullet=False):
    # ... word wraps text and draws it line by line
    return y  # Returns the Y position AFTER the last line
```

**Critical**: This function **returns the Y coordinate after drawing**. All body content chains off this return value. This is how sections flow naturally without overlap.

### The Layout Flow

1. **Header elements** use absolute `ytop_to_baseline()` positions (fixed, never change)
2. **Summary** starts at a fixed position, wraps text, returns its ending Y
3. **Skills section** positions itself relative to Summary's ending Y
4. **Experience section** positions itself relative to Skills' ending Y
5. **Each job** chains off the previous job's ending Y via `draw_wrapped_at()` return values
6. **Education** chains off the last job's ending Y
7. **Footer** is positioned at `edu_y - 20.0` (20 points below education)

### Spacing Constants (DO NOT CHANGE)

| Constant | Value | Purpose |
|----------|-------|---------|
| `BODY_LEADING` | 14.0 | Line spacing for body text and bullets |
| `SKILL_LEADING` | 13.0 | Line spacing within skill entries |
| `SKILL_BETWEEN` | 16.0 | Spacing between skill categories |
| `LEFT` | 60.0 | Left margin |
| `RIGHT` | 552.0 | Right margin |
| `BULLET_X` | 72.0 | Bullet point indent |
| `CONTENT_W` | 492.0 | Content width (RIGHT - LEFT) |

### Header Positions (Absolute, DO NOT CHANGE)

| Element | ytop value | Font Size |
|---------|-----------|-----------|
| Name | 30.9 | 22 (Helvetica-Bold) |
| Subtitle | 59.6 | 10 (Helvetica) |
| Contact Line 1 | 81.2 | 8.5 (Helvetica) |
| Contact Line 2 | 93.2 | 8.5 (Helvetica-Bold + Helvetica) |
| Orange Line | 115.3 (PAGE_H - 115.3) | 1.5pt stroke |
| Summary Header | 124.5 | 11 (Helvetica-Bold) |
| Summary Body | 141.6 | 9.5 (Helvetica) |

### Job Entry Spacing Pattern

Each job follows this exact pattern:
```python
# Title: 5.3pt below previous content
j_title_y = by - 5.3

# Company: 16.711pt below title (adjusted for font size difference)
j_company_y = j_title_y - 16.711

# First bullet: 14.363pt below company
by = j_company_y - 14.363

# Each bullet wraps and chains via draw_wrapped_at() return value
for b in bullets:
    by = draw_wrapped_at(c, f"bullet {b}", ...)
```

### Section Divider Pattern

```python
# Gray line: positioned relative to previous content
gd_y = previous_y + BODY_LEADING - 10.2  # or + SKILL_BETWEEN - 5.0 after skills

# Section header: 9.2pt + ascender below gray line
header_y = gd_y - 9.2 - fitz_ascender(11)
```

---

## Content Source

All resume text comes from the master markdown file:
`/Volumes/WORK 2TB/SAVE/AGENTMONEY/KNOWLEDGE_BASE/Resumes/Jeff_Kerr_Resume.md`

### Content Rules
- **No em-dashes** - use standard hyphens only
- **No education dates** in some variants (check jeff-rules)
- **Footer text** is always: "Operating modes: on-site, hybrid, or remote | Availability: staff roles or long-term engagements"

---

## Monogram Asset

**Path**: `/Volumes/WORK 2TB/SAVE/AGENTMONEY/_archive/monogram_iterations/JKMONO.png`

Positioned at: `(54.0, PAGE_H - 73.2)`, size `70.9 x 39.6`, with `mask='auto'` for transparency.

---

## Creating a New Resume Variant

1. **Copy** `gen_resume_general.py` to `gen_resume_[name].py`
2. **Change ONLY**:
   - The `OUTPUT` path variable
   - Text content (summary, skills, bullets) to target the role
3. **DO NOT change**: any function, any spacing constant, any coordinate value
4. **Run**: `python3 gen_resume_[name].py`
5. **Verify**: Open the PDF and check all sections are visible, footer is not clipped

## The Modern HTML/CSS System (Playwright)

**Location**: `/Volumes/WORK 2TB/SAVE/AGENTMONEY/KNOWLEDGE_BASE/Resumes/master/resume_template.html`

This system uses a JavaScript-driven **Physical Bounding Box** scaling engine to achieve high-end visual design (Vercel/NextJS style) while maintaining absolute 1-page compliance.

### The Scaling Engine (CRITICAL)

To ensure the resume never bleeds into a second page, the template uses a recursive measurement script:

1.  **Target Height**: Hard-locked at **960px** (approx 10.0 inches). This provides a mandatory 0.5-inch safety buffer at the bottom of the US Letter sheet.
2.  **Measurement Logic**: It iterates through `scaler.getElementsByTagName('*')` and uses `getBoundingClientRect().bottom` to find the **true physical bottom** of the document, bypassing unreliable `scrollHeight` values in CSS Grid.
3.  **Scale Factor**: If the actual height exceeds 960px, it applies a `transform: scale()` property with a 3% additional safety margin.

**Rule**: Any agent modifying the HTML structure MUST ensure the `#scaler` wrapper is preserved and the scaling script is included in the `<head>` or at the bottom of `<body>`.

---

## Verification Checklist
- [ ] **Page Height**: Browser metadata MUST show 1008px (10.5in) or less.
- [ ] **Scale Factor**: Verify logs in console (e.g., `Target: 960px | Actual: 1007px | Scaling to: 0.92`).
- [ ] **Visual Audit**: Ensure the bottom-most bullet point has a visible white gap before the page edge.

## Creating a Cover Letter + Resume Application

1. **Copy** `gen_application_ethos.py` as your template
2. The resume page (page 2) uses the exact same layout as `gen_resume_general.py`
3. The cover letter page (page 1) uses the same branded header + `draw_wrapped_at()` for paragraphs
4. **Change ONLY**: cover letter text, resume content, and output path
