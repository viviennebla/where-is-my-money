# Round 2 Testing Guide

## Prerequisites

App running at `http://localhost:5173`, logged in.

---

## Item 1: Transfer Support

**Test:** Create a transfer between two accounts.
1. Go to 交易列表 (transaction list)
2. Click any transaction row's "编辑" button
3. Change type to "转账 (transfer)"
4. Verify a "目标账户 (转入)" dropdown appears
5. Select a different account as destination
6. Save — verify the transaction list shows "→ AccountName" after the transfer badge

---

## Item 2: Inline Edit vs Full Editor

**Test:** Clicking a cell edits inline; clicking "编辑" opens full editor.
1. In the transaction list, click on a merchant name cell value
2. Verify it turns into an inline text input (no modal)
3. Type something, press Enter — verify it saves and the cell updates
4. Press Escape while editing — verify it cancels without saving
5. Click the "编辑" button on any row — verify the full TransactionEditor modal opens

---

## Item 3: Account Name Column

**Test:** Transaction list shows which account each transaction belongs to.
1. Go to 交易列表
2. Verify there's a "账户" column header
3. Verify each row shows the account name (not just the account ID)

---

## Item 4: Account Detail — Newest First

**Test:** Account detail page shows newest transactions at top with correct running balances.
1. Go to 账户管理, click on any account card
2. Verify transactions are sorted newest first
3. Check the running balance (余额) column:
   - The last row (oldest) should have a balance close to the starting point
   - The first row (newest) should have a balance close to `current_balance`
   - Balances should change consistently with each transaction (expenses decrease, income increases)

---

## Item 5 & 6: Balance Adjustment

**Test:** Adjusting an account's balance creates a dated record.
1. Go to 账户管理
2. Click "调整余额" on any account
3. Enter a new target balance different from current
4. Set a date/time in the past (e.g., yesterday)
5. Add a note like "测试调整"
6. Click 确认
7. Verify the account's current_balance updated
8. Go to that account's detail page — verify a "余额调整" transaction appears with the correct date, amount (difference), and note
9. Verify running balances after that date reflect the adjustment

---

## Item 7: Bank Card Alias + Card Number

**Test:** Bank card accounts can store alias and card number.
1. Go to 账户管理, click "新建账户"
2. Select type "银行卡 (bank_card)"
3. Verify "别名" and "卡号" fields appear
4. Fill in alias (e.g., "工资卡") and card number (e.g., "6217 **** 1234")
5. Save
6. Verify the new card shows alias next to the name and card number below
7. Click "编辑" on an existing bank card — verify alias and card number fields are populated

---

## Item 8: Refund Marking

**Test:** Marking an expense as having a partial refund.
1. Go to 交易列表
2. Find an expense transaction, click "编辑"
3. Verify a "标记退款" section appears at the bottom
4. Enter a refund amount (less than the original) and a refund date
5. Click "创建退款记录"
6. Verify a new refund transaction appears in the list, linked to the original expense

---

## Item 9: AI Smart Refund Matching

**Test:** Imported refunds auto-match to original expenses.
1. Import a CSV/Excel file that contains both expenses and refunds for the same merchant
2. After import completes, check the response — `matched_refunds` should be > 0 if matches were found
3. Verify refund transactions in the list show a link to the parent expense
