## 2024-03-02 - ARIA Roles for Custom Progress Bars
**Learning:** Custom CSS progress indicators in this project (like `.bar-wrap`) were missing ARIA roles, making them invisible to screen readers.
**Action:** Always wrap visual progress bars with `role="progressbar"`, `aria-label`, `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` to ensure accessibility.

## 2026-03-03 - HTML Reporter semantic landmarks
**Learning:** Adding standard HTML semantic landmarks like `<main>` and `<header>` directly inside HTML reporters improves screen-reader accessibility and adheres to standard Web Content Accessibility Guidelines. It is critical for the generated report to have proper HTML structure.
**Action:** When working on reporting layers or views, always use semantic HTML tags (`<header>`, `<main>`, `<footer>`, etc.) instead of generic `<div>` wrappers to ensure native accessibility structure.

## 2026-03-05 - Add scope attribute to data tables for improved screen reader access
**Learning:** Tables in generic HTML reports often omit explicit `scope="col"` attributes on `<th>` elements. While some modern screen readers can infer table structure, explicitly defining the scope binds header cells to data cells, preventing ambiguous announcements in complex breakdowns.
**Action:** Always add `scope="col"` to column headers (`<th>`) and `scope="row"` to row headers when generating HTML tables.
