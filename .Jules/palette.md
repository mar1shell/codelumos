## 2024-05-24 - [Printer-Friendly Reports]
**Learning:** Dark mode-default apps often produce unreadable prints/PDFs because users forget to implement `@media print` overrides.
**Action:** Always include a simple `@media print { body { background: white; color: black; } }` block in self-contained HTML reports to ensure accessibility for offline reading.
