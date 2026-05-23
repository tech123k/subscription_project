# 📋 IndustrialERP — Complete Testing Guide
> Ye guide padh ke aap poora project test kar sakti hain — setup se leke end tak.
> Koi technical knowledge zaroorat nahi. Ek ek step follow karo.

---

## ⚙️ PART 0 — Setup (Pehli baar sirf)

### Step 0.1 — Database Migration Chalao (Supabase)
1. Browser mein Supabase Dashboard kholo → apna project select karo
2. Left sidebar mein **"SQL Editor"** click karo
3. **File 1:** `database/migrations/012_accounting_engine.sql` ka poora content copy karo → paste karo → **Run** dabao
4. **File 2:** `database/migrations/013_saas_subscription.sql` ka poora content copy karo → paste karo → **Run** dabao
5. Verify: Result mein `plans: 3`, `modules: 8`, `plan_modules: 14+` dikhna chahiye

### Step 0.2 — Backend Chalao
```
cd backend
npm run dev
```
✅ Dikhna chahiye: `Server running on port 5000`
❌ Agar `EADDRINUSE` error aaye: PowerShell mein run karo:
```powershell
$p = (Get-NetTCPConnection -LocalPort 5000).OwningProcess; Stop-Process -Id $p -Force
```
Phir dobara `npm run dev`

### Step 0.3 — Frontend Chalao
```
cd frontend
npm run dev
```
✅ Dikhna chahiye: `Local: http://localhost:3000`

### Step 0.4 — Browser mein kholo
`http://localhost:3000` — Login page aana chahiye

---

## 👑 PART 1 — Super Admin Testing

> Super Admin = Platform ka maalik. Sab companies dekh sakta hai, subscriptions manage kar sakta hai.

### ✅ Test 1.1 — Super Admin Login
1. `http://localhost:3000/login` kholo
2. Super Admin credentials daalo (jo register ke waqt banaye the, role = `super_admin`)
3. Login karo

**Expected:** Direct `/admin/dashboard` pe jaayega — **Admin Dashboard** page dikhega
**NOT expected:** Regular ERP dashboard

---

### ✅ Test 1.2 — Admin Dashboard Check
Admin Dashboard pe ye sab dikhna chahiye:
- 4 KPI cards: **MRR**, **ARR**, **Active Subs**, **Churned** (sab 0 honge abhi — normal hai)
- **Recent Companies** table (companies dikhti hain)
- **Quick Actions** buttons: Manage Subscriptions, Revenue Analytics, All Companies

---

### ✅ Test 1.3 — Subscription Activate Karna (Razorpay ke bina)
1. Left sidebar mein **"Subscriptions"** click karo
2. `/admin/subscriptions` page khulega — sabhi companies ki list dikhegi
3. Kisi company ke saamne **"Activate"** button (green) click karo
4. Modal khulega:
   - **Plan** select karo: Growth
   - **Billing Cycle**: Monthly
   - **Duration**: 30 days (ya 90d button click karo)
   - Preview section mein status/plan/expiry dikhega
5. **"Activate"** button dabao

**Expected:** Toast notification — "✓ Activated on growth for 30 days"
Company ka status **"active"** ho jaayega

---

### ✅ Test 1.4 — Subscription Extend Karna
1. Same `/admin/subscriptions` page pe
2. Kisi active company ke saamne **"Extend"** button (blue) click karo
3. 90 days select karo → **Extend** dabao

**Expected:** "Extended by 90 days" notification

---

### ✅ Test 1.5 — Revenue Page Check
1. Sidebar mein **"Revenue"** click karo → `/admin/revenue`
2. Dikhna chahiye:
   - MRR / ARR cards
   - Revenue by Plan chart (agar koi active sub hai)
   - Monthly Revenue bar chart
   - Recent Payments table

---

### ✅ Test 1.6 — All Companies Dekho
1. Sidebar mein **"Companies"** click karo → `/companies`
2. Registered companies ki list dikhegi

---

## 🏢 PART 2 — Company Admin Testing

> Company Admin = Ek company ka owner. Apni company ka ERP use karta hai.

### ✅ Test 2.1 — Company Admin Login
1. Browser mein `http://localhost:3000/login`
2. Company Admin credentials se login karo (role = `company_admin`)

**Expected:** `/dashboard` pe jaayega — regular ERP dashboard

---

### ✅ Test 2.2 — Billing Page Dekho
1. Sidebar mein **"Billing"** click karo → `/billing`
2. Dikhna chahiye:
   - Current subscription status (trial / active)
   - Trial mein kitne din bacha hai
   - Plan features list
   - "Change Plan" button
   - Payment history (empty abhi)

---

### ✅ Test 2.3 — Plan Selection Page
1. Billing page pe **"Change Plan"** click karo → `/billing/plans`
2. 3 plan cards dikhenge: **Starter**, **Growth**, **Enterprise**
3. Monthly/Yearly toggle test karo — price change honi chahiye
4. Ek plan select karo (highlight hoga)
5. **"Start X-day free trial instead"** button click karo

**Expected:** Trial start hoga, `/dashboard` pe redirect

---

## 📦 PART 3 — Inventory / Materials Testing

### ✅ Test 3.1 — Material Add Karna
1. Sidebar → **Materials** → `/materials`
2. **"+ Add Material"** button click karo
3. Fill karo:
   - Name: `Steel Rod`
   - Unit: `KG`
   - Category: `Raw Material`
   - HSN Code: `7214`
4. Save

**Expected:** List mein Steel Rod dikhega

---

### ✅ Test 3.2 — Purchase Order Banana
1. Sidebar → **Purchase Orders** → `/po`
2. **"+ New PO"** click karo
3. Supplier select karo, material add karo, quantity daalo
4. Save

**Expected:** PO number generate hoga (PO-2026-001)

---

### ✅ Test 3.3 — GRN (Goods Receipt Note)
1. Sidebar → **GRN / Inward** → `/grn`
2. **"+ New GRN"** click karo
3. PO select karo, received quantity daalo
4. Save

**Expected:** Stock update hoga, Inventory Ledger mein entry aayegi

---

### ✅ Test 3.4 — Inventory Ledger Check
1. Sidebar → **Ledger** → `/ledger`
2. Material filter lagao

**Expected:** GRN ki entry dikhegi (IN type, positive quantity)

---

## 🏭 PART 4 — Production Testing

### ✅ Test 4.1 — Product Create Karna
1. Sidebar → **Products** → `/production/products`
2. **"+ New Product"** click karo
3. Fill karo:
   - Name: `Ladies Sandal`
   - SKU Prefix: `LS`
   - Category: `Footwear`
4. Save

---

### ✅ Test 4.2 — BOM (Bill of Materials) Banana
1. Products list mein `Ladies Sandal` ke saamne **"BOM"** click karo
2. Materials add karo: `Sole — 1 piece`, `Upper — 0.5 meter`
3. Save

---

### ✅ Test 4.3 — Production Order Create Karna
1. Sidebar → **Production Orders** → `/production`
2. **"+ New Order"** click karo
3. Product select karo, quantity daalo
4. Save

**Expected:** Production order number milega (PRD-001)

---

## 💼 PART 5 — Sales Testing

### ✅ Test 5.1 — Customer Add Karna
1. Sidebar → **Customers** → `/customers`
2. **"+ Add Customer"** click karo
3. Name, phone, address daalo → Save

---

### ✅ Test 5.2 — Sales Order Banana
1. Sidebar → **Sales Orders** → `/sales-orders`
2. **"+ New Order"** click karo
3. Customer select karo, products add karo
4. Save

**Expected:** SO number milega (SO-2026-001)

---

### ✅ Test 5.3 — Dispatch Create Karna
1. Sidebar → **Dispatch** → `/dispatches`
2. **"+ New Dispatch"** click karo
3. Sales Order link karo, transporter details daalo
4. Save

---

### ✅ Test 5.4 — Invoice Banana
1. Sidebar → **Invoices** → `/invoices`
2. **"+ New Invoice"** click karo
3. Customer, items, GST select karo
4. Save

**Expected:** Invoice number milega (INV-2026-001)

---

## 📊 PART 6 — Accounting Testing

> Accounting module sirf Enterprise plan mein hai. Pehle activate karo (Part 1.3 se)

### ✅ Test 6.1 — Accounting Initialize Karna
1. Browser mein ye URL kholo:
   `http://localhost:5000/api/accounting/init`
   
   **Nahi kaam kar raha?** Postman use karo:
   - Method: `POST`
   - URL: `http://localhost:5000/api/accounting/init`
   - Headers: `Authorization: Bearer <your_token>`

**Expected:** "23 default accounts seeded"

---

### ✅ Test 6.2 — Chart of Accounts
1. Sidebar → **Chart of Accounts** → `/accounting/accounts`
2. Groups dikhne chahiye: Assets, Liabilities, Income, Expenses
3. **"+ New Account"** click karke ek ledger add karo:
   - Group: Current Assets
   - Name: `HDFC Bank Account`
   - Code: `1101`

---

### ✅ Test 6.3 — Voucher Entry
1. Sidebar → (Accounting ke andar koi bhi entry nahi dikhti sidebar pe)
   Direct URL: `/accounting/voucher/new`
2. Voucher type select karo: `Payment`
3. Two entries add karo:
   - Debit: `Bank Account` — ₹10,000
   - Credit: `Cash` — ₹10,000
4. Save

**Expected:** Dr = Cr (balanced) → save hoga

**Agar unbalanced:** Error aayega "Voucher is unbalanced: Dr ₹X ≠ Cr ₹Y"

---

### ✅ Test 6.4 — Day Book
1. URL: `/accounting/day-book`
2. Date filter lagao
3. Vouchers dikhenge

---

### ✅ Test 6.5 — Trial Balance
1. URL: `/accounting/trial-balance`
2. As on date select karo
3. Table dikhega — Dr total = Cr total honi chahiye

---

## 🔒 PART 7 — Module Access Control Testing

> Ye test karta hai ki locked modules properly block hote hain.

### ✅ Test 7.1 — Starter Plan pe Accounting Block
1. Kisi company ko **Starter** plan activate karo (Part 1.3)
2. Us company se login karo
3. `/accounting/accounts` pe jaao

**Expected:** "Upgrade Required" screen dikhega — lock icon ke saath

---

### ✅ Test 7.2 — Sidebar Lock Icons
1. Starter plan wali company se login karo
2. Sidebar mein Production, Sales, Accounting — ye sab grey/locked dikhne chahiye

---

## 👤 PART 8 — User Management Testing

### ✅ Test 8.1 — User Add Karna
1. Sidebar → **Users** → `/users` (Company Admin ya Super Admin hi dekh sakta)
2. **"+ Invite User"** click karo
3. Email, role (viewer/operator) daalo
4. Save

---

### ✅ Test 8.2 — Audit Logs
1. Sidebar → **Audit Logs** → `/audit`
2. Sabhi actions ki history dikhegi

---

## 🚨 PART 9 — Common Errors aur Fix

| Error | Kya karna hai |
|-------|--------------|
| `Cannot GET /api/...` | Backend chal raha hai? `npm run dev` backend folder mein |
| `401 Unauthorized` | Token expire ho gaya — logout karke dobara login karo |
| `403 MODULE_ACCESS_DENIED` | Is module ka plan nahi — Super Admin se activate karwao |
| `EADDRINUSE port 5000` | Port busy hai — PowerShell mein kill karo (Step 0.2 dekho) |
| Blank page on route | Frontend chal raha hai? `npm run dev` frontend folder mein |
| Table is empty | SQL migration nahi chalaya — Step 0.1 dobara karo |
| Accounting accounts empty | `/api/accounting/init` POST karo pehle |

---

## ✅ Quick Checklist — Sab Theek Hai Agar:

- [ ] `http://localhost:3000` → Login page dikhta hai
- [ ] Super Admin login → `/admin/dashboard` pe jaata hai
- [ ] Company Admin login → `/dashboard` pe jaata hai
- [ ] `/admin/subscriptions` → Companies list dikhti hai + Activate button kaam karta hai
- [ ] Material add karke GRN karo → Ledger mein entry dikhti hai
- [ ] Sales Order → Dispatch → Invoice flow kaam karta hai
- [ ] Accounting init karo → Voucher add karo → Day Book mein dikhta hai
- [ ] Starter plan company → Accounting page pe "Upgrade Required" dikhta hai
- [ ] `/admin/revenue` → MRR/ARR cards dikhte hain

---

## 📁 Important File Locations

| Cheez | Location |
|-------|----------|
| SQL Migration (Accounting) | `database/migrations/012_accounting_engine.sql` |
| SQL Migration (Subscription) | `database/migrations/013_saas_subscription.sql` |
| Backend start | `backend/` → `npm run dev` |
| Frontend start | `frontend/` → `npm run dev` |
| Backend port | 5000 |
| Frontend port | 3000 |
| Super Admin Dashboard | `/admin/dashboard` |
| Subscriptions (Admin) | `/admin/subscriptions` |
| Revenue (Admin) | `/admin/revenue` |
| Billing (Company) | `/billing` |

---

*Guide version: May 2026 | Project: IndustrialERP SaaS*
