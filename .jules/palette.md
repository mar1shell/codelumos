## 2024-03-02 - ARIA Roles for Custom Progress Bars
**Learning:** Custom CSS progress indicators in this project (like `.bar-wrap`) were missing ARIA roles, making them invisible to screen readers.
**Action:** Always wrap visual progress bars with `role="progressbar"`, `aria-label`, `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` to ensure accessibility.

## 2026-03-03 - HTML Reporter semantic landmarks
**Learning:** Adding standard HTML semantic landmarks like `<main>` and `<header>` directly inside HTML reporters improves screen-reader accessibility and adheres to standard Web Content Accessibility Guidelines. It is critical for the generated report to have proper HTML structure.
**Action:** When working on reporting layers or views, always use semantic HTML tags (`<header>`, `<main>`, `<footer>`, etc.) instead of generic `<div>` wrappers to ensure native accessibility structure.

## 2025-03-09 - ARIA Table Column Headers
**Learning:** Table headers (`<th>`) in generated HTML reports need `scope="col"` to explicitly create unambiguous column-to-data cell bindings for visually impaired users.
**Action:** Always include `scope="col"` (or `scope="row"` when appropriate) on all table headers generated in reports to ensure proper screen reader support and better accessibility compliance.
