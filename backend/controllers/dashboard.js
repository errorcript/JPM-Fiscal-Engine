// Dashboard Specific Logic (Extends AccountingService)

AccountingService.getDashboardStats = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // 1. Net Income & Revenue (This Month)
    const journals = DB.getAllJournals();
    let revenue = 0;
    let expense = 0;

    journals.forEach(j => {
        if (j.date.startsWith(monthPrefix)) {
            j.lines.forEach(l => {
                const prefix = l.account.charAt(0);
                if (prefix === '4') revenue += (l.credit - l.debit);
                if (prefix === '6') expense += (l.debit - l.credit);
            });
        }
    });

    // 2. Overdue Invoices
    const transactions = DB.getAllTransactions();
    const overdueList = transactions.filter(t => {
        if (t.type !== 'INVOICE' || t.status === 'PAID') return false;
        // Check due date
        const due = new Date(t.issueDate); // Simple logic: Issue Date + X days? 
        // In app.js we captured 'dueDate' in customer data but didn't strictly fully implement the Due Logic check against Today.
        // Let's rely on t.status usually updated, but here we calculate dynamically.
        // If we saved 'dueDate' in transaction.customer.dueDate (from app.js logic which puts it in data.dueDate, let's check where it saved).
        // In app.js: transaction.customer (name, address), wait.
        // app.js line 157: transaction object doesn't explicitly lift 'dueDate' to top level well, or it's in data.dueDate.
        // Let's re-read app.js generate().
        // It uses app.state.data.dueDate. But transaction object only has issueDate.
        // Wait, app.js line 224: transaction object passed refNumber etc. It does NOT seem to save Due Date to the transaction object explicitly!
        // I need to fix app.js first to ensure DueDate is saved in transaction, OR infer it.
        // Let's infer it for now or assume the user put it in 'customer' blob strictly?
        // Actually, createAutoJournal doesn't use DueDate.
        // I will update app.js to save dueDate properly first.
        return false;
    });

    // 2. Overdue Invoices (Simple Logic: Any Unpaid Invoice is treated as 'Action Needed')
    const overdueInvoices = transactions.filter(t => {
        return t.type === 'INVOICE' && t.status !== 'PAID';
    });

    return {
        revenue,
        netIncome: revenue - expense,
        unpaidCount: overdueInvoices.length,
        unpaidTotal: overdueInvoices.reduce((acc, t) => acc + t.totalAmount, 0)
    };
};
