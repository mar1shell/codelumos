## 2024-03-02 - ARIA Roles for Custom Progress Bars
**Learning:** Custom CSS progress indicators in this project (like `.bar-wrap`) were missing ARIA roles, making them invisible to screen readers.
**Action:** Always wrap visual progress bars with `role="progressbar"`, `aria-label`, `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` to ensure accessibility.
