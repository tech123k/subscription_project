const { query, transaction } = require('../config/database');

// ── helpers ──────────────────────────────────────────────────────────────────

const nextVoucherNumber = async (client, companyId, type) => {
  const prefixMap = {
    payment: 'PAY', receipt: 'RCP', journal: 'JRN', contra: 'CON',
    sales: 'SLS', purchase: 'PUR', debit_note: 'DN', credit_note: 'CN',
  };
  const prefix = prefixMap[type] || type.toUpperCase().slice(0, 3);

  await client.query(
    `INSERT INTO voucher_sequences (company_id, voucher_type, prefix, last_number)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (company_id, voucher_type)
     DO UPDATE SET last_number = voucher_sequences.last_number + 1`,
    [companyId, type, prefix]
  );
  const { rows } = await client.query(
    `SELECT last_number, prefix FROM voucher_sequences WHERE company_id=$1 AND voucher_type=$2`,
    [companyId, type]
  );
  return `${rows[0].prefix}-${String(rows[0].last_number).padStart(4, '0')}`;
};

const DEFAULT_GROUPS = [
  // Assets – debit nature
  { name: 'Assets',             nature: 'debit',  seq: 1,  parent: null },
  { name: 'Current Assets',     nature: 'debit',  seq: 2,  parent: 'Assets' },
  { name: 'Fixed Assets',       nature: 'debit',  seq: 3,  parent: 'Assets' },
  // Liabilities – credit nature
  { name: 'Liabilities',        nature: 'credit', seq: 4,  parent: null },
  { name: 'Current Liabilities',nature: 'credit', seq: 5,  parent: 'Liabilities' },
  { name: 'Long-term Liabilities',nature:'credit', seq: 6,  parent: 'Liabilities' },
  // Equity – credit nature
  { name: 'Capital & Equity',   nature: 'credit', seq: 7,  parent: null },
  // Income – credit nature
  { name: 'Income',             nature: 'credit', seq: 8,  parent: null },
  { name: 'Direct Income',      nature: 'credit', seq: 9,  parent: 'Income' },
  { name: 'Indirect Income',    nature: 'credit', seq: 10, parent: 'Income' },
  // Expenses – debit nature
  { name: 'Expenses',           nature: 'debit',  seq: 11, parent: null },
  { name: 'Direct Expenses',    nature: 'debit',  seq: 12, parent: 'Expenses' },
  { name: 'Indirect Expenses',  nature: 'debit',  seq: 13, parent: 'Expenses' },
];

const DEFAULT_ACCOUNTS = [
  // account_type, name, group_name, opening_balance_type
  { type: 'cash',       name: 'Cash In Hand',          group: 'Current Assets',      obType: 'debit'  },
  { type: 'bank',       name: 'Bank Account',           group: 'Current Assets',      obType: 'debit'  },
  { type: 'debtor',     name: 'Sundry Debtors',         group: 'Current Assets',      obType: 'debit'  },
  { type: 'stock',      name: 'Stock In Hand',          group: 'Current Assets',      obType: 'debit'  },
  { type: 'fixed_asset',name: 'Plant & Machinery',      group: 'Fixed Assets',        obType: 'debit'  },
  { type: 'creditor',   name: 'Sundry Creditors',       group: 'Current Liabilities', obType: 'credit' },
  { type: 'duty_tax',   name: 'CGST Payable',           group: 'Current Liabilities', obType: 'credit' },
  { type: 'duty_tax',   name: 'SGST Payable',           group: 'Current Liabilities', obType: 'credit' },
  { type: 'duty_tax',   name: 'IGST Payable',           group: 'Current Liabilities', obType: 'credit' },
  { type: 'duty_tax',   name: 'CGST Input Credit',      group: 'Current Assets',      obType: 'debit'  },
  { type: 'duty_tax',   name: 'SGST Input Credit',      group: 'Current Assets',      obType: 'debit'  },
  { type: 'duty_tax',   name: 'IGST Input Credit',      group: 'Current Assets',      obType: 'debit'  },
  { type: 'loan',       name: 'Bank Loan',              group: 'Long-term Liabilities',obType: 'credit' },
  { type: 'capital',    name: 'Owner\'s Capital',       group: 'Capital & Equity',    obType: 'credit' },
  { type: 'capital',    name: 'Retained Earnings',      group: 'Capital & Equity',    obType: 'credit' },
  { type: 'income',     name: 'Sales Revenue',          group: 'Direct Income',       obType: 'credit' },
  { type: 'income',     name: 'Other Income',           group: 'Indirect Income',     obType: 'credit' },
  { type: 'expense',    name: 'Raw Material Cost',      group: 'Direct Expenses',     obType: 'debit'  },
  { type: 'expense',    name: 'Manufacturing Wages',    group: 'Direct Expenses',     obType: 'debit'  },
  { type: 'expense',    name: 'Office Rent',            group: 'Indirect Expenses',   obType: 'debit'  },
  { type: 'expense',    name: 'Salaries & Wages',       group: 'Indirect Expenses',   obType: 'debit'  },
  { type: 'expense',    name: 'Freight & Transport',    group: 'Direct Expenses',     obType: 'debit'  },
  { type: 'expense',    name: 'Bank Charges',           group: 'Indirect Expenses',   obType: 'debit'  },
];

const DEFAULT_GST_RATES = [
  { name: 'GST 0%',  rate: 0,   cgst: 0,   sgst: 0,   igst: 0   },
  { name: 'GST 5%',  rate: 5,   cgst: 2.5, sgst: 2.5, igst: 5   },
  { name: 'GST 12%', rate: 12,  cgst: 6,   sgst: 6,   igst: 12  },
  { name: 'GST 18%', rate: 18,  cgst: 9,   sgst: 9,   igst: 18  },
  { name: 'GST 28%', rate: 28,  cgst: 14,  sgst: 14,  igst: 28  },
];

// ── INIT: seed default COA for a company ──────────────────────────────────────
exports.initCompanyAccounts = async (req, res) => {
  const companyId = req.companyId;
  try {
    await transaction(async (client) => {
      // Check if already initialised
      const { rows: existing } = await client.query(
        'SELECT 1 FROM account_groups WHERE company_id=$1 LIMIT 1', [companyId]
      );
      if (existing.length > 0) {
        return; // already seeded
      }

      // Insert groups in order (parents first)
      const groupIds = {};
      for (const g of DEFAULT_GROUPS) {
        const parentId = g.parent ? groupIds[g.parent] : null;
        const { rows } = await client.query(
          `INSERT INTO account_groups (company_id, name, parent_group_id, nature, sequence_no, is_system)
           VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`,
          [companyId, g.name, parentId, g.nature, g.seq]
        );
        groupIds[g.name] = rows[0].id;
      }

      // Insert accounts
      for (const a of DEFAULT_ACCOUNTS) {
        const groupId = groupIds[a.group];
        if (!groupId) continue;
        await client.query(
          `INSERT INTO accounts
             (company_id, account_group_id, name, account_type, opening_balance_type, is_system, is_active)
           VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
           ON CONFLICT DO NOTHING`,
          [companyId, groupId, a.name, a.type, a.obType]
        );
      }

      // Seed voucher sequences
      const voucherTypes = ['payment','receipt','journal','contra','sales','purchase','debit_note','credit_note'];
      const prefixes = { payment:'PAY', receipt:'RCP', journal:'JRN', contra:'CON', sales:'SLS', purchase:'PUR', debit_note:'DN', credit_note:'CN' };
      for (const vt of voucherTypes) {
        await client.query(
          `INSERT INTO voucher_sequences (company_id, voucher_type, prefix, last_number)
           VALUES ($1, $2, $3, 0) ON CONFLICT DO NOTHING`,
          [companyId, vt, prefixes[vt]]
        );
      }

      // Seed GST rates
      for (const r of DEFAULT_GST_RATES) {
        await client.query(
          `INSERT INTO gst_tax_rates (company_id, name, rate, cgst_rate, sgst_rate, igst_rate, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)
           ON CONFLICT DO NOTHING`,
          [companyId, r.name, r.rate, r.cgst, r.sgst, r.igst]
        );
      }
    });

    res.json({ success: true, message: 'Chart of Accounts initialised' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ACCOUNT GROUPS ────────────────────────────────────────────────────────────
exports.getAccountGroups = async (req, res) => {
  const companyId = req.companyId;
  try {
    const { rows } = await query(
      `SELECT ag.*, p.name AS parent_name
       FROM account_groups ag
       LEFT JOIN account_groups p ON p.id = ag.parent_group_id
       WHERE ag.company_id = $1 OR ag.company_id IS NULL
       ORDER BY ag.sequence_no, ag.name`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAccountGroup = async (req, res) => {
  const companyId = req.companyId;
  const { name, parentGroupId, nature, sequenceNo } = req.body;
  if (!name || !nature) return res.status(400).json({ success: false, message: 'name and nature required' });
  try {
    const { rows } = await query(
      `INSERT INTO account_groups (company_id, name, parent_group_id, nature, sequence_no)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [companyId, name.trim(), parentGroupId || null, nature, sequenceNo || 0]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── ACCOUNTS (LEDGER MASTERS) ─────────────────────────────────────────────────
exports.getAccounts = async (req, res) => {
  const companyId = req.companyId;
  const { type, groupId, search, active } = req.query;
  let sql = `
    SELECT a.*, ag.name AS group_name, ag.nature AS group_nature
    FROM accounts a
    JOIN account_groups ag ON ag.id = a.account_group_id
    WHERE a.company_id = $1
  `;
  const params = [companyId];
  let i = 2;
  if (type)    { sql += ` AND a.account_type = $${i++}`;        params.push(type); }
  if (groupId) { sql += ` AND a.account_group_id = $${i++}`;    params.push(groupId); }
  if (search)  { sql += ` AND a.name ILIKE $${i++}`;            params.push(`%${search}%`); }
  if (active !== undefined) { sql += ` AND a.is_active = $${i++}`; params.push(active === 'true'); }
  sql += ' ORDER BY ag.sequence_no, a.name';
  try {
    const { rows } = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAccountById = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;
  try {
    const { rows } = await query(
      `SELECT a.*, ag.name AS group_name, ag.nature AS group_nature
       FROM accounts a JOIN account_groups ag ON ag.id = a.account_group_id
       WHERE a.id=$1 AND a.company_id=$2`,
      [id, companyId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAccount = async (req, res) => {
  const companyId = req.companyId;
  const { name, code, accountGroupId, accountType, openingBalance, openingBalanceType, gstApplicable, gstin, notes } = req.body;
  if (!name || !accountGroupId || !accountType) {
    return res.status(400).json({ success: false, message: 'name, accountGroupId and accountType required' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO accounts
         (company_id, name, code, account_group_id, account_type, opening_balance, opening_balance_type, gst_applicable, gstin, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [companyId, name.trim(), code||null, accountGroupId, accountType,
       openingBalance||0, openingBalanceType||'debit',
       gstApplicable||false, gstin||null, notes||null, req.user?.id||null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAccount = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;
  const { name, code, accountGroupId, accountType, openingBalance, openingBalanceType, gstApplicable, gstin, notes, isActive } = req.body;
  try {
    const { rows } = await query(
      `UPDATE accounts SET
         name=$1, code=$2, account_group_id=$3, account_type=$4,
         opening_balance=$5, opening_balance_type=$6,
         gst_applicable=$7, gstin=$8, notes=$9, is_active=$10, updated_at=NOW()
       WHERE id=$11 AND company_id=$12 AND is_system=FALSE RETURNING *`,
      [name, code||null, accountGroupId, accountType,
       openingBalance||0, openingBalanceType||'debit',
       gstApplicable||false, gstin||null, notes||null, isActive??true,
       id, companyId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Account not found or system account' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── VOUCHERS ──────────────────────────────────────────────────────────────────
exports.createVoucher = async (req, res) => {
  const companyId = req.companyId;
  const { voucherType, voucherDate, narration, referenceNumber, entries } = req.body;

  if (!voucherType || !voucherDate || !entries?.length) {
    return res.status(400).json({ success: false, message: 'voucherType, voucherDate, and entries required' });
  }

  // Validate Dr = Cr
  const totalDr = entries.filter(e => e.entryType === 'debit').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const totalCr = entries.filter(e => e.entryType === 'credit').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  if (Math.abs(totalDr - totalCr) > 0.01) {
    return res.status(400).json({ success: false, message: `Voucher is unbalanced: Dr ₹${totalDr.toFixed(2)} ≠ Cr ₹${totalCr.toFixed(2)}` });
  }
  if (entries.length < 2) {
    return res.status(400).json({ success: false, message: 'At least 2 entries (debit + credit) required' });
  }

  try {
    const result = await transaction(async (client) => {
      const voucherNumber = await nextVoucherNumber(client, companyId, voucherType);

      const { rows: [voucher] } = await client.query(
        `INSERT INTO vouchers
           (company_id, voucher_type, voucher_number, voucher_date, narration, reference_number, total_amount, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'posted',$8) RETURNING *`,
        [companyId, voucherType, voucherNumber, voucherDate, narration||null, referenceNumber||null, totalDr, req.user?.id||null]
      );

      for (const e of entries) {
        await client.query(
          `INSERT INTO voucher_entries
             (voucher_id, company_id, account_id, entry_type, amount, gst_type, gst_rate, gst_amount, bill_reference, narration)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [voucher.id, companyId, e.accountId, e.entryType, parseFloat(e.amount),
           e.gstType||null, e.gstRate||0, e.gstAmount||0, e.billReference||null, e.narration||null]
        );
      }

      return voucher;
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getVouchers = async (req, res) => {
  const companyId = req.companyId;
  const { type, from, to, status, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let sql = `
    SELECT v.*, u.first_name || ' ' || u.last_name AS created_by_name
    FROM vouchers v
    LEFT JOIN users u ON u.id = v.created_by
    WHERE v.company_id = $1
  `;
  const params = [companyId];
  let i = 2;
  if (type)   { sql += ` AND v.voucher_type = $${i++}`;   params.push(type); }
  if (status) { sql += ` AND v.status = $${i++}`;         params.push(status); }
  if (from)   { sql += ` AND v.voucher_date >= $${i++}`;  params.push(from); }
  if (to)     { sql += ` AND v.voucher_date <= $${i++}`;  params.push(to); }
  if (search) { sql += ` AND (v.voucher_number ILIKE $${i++} OR v.narration ILIKE $${i++})`; params.push(`%${search}%`, `%${search}%`); i++; }

  const countSql = sql.replace('v.*, u.first_name || \' \' || u.last_name AS created_by_name', 'COUNT(*) AS total');
  sql += ` ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT $${i++} OFFSET $${i++}`;
  params.push(parseInt(limit), offset);

  try {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, -2)),
    ]);
    res.json({ success: true, data: rows, total: parseInt(countRows[0]?.total || 0), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getVoucherById = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;
  try {
    const { rows: [voucher] } = await query(
      `SELECT v.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM vouchers v LEFT JOIN users u ON u.id=v.created_by
       WHERE v.id=$1 AND v.company_id=$2`,
      [id, companyId]
    );
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found' });

    const { rows: entries } = await query(
      `SELECT ve.*, a.name AS account_name, a.account_type
       FROM voucher_entries ve JOIN accounts a ON a.id = ve.account_id
       WHERE ve.voucher_id = $1 ORDER BY ve.entry_type DESC`,
      [id]
    );
    res.json({ success: true, data: { ...voucher, entries } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelVoucher = async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;
  try {
    const { rows } = await query(
      `UPDATE vouchers SET status='cancelled', updated_at=NOW()
       WHERE id=$1 AND company_id=$2 AND status='posted' RETURNING *`,
      [id, companyId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Voucher not found or cannot be cancelled' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── LEDGER STATEMENT (account-level Dr/Cr history) ────────────────────────────
exports.getLedgerStatement = async (req, res) => {
  const { accountId } = req.params;
  const companyId = req.companyId;
  const { from, to } = req.query;

  try {
    const { rows: [account] } = await query(
      `SELECT a.*, ag.name AS group_name, ag.nature
       FROM accounts a JOIN account_groups ag ON ag.id=a.account_group_id
       WHERE a.id=$1 AND a.company_id=$2`,
      [accountId, companyId]
    );
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });

    let entrySql = `
      SELECT ve.*, v.voucher_date, v.voucher_number, v.voucher_type, v.narration AS voucher_narration
      FROM voucher_entries ve
      JOIN vouchers v ON v.id = ve.voucher_id
      WHERE ve.account_id=$1 AND ve.company_id=$2 AND v.status='posted'
    `;
    const params = [accountId, companyId];
    let i = 3;
    if (from) { entrySql += ` AND v.voucher_date >= $${i++}`; params.push(from); }
    if (to)   { entrySql += ` AND v.voucher_date <= $${i++}`; params.push(to); }
    entrySql += ' ORDER BY v.voucher_date, v.created_at';

    const { rows: entries } = await query(entrySql, params);

    // Running balance
    let balance = account.opening_balance_type === 'debit'
      ? parseFloat(account.opening_balance)
      : -parseFloat(account.opening_balance);

    const isDebitNature = account.nature === 'debit';
    const ledger = entries.map(e => {
      const dr = e.entry_type === 'debit'  ? parseFloat(e.amount) : 0;
      const cr = e.entry_type === 'credit' ? parseFloat(e.amount) : 0;
      balance += isDebitNature ? (dr - cr) : (cr - dr);
      return { ...e, dr, cr, balance };
    });

    res.json({ success: true, data: { account, entries: ledger } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── TRIAL BALANCE ─────────────────────────────────────────────────────────────
exports.getTrialBalance = async (req, res) => {
  const companyId = req.companyId;
  const { asOf } = req.query; // date filter

  try {
    const dateCond = asOf ? `AND v.voucher_date <= '${asOf}'` : '';
    const { rows } = await query(
      `WITH entry_totals AS (
         SELECT ve.account_id,
                SUM(CASE WHEN ve.entry_type='debit'  THEN ve.amount ELSE 0 END) AS total_dr,
                SUM(CASE WHEN ve.entry_type='credit' THEN ve.amount ELSE 0 END) AS total_cr
         FROM voucher_entries ve
         JOIN vouchers v ON v.id=ve.voucher_id AND v.status='posted' ${dateCond}
         WHERE ve.company_id=$1
         GROUP BY ve.account_id
       )
       SELECT
         a.id, a.name, a.account_type, a.opening_balance, a.opening_balance_type,
         ag.name AS group_name, ag.nature,
         COALESCE(et.total_dr, 0) AS total_dr,
         COALESCE(et.total_cr, 0) AS total_cr
       FROM accounts a
       JOIN account_groups ag ON ag.id=a.account_group_id
       LEFT JOIN entry_totals et ON et.account_id=a.id
       WHERE a.company_id=$1 AND a.is_active=TRUE
       ORDER BY ag.sequence_no, a.name`,
      [companyId]
    );

    // Compute closing balance per account
    const data = rows.map(r => {
      const ob = parseFloat(r.opening_balance);
      const obDr = r.opening_balance_type === 'debit'  ? ob : 0;
      const obCr = r.opening_balance_type === 'credit' ? ob : 0;
      const totalDr = parseFloat(r.total_dr) + obDr;
      const totalCr = parseFloat(r.total_cr) + obCr;
      const balance  = totalDr - totalCr;
      return {
        ...r,
        total_dr: totalDr,
        total_cr: totalCr,
        closing_dr: balance > 0 ? balance : 0,
        closing_cr: balance < 0 ? -balance : 0,
      };
    });

    const grandDr = data.reduce((s, r) => s + r.closing_dr, 0);
    const grandCr = data.reduce((s, r) => s + r.closing_cr, 0);

    res.json({ success: true, data, grandDr, grandCr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PROFIT & LOSS ─────────────────────────────────────────────────────────────
exports.getProfitLoss = async (req, res) => {
  const companyId = req.companyId;
  const { from, to } = req.query;

  try {
    let dateCond = "v.status='posted'";
    const params = [companyId];
    let i = 2;
    if (from) { dateCond += ` AND v.voucher_date >= $${i++}`; params.push(from); }
    if (to)   { dateCond += ` AND v.voucher_date <= $${i++}`; params.push(to); }

    const { rows } = await query(
      `WITH entry_totals AS (
         SELECT ve.account_id,
                SUM(CASE WHEN ve.entry_type='debit'  THEN ve.amount ELSE 0 END) AS total_dr,
                SUM(CASE WHEN ve.entry_type='credit' THEN ve.amount ELSE 0 END) AS total_cr
         FROM voucher_entries ve
         JOIN vouchers v ON v.id=ve.voucher_id AND ${dateCond}
         WHERE ve.company_id=$1
         GROUP BY ve.account_id
       )
       SELECT
         a.id, a.name, a.account_type, ag.name AS group_name, ag.nature,
         COALESCE(et.total_dr,0) AS total_dr,
         COALESCE(et.total_cr,0) AS total_cr
       FROM accounts a
       JOIN account_groups ag ON ag.id=a.account_group_id
       LEFT JOIN entry_totals et ON et.account_id=a.id
       WHERE a.company_id=$1 AND a.is_active=TRUE
         AND ag.nature IN ('debit','credit')
         AND a.account_type IN ('income','expense')
       ORDER BY ag.nature DESC, ag.sequence_no, a.name`,
      params
    );

    const income   = rows.filter(r => r.account_type === 'income')
                        .map(r => ({ ...r, amount: parseFloat(r.total_cr) - parseFloat(r.total_dr) }));
    const expenses = rows.filter(r => r.account_type === 'expense')
                        .map(r => ({ ...r, amount: parseFloat(r.total_dr) - parseFloat(r.total_cr) }));

    const totalIncome   = income.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
    const netProfit     = totalIncome - totalExpenses;

    res.json({ success: true, data: { income, expenses, totalIncome, totalExpenses, netProfit } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── BALANCE SHEET ─────────────────────────────────────────────────────────────
exports.getBalanceSheet = async (req, res) => {
  const companyId = req.companyId;
  const { asOf } = req.query;

  try {
    const dateCond = asOf ? `AND v.voucher_date <= '${asOf}'` : '';
    const { rows } = await query(
      `WITH entry_totals AS (
         SELECT ve.account_id,
                SUM(CASE WHEN ve.entry_type='debit'  THEN ve.amount ELSE 0 END) AS total_dr,
                SUM(CASE WHEN ve.entry_type='credit' THEN ve.amount ELSE 0 END) AS total_cr
         FROM voucher_entries ve
         JOIN vouchers v ON v.id=ve.voucher_id AND v.status='posted' ${dateCond}
         WHERE ve.company_id=$1
         GROUP BY ve.account_id
       )
       SELECT
         a.id, a.name, a.account_type, a.opening_balance, a.opening_balance_type,
         ag.name AS group_name, ag.nature, ag.sequence_no,
         COALESCE(et.total_dr,0) AS total_dr,
         COALESCE(et.total_cr,0) AS total_cr
       FROM accounts a
       JOIN account_groups ag ON ag.id=a.account_group_id
       LEFT JOIN entry_totals et ON et.account_id=a.id
       WHERE a.company_id=$1 AND a.is_active=TRUE
         AND a.account_type NOT IN ('income','expense')
       ORDER BY ag.sequence_no, a.name`,
      [companyId]
    );

    const processed = rows.map(r => {
      const ob = parseFloat(r.opening_balance);
      const obDr = r.opening_balance_type === 'debit'  ? ob : 0;
      const obCr = r.opening_balance_type === 'credit' ? ob : 0;
      const dr = parseFloat(r.total_dr) + obDr;
      const cr = parseFloat(r.total_cr) + obCr;
      // Debit-nature (Assets): balance = Dr - Cr
      // Credit-nature (Liabilities/Equity): balance = Cr - Dr
      const balance = r.nature === 'debit' ? (dr - cr) : (cr - dr);
      return { ...r, balance };
    });

    const assets      = processed.filter(r => r.nature === 'debit');
    const liabilities = processed.filter(r => r.nature === 'credit');
    const totalAssets = assets.reduce((s, r) => s + r.balance, 0);
    const totalLiab   = liabilities.reduce((s, r) => s + r.balance, 0);

    res.json({ success: true, data: { assets, liabilities, totalAssets, totalLiabilities: totalLiab } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GST RATES ─────────────────────────────────────────────────────────────────
exports.getGstRates = async (req, res) => {
  const companyId = req.companyId;
  try {
    const { rows } = await query(
      'SELECT * FROM gst_tax_rates WHERE company_id=$1 AND is_active=TRUE ORDER BY rate',
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DAY BOOK (alias for getVouchers with entries joined) ──────────────────────
exports.getDayBook = async (req, res) => {
  const companyId = req.companyId;
  const { date, from, to, type } = req.query;

  let sql = `
    SELECT v.*, json_agg(json_build_object(
      'account_id', ve.account_id, 'account_name', a.name,
      'entry_type', ve.entry_type, 'amount', ve.amount
    ) ORDER BY ve.entry_type DESC) AS entries
    FROM vouchers v
    JOIN voucher_entries ve ON ve.voucher_id=v.id
    JOIN accounts a ON a.id=ve.account_id
    WHERE v.company_id=$1 AND v.status='posted'
  `;
  const params = [companyId];
  let i = 2;
  if (date)   { sql += ` AND v.voucher_date = $${i++}`;    params.push(date); }
  if (from)   { sql += ` AND v.voucher_date >= $${i++}`;   params.push(from); }
  if (to)     { sql += ` AND v.voucher_date <= $${i++}`;   params.push(to); }
  if (type)   { sql += ` AND v.voucher_type = $${i++}`;    params.push(type); }
  sql += ' GROUP BY v.id ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT 200';

  try {
    const { rows } = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
