# Validation record

Checked on 18 October 2026 with Node.js 24.21.0 and the in-app Chromium browser.

## Automated checks

`npm test`: **18 passed, 0 failed**.

- Exact decimal-to-minor-unit parsing and invalid input rejection.
- Equal-split conservation, deterministic remainders, and zero-sum member balances.
- Settlement suggestions clear calculated debts, including payers outside a split.
- Combined inclusive date, category, payer, and participant-name filtering.
- Monthly totals across year boundaries and empty months.
- Valid labeled sample data with no future-dated sample expenses.
- Backup shape, amount, date, ID, color, and reference validation.
- Local server MIME types, GET/HEAD handling, traversal protection, and rejection of writes/project-file access.

## Browser checks completed

- Created an expense for INR 100.01; reloaded and confirmed persistence.
- Edited its description and amount to INR 123.45; found the updated row with search.
- Exported the filtered CSV and inspected its single data row and headers.
- Deleted the test expense with confirmation.
- Added, renamed, and removed a custom test member.
- Confirmed that a member referenced by expenses cannot be removed.
- Changed INR to USD with the explicit no-conversion confirmation, checked unchanged numeric amounts, and restored INR.
- Exported a full JSON backup containing the 28 sample expenses.
- Started fresh, verified zero members/expenses, then restored that backup and checked totals after reload.
- Rejected a negative amount in the expense form.
- Combined Groceries, Arjun, and October date filters: one INR 2,480.00 expense.
- Inspected desktop at 1440 × 1000 and mobile at 390 × 844, including the mobile expense dialog.
- Verified that the mobile dashboard and expense view do not overflow the page horizontally; wide ledgers scroll within their panels.
- Browser console returned no warnings or errors during these checks.

## Scope and limits

These are targeted workflow and layout checks, not an exhaustive cross-browser/accessibility audit. Automated tests cover domain logic and the local server; browser checks were performed separately. Desktop/mobile preview images show the labeled sample household. No real household data is bundled.

The application stores its records in browser localStorage. There is no authentication, cloud database, or automatic multi-device sync. Settlement suggestions do not record repayments or send money. Currency changes relabel amounts without conversion.
