// --- 3. FINANCE MODULE (Transactions, Journals, Stats) ---

Object.assign(DB, {
    // READ
    getTransaction: (id) => window.CACHE.transactions.find(t => t.id === id),
    getAllTransactions: () => [...window.CACHE.transactions],
    getAllJournals: () => [...window.CACHE.journals],
    getDashboardData: () => window.CACHE.dashboardData || {},
    getTax23Payments: () => window.CACHE.tax23Payments || [],

    // WRITE
    saveTransaction: async (data) => {
        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
            try {
                const { error } = await window.supabaseClient.from('transactions').upsert({ id: data.id, data: data });
                if (error) throw error;
            } catch (e) { console.error("Cloud Tx Error (Local Only):", e); }
        }
        const idx = window.CACHE.transactions.findIndex(t => t.id === data.id);
        if (idx > -1) window.CACHE.transactions[idx] = data;
        else window.CACHE.transactions.push(data);
        DB.saveToLocalStorage();
        return data;
    },

    saveJournal: async (entry) => {
        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
            window.supabaseClient.from('journals').upsert({ id: entry.id, data: entry }).then(({ error }) => {
                if (error) console.error("Journal Cloud Error:", error);
            });
        }
        window.CACHE.journals.push(entry);
        DB.saveToLocalStorage();
        return entry;
    },

    saveDashboardSettings: async (settings) => {
        window.CACHE.dashboardData = { ...window.CACHE.dashboardData, ...settings };
        DB.saveToLocalStorage();
        setTimeout(() => DB.syncLocalToCloud(), 100);
    },

    saveTax23Payment: async (data) => {
        if (!data.id) data.id = DB.generateId();
        const idx = window.CACHE.tax23Payments.findIndex(t => t.id === data.id);
        if (idx > -1) window.CACHE.tax23Payments[idx] = data;
        else window.CACHE.tax23Payments.push(data);
        DB.saveToLocalStorage();

        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
            try {
                await window.supabaseClient.from('tax23Payments').upsert({ id: data.id, data: data });
            } catch (e) { console.error("Cloud Save Error:", e); }
        }
        return data;
    },

    deleteTax23Payment: async (id) => {
        window.CACHE.tax23Payments = window.CACHE.tax23Payments.filter(t => t.id !== id);
        DB.saveToLocalStorage();
        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
            try {
                await window.supabaseClient.from('tax23Payments').delete().eq('id', id);
            } catch (e) { console.error("Cloud Tax Del Error:", e); }
        }
    },

    // NEW: Payroll History (Full Slip Data)
    getPayrolls: () => window.CACHE.payrolls || [],

    savePayroll: async (data) => {
        if (!data.id) data.id = DB.generateId();
        const idx = window.CACHE.payrolls.findIndex(p => p.id === data.id);
        if (idx > -1) window.CACHE.payrolls[idx] = data;
        else window.CACHE.payrolls.push(data);
        DB.saveToLocalStorage();

        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
            try {
                await window.supabaseClient.from('payrolls').upsert({ id: data.id, data: data });
            } catch (e) { console.error("Cloud Payroll Error:", e); }
        }
        return data;
    },

    // NEW: Expenses (Specific operational expenses if separated)
    getExpenses: () => window.CACHE.expenses || [],

    saveExpense: async (data) => {
        if (!data.id) data.id = DB.generateId();
        const idx = window.CACHE.expenses.findIndex(e => e.id === data.id);
        if (idx > -1) window.CACHE.expenses[idx] = data;
        else window.CACHE.expenses.push(data);
        DB.saveToLocalStorage();

        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
            try {
                await window.supabaseClient.from('expenses').upsert({ id: data.id, data: data });
            } catch (e) { console.error("Cloud Expense Error:", e); }
        }
        return data;
    },

    deleteTransaction: async (id) => {
        window.CACHE.transactions = window.CACHE.transactions.filter(t => t.id !== id);
        DB.saveToLocalStorage();
        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
            await window.supabaseClient.from('transactions').delete().eq('id', id);
        }
    },

    deleteJournal: async (id) => {
        const jIdx = window.CACHE.journals.findIndex(j => j.id === id);
        if (jIdx > -1) {
            window.CACHE.journals.splice(jIdx, 1);
            DB.saveToLocalStorage();
        }
        if (window.supabaseClient) {
            try {
                await window.supabaseClient.from('journals').delete().eq('id', id);
            } catch (e) { console.warn("Cloud Del Fail", e); }
        }
    },

    deleteJournalsBySource: async (refId) => {
        const toDelete = window.CACHE.journals.filter(j => j.refId === refId);
        window.CACHE.journals = window.CACHE.journals.filter(j => j.refId !== refId);
        DB.saveToLocalStorage();

        if (window.supabaseClient) {
            const ids = toDelete.map(j => j.id);
            if (ids.length > 0) {
                await window.supabaseClient.from('journals').delete().in('id', ids);
            }
        }
    }
});
