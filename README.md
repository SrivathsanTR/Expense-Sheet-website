# Together Expenses

A responsive household and group expense tracker with clear totals, spending charts, custom members, and equal expense splits. It runs locally using Node.js and stores your expenses in your browser.

## Run in VS Code

You need **Node.js 22 or newer** and a modern browser such as Chrome, Edge, Firefox, or Safari. [Download Node.js from the official website](https://nodejs.org/en/download); Node.js includes npm.

1. Extract the project ZIP into a folder you can keep, for example `Documents/together-expenses`.
2. Open VS Code, choose **File → Open Folder**, and select the folder containing `package.json`, `server.js`, and `index.html`.
3. Choose **Terminal → New Terminal**.
4. Check Node.js is available:

   ```text
   node --version
   ```

   The displayed version must be 22 or newer. If the command is not recognized, install Node.js, then close and reopen VS Code.

5. Start the website:

   ```text
   npm start
   ```

6. Open **http://127.0.0.1:3000** in your browser. Leave the terminal running while you use the app. Press **Ctrl+C** in the terminal to stop the server.

There are no external packages to install, so **`npm install` is not required**. You can also start the server directly with `node server.js`. In VS Code, the included **Start Together Expenses** debug configuration runs the same server.

Always return to the same address and browser profile to see your saved data. Use the server address; double-clicking `index.html` does not reliably support the app's JavaScript modules.

### Windows troubleshooting

- If PowerShell blocks `npm.ps1`, run `npm.cmd start`, or simply `node server.js`. No execution-policy change is needed.
- If port 3000 is occupied, stop the other server or use a different port. In PowerShell:

  ```powershell
  $env:PORT = '3001'
  node server.js
  ```

  Open `http://127.0.0.1:3001`. A different port is a different browser-storage origin, so your existing expenses will not automatically appear there. Export a backup from the original address and import it at the new address if needed.

- If the browser cannot connect, confirm the terminal is still running and use the exact address printed there.

## Use the tracker

**Try the labeled demo.** First launch loads clearly marked sample household data so you can explore the dashboard. These are fictional expenses and people. Choose **Start fresh** to replace them with your own group after confirmation.

**Set up your group.** Use **Members → Add member** for your own people, and **Settings → Household details** for the household name and currency. INR is the default currency; USD, EUR, GBP, and AED are also available. Changing currency changes how existing amounts are displayed—it does **not** convert amounts or fetch exchange rates. Keep a group in one currency. You can rename members and change their avatar colors. To remove someone with expense history, first reassign or delete the expenses they paid or shared.

**Add expenses.** Enter a description, amount, category, date, the person who paid, and the members sharing the expense. An expense is split equally between its selected members. The payer can pay for other members without being included in the split. Edit or delete an expense when needed.

**Explore spending.** In **Expenses**, search descriptions or member names, filter by category or **Paid by**, set an inclusive **From / To** date range, and sort by date or amount. Name searches also match members sharing an expense; **Paid by** matches only its payer. The result count and total cover all matching rows, with ten expenses displayed per page. **Reset filters** returns to the full ledger. These ledger filters are separate from the Overview period selector.

On **Overview**, the period defaults to **All time**. Choose **This month** or **Last month** to change **Total spent**, **Average expense**, **Where it goes**, and **Recent expenses**. The **This month** card always shows the current calendar month. **Spending over time** always shows the last six calendar months, including the current one, across all expenses. **Who's paid what**, member balances, and settlement suggestions always use all recorded expenses.

**Understand each person's share.** The **Members** page shows **Total paid**, **Their share**, and the resulting balance for every member. Suggested transfers describe how to balance the expense records. The app does not record repayments, send money, or connect to a bank; an actual payment made elsewhere will not reduce these balances automatically.

**Keep a backup.** Use **Settings → Export JSON backup** for a full backup of your group, members, and expenses. **Restore from backup** validates the JSON and replaces the current data after confirmation. **Expenses → Export CSV** provides every matching expense in the current filtered and sorted result, including rows on other pages. CSV is a report, not the app's restore format. Save backups somewhere separate from the browser before clearing site data or changing computers.

## Persistence and sharing limits

- Data is stored in **localStorage for the current website origin and browser profile**. Reloading the page or restarting the local server keeps that browser's saved data.
- `127.0.0.1`, `localhost`, different port numbers, different browsers, and different browser profiles have separate storage. Consistently use the address printed by the server.
- Private/incognito browsing may remove data when that session ends. Clearing browsing/site data can delete expenses. JSON exports are your portable backups.
- “Shared” means expenses can be assigned and split among members of one group in this local dataset. There are **no accounts, cloud database, or automatic multi-device synchronization**.
- To move data to another device or browser, export and import a JSON backup manually. Imports replace a dataset; they do not merge independently edited copies.
- Open tabs at the same address refresh when saved data changes. A change from another tab closes any open form so an outdated edit cannot silently overwrite the refreshed data.
- The server binds only to `127.0.0.1`. It serves the website's static files and does not receive, store, or share your expense records.
- Anyone who can use your browser profile can open the saved group. The app has no password protection or encrypted storage. Browser extensions and your device's normal access controls still apply.

## How balances work

Each expense is divided equally among its selected members. Amounts are represented as whole minor units (paise for INR, cents for USD/EUR) to avoid floating-point rounding errors. If an amount cannot divide exactly, the first members in the expense's stored selection order receive one extra minor unit until the remainder is allocated. For a new expense, this follows the selected members' displayed order. The shares always add up to the original expense.

For each member:

```text
balance = total paid - total allocated share
```

A positive balance means the member is owed money; a negative balance means the member owes money. Settlement suggestions match debtors with creditors using all recorded expenses. There is no separate repayment ledger; these balances are based on expenses only.

## Project structure

```text
together-expenses/
├── index.html          Accessible page shell
├── src/
│   ├── app.js          Browser interface, forms, charts, and persistence
│   ├── model.js        Expense validation, money, splits, and calculations
│   └── styles.css      Responsive layout, theme, and component styles
├── server.js           Local static server using Node.js built-ins
├── test/               Automated tests
├── .vscode/
│   └── launch.json     Optional VS Code start configuration
├── package.json        Run and test commands; no external dependencies
└── README.md           This guide
```

The browser app uses plain HTML, CSS, and JavaScript ES modules. There is no build step. The server serves only `index.html` and recognized assets under `src/`; project documentation and test files are not served.

## Run checks

From the project folder:

```text
npm test
```

The suite uses Node.js's built-in test runner. The static-server checks use a temporary fixture and an automatically assigned local port. To test the actual browser experience, start the app and check adding/editing/deleting expenses, member selection, filters, currency display, backup export/import, and persistence after reload. Browser and visual checks are separate from automated unit tests.

## Customize

Edit the visual theme in `src/styles.css`, page structure and interaction in `index.html` and `src/app.js`, and calculation rules in `src/model.js`. Refresh the browser after saving changes; the development server sends no-cache responses. Back up your data before modifying the storage schema or calculation rules.
