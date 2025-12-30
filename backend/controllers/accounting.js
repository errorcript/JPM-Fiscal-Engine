// Accounting Engine

const AccountingService = {

    // --- 1. Transaction Recording ---

    // Auto-Journal from Invoice/Nota (System triggered)
    createAutoJournal: async (transaction) => {
        const journalId = DB.generateId();
        const date = transaction.issueDate.split('T')[0];

        let debitAcc = '';
        let creditAcc = '4-1000'; // Pendapatan Jasa

        if (transaction.type === 'INVOICE') {
            debitAcc = '1-1200'; // Piutang
        } else {
            debitAcc = '1-1000'; // Kas/Bank
        }

        const entry = {
            id: journalId,
            date: date,
            desc: `Pendapatan #${transaction.refNumber}`,
            lines: [
                { account: debitAcc, debit: transaction.totalAmount, credit: 0 },
                { account: creditAcc, debit: 0, credit: transaction.totalAmount }
            ],
            refId: transaction.id // Link to Transaction for deletion linkage
        };

        return await DB.saveJournal(entry);
    },

    // --- Tax Module (PPh Final 0.5%) ---

    // Calculate Tax for specific Month/Year
    getTaxSummary: (month, year) => {
        const journals = DB.getAllJournals();
        const currentPeriodPrefix = `${year}-${String(month).padStart(2, '0')}`;
        const yearPrefix = `${year}-`;

        let monthlyGrossRevenue = 0;
        let cumulativeRevenue = 0;
        let taxPaid = false;

        journals.forEach(j => {
            if (j.date.startsWith(yearPrefix)) {
                // Calculate Revenue for the whole year
                let rev = 0;
                j.lines.forEach(l => {
                    if (l.account === '4-1000') { // Pendapatan Jasa
                        rev += (l.credit - l.debit);
                    }
                });

                // Update Cumulative
                // NOTE: We should strictly filter only up to the *selected month* for correct simulation?
                // But simplified: we assume we are calculating for "Last Month" usually.
                // To be precise: Include only journals <= selected month.
                const jDate = new Date(j.date);
                if (jDate.getMonth() + 1 <= month) {
                    cumulativeRevenue += rev;
                }

                // Update Monthly
                if (j.date.startsWith(currentPeriodPrefix)) {
                    monthlyGrossRevenue += rev;
                    // Check if Tax Payment exists for this month
                    if (j.desc.includes('Pembayaran PPh Final') && j.desc.includes(currentPeriodPrefix)) {
                        taxPaid = true;
                    }
                }
            }
        });

        // Regulation PP 55/2022: Free tax for first 500jt turnover/year
        const THRESHOLD = 500000000;
        let taxAmount = 0;

        if (cumulativeRevenue > THRESHOLD) {
            const previousCumulative = cumulativeRevenue - monthlyGrossRevenue;

            if (previousCumulative < THRESHOLD) {
                // This is the month we crossed the threshold!
                // Tax only the excess amount
                const taxablePart = cumulativeRevenue - THRESHOLD;
                taxAmount = Math.floor(taxablePart * 0.005);
            } else {
                // We already crossed it before, tax full monthly revenue
                taxAmount = Math.floor(monthlyGrossRevenue * 0.005);
            }
        }
        // Else: taxAmount remains 0

        return {
            period: currentPeriodPrefix,
            grossRevenue: monthlyGrossRevenue,
            cumulativeRevenue: cumulativeRevenue,
            taxAmount,
            taxPaid,
            dueDate: new Date(year, month, 10), // 10th of next month
            isFree: cumulativeRevenue <= THRESHOLD
        };
    },

    // Pay Tax
    payTax: async (month, year, amount) => {
        const prefix = `${year}-${String(month).padStart(2, '0')}`;

        // 1. Accrue (Beban Pajak -> Utang Pajak)
        const accrueId = DB.generateId();
        const accrueEntry = {
            id: accrueId,
            date: new Date().toISOString().split('T')[0],
            desc: `Accrual PPh Final ${prefix}`,
            lines: [
                { account: '6-9999', debit: amount, credit: 0 }, // Beban
                { account: '2-2000', debit: 0, credit: amount }  // Utang
            ]
        };
        await DB.saveJournal(accrueEntry);

        // 2. Pay (Utang Pajak -> Kas)
        const payId = DB.generateId();
        const payEntry = {
            id: payId,
            date: new Date().toISOString().split('T')[0],
            desc: `Pembayaran PPh Final ${prefix}`, // Tag for checking
            lines: [
                { account: '2-2000', debit: amount, credit: 0 }, // Utang (D) per Request
                { account: '1-1000', debit: 0, credit: amount }  // Kas (K)
            ]
        };
        return await DB.saveJournal(payEntry);
    },

    // --- 1.5 Manual Expense Recording ---
    recordExpense: async (date, accountCode, amount, description) => {
        const id = DB.generateId();
        const entry = {
            id: id,
            date: date,
            desc: description || 'Biaya Operasional',
            lines: [
                { account: accountCode, debit: Number(amount), credit: 0 }, // Beban (D)
                { account: '1-1000', debit: 0, credit: Number(amount) }     // Kas (K)
            ]
        };
        return await DB.saveJournal(entry);
    },

    // --- 2. Reporting Engine ---

    // Generate Income Statement (Laba Rugi)
    getIncomeStatement: (filterMonth = null, filterYear = null) => {
        const journals = DB.getAllJournals();
        const report = { revenue: 0, expense: 0, netIncome: 0, details: {} };

        journals.forEach(j => {
            // Filter Logic
            if (filterYear !== null) {
                let jYear, jMonth;
                // Handle different separators and formats
                const parts = j.date.split(/[-/]/);

                if (parts.length >= 3) {
                    if (parts[0].length === 4) {
                        // YYYY-MM-DD
                        jYear = parseInt(parts[0]);
                        jMonth = parseInt(parts[1]);
                    } else if (parts[2].length === 4) {
                        // DD-MM-YYYY
                        jYear = parseInt(parts[2]);
                        jMonth = parseInt(parts[1]);
                    } else {
                        // Fallback
                        const d = new Date(j.date);
                        jYear = d.getFullYear();
                        jMonth = d.getMonth() + 1;
                    }
                } else {
                    const d = new Date(j.date);
                    jYear = d.getFullYear();
                    jMonth = d.getMonth() + 1;
                }

                if (isNaN(jYear) || isNaN(jMonth)) return; // Skip invalid
                if (jYear !== filterYear) return;
                if (filterMonth !== null && jMonth !== filterMonth) return;
            }

            j.lines.forEach(line => {
                const prefix = line.account.charAt(0);
                if (prefix === '4') { // Revenue
                    report.revenue += (line.credit - line.debit);
                    report.details[line.account] = (report.details[line.account] || 0) + (line.credit - line.debit);
                } else if (prefix === '6') { // Expense
                    report.expense += (line.debit - line.credit);
                    report.details[line.account] = (report.details[line.account] || 0) + (line.debit - line.credit);
                }
            });
        });

        report.netIncome = report.revenue - report.expense;
        return report;
    },

    // Generate Balance Sheet (Neraca)
    getBalanceSheet: () => {
        const journals = DB.getAllJournals();
        const report = {
            assets: { total: 0, accounts: {} },
            liabilities: { total: 0, accounts: {} },
            equity: { total: 0, accounts: {} }
        };

        // Calculate Account Balances
        const balances = {};

        journals.forEach(j => {
            j.lines.forEach(line => {
                if (!balances[line.account]) balances[line.account] = 0;

                const type = getAccountNormalBalance(line.account);
                if (type === 'DEBIT') {
                    balances[line.account] += (line.debit - line.credit);
                } else {
                    balances[line.account] += (line.credit - line.debit);
                }
            });
        });

        // Current Year Earnings
        const incomeStmt = AccountingService.getIncomeStatement();
        const currentEarnings = incomeStmt.netIncome;

        // Map to Report Structure
        Object.keys(balances).forEach(acc => {
            const prefix = acc.charAt(0);
            if (prefix === '1') {
                report.assets.accounts[acc] = balances[acc];
                report.assets.total += balances[acc];
            } else if (prefix === '2') {
                report.liabilities.accounts[acc] = balances[acc];
                report.liabilities.total += balances[acc];
            } else if (prefix === '3') {
                report.equity.accounts[acc] = balances[acc];
                report.equity.total += balances[acc];
            }
        });

        // Balance Equity
        if (!report.equity.accounts['3-3000']) report.equity.accounts['3-3000'] = 0;
        report.equity.accounts['3-3000'] += currentEarnings;
        report.equity.total += currentEarnings;

        return report;
    },

    // --- 3. Utilities ---
    formatIDR: (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num),

    exportToCSV: (filename, rows) => {
        let csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
    },

    // --- 4. Dashboard Helpers (Added for Frontend Compatibility) ---
    recalcStats: () => {
        const income = AccountingService.getIncomeStatement();
        const transactions = DB.getAllTransactions();

        const unpaid = transactions.filter(t => t.type === 'INVOICE' && t.status !== 'PAID');
        const unpaidTotal = unpaid.reduce((sum, t) => sum + t.totalAmount, 0);

        return {
            netIncome: income.netIncome,
            revenue: income.revenue,
            unpaidCount: unpaid.length,
            unpaidTotal: unpaidTotal
        };
    },

    calculateTax: () => {
        const now = new Date();
        // Cek Pajak Bulan LALU (karena bayarnya bulan ini)
        let m = now.getMonth();
        let y = now.getFullYear();
        if (m === 0) { m = 12; y--; }

        return AccountingService.getTaxSummary(m, y);
    }
};
