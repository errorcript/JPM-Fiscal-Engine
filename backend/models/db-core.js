// --- 2. CORE DATABASE ENGINE (Init, Sync, Cache) ---

// Ensure Global Access for modular files
window.supabaseClient = null;
window.CACHE = {
    transactions: [],
    journals: [],
    customers: [],
    tax23Payments: [],
    employees: [],
    payrolls: [], // NEW: Payroll Slips History
    expenses: [], // NEW: Specific Expense Records (if separated from transactions)
    dashboardData: {}
};

// Init Client Helper
const _initClient = () => {
    if (window.supabaseClient) return true;
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        try {
            window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("Supabase Client Init: Success");
            return true;
        } catch (e) {
            console.error("Supabase Init Error:", e);
            return false;
        }
    } else if (window.supabase && typeof window.supabase.createClient === 'function') {
        try {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("Supabase Client Init: Success (Window)");
            return true;
        } catch (e) {
            console.error("Supabase Init Error (Window):", e);
            return false;
        }
    }
    return false;
};

// Immediately Try Init
_initClient();

// Load Local Storage
try {
    CACHE.transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    CACHE.journals = JSON.parse(localStorage.getItem('journals')) || [];
    CACHE.customers = JSON.parse(localStorage.getItem('customers')) || [];
    CACHE.tax23Payments = JSON.parse(localStorage.getItem('tax23Payments')) || [];
    CACHE.employees = JSON.parse(localStorage.getItem('employees')) || [];
    CACHE.payrolls = JSON.parse(localStorage.getItem('payrolls')) || [];
    CACHE.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    CACHE.dashboardData = JSON.parse(localStorage.getItem('dashboardData')) || {};
} catch (e) {
    console.error("⚠️ LocalStorage Error. Cache set to default.", e);
}

// MAIN DB OBJECT
const DB = {
    isResetting: false,

    // INIT FUNCTION
    init: async () => {
        let attempts = 0;
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

        while (!window.supabaseClient && attempts < 20 && isOnline) {
            if (_initClient()) break;
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }

        if (!window.supabaseClient) {
            console.warn("⚠️ Mode Offline: Supabase Library Gagal.");
        } else {
            console.log("✅ Supabase Library Ready.");
            DB.startRealtime();
        }

        // Auto Sync Loop
        setInterval(() => {
            const isLocked = localStorage.getItem('NEOMA_RESET_LOCK');
            if (window.supabaseClient && !DB.isResetting && !isLocked && navigator.onLine) DB.syncCloudFull();
        }, 5 * 60 * 1000);

        // Initial Data Load
        const isLocked = localStorage.getItem('NEOMA_RESET_LOCK');
        if (isLocked) {
            console.warn("⚠️ Sync blocked by Reset Lock.");
            return true;
        }

        if (CACHE.transactions.length > 0) {
            console.log("⚡ Menggunakan Data Lokal...");
            if (!DB.isResetting && navigator.onLine) DB.syncCloudFull();
            return true;
        } else {
            console.log("☁️ Data Kosong. Fetch Cloud...");
            if (!DB.isResetting && navigator.onLine) await DB.syncCloudFull();
            return true;
        }
    },

    // UTILS
    generateId: () => Math.random().toString(36).substr(2, 9).toUpperCase(),

    saveToLocalStorage: () => {
        localStorage.setItem('transactions', JSON.stringify(CACHE.transactions));
        localStorage.setItem('journals', JSON.stringify(CACHE.journals));
        localStorage.setItem('customers', JSON.stringify(CACHE.customers));
        localStorage.setItem('tax23Payments', JSON.stringify(CACHE.tax23Payments));
        localStorage.setItem('employees', JSON.stringify(CACHE.employees));
        localStorage.setItem('payrolls', JSON.stringify(CACHE.payrolls));
        localStorage.setItem('expenses', JSON.stringify(CACHE.expenses));
        localStorage.setItem('dashboardData', JSON.stringify(CACHE.dashboardData));
    },

    // REALTIME & SYNC ENGINE
    startRealtime: () => {
        if (!window.supabaseClient) return;
        console.log("📡 Realtime Sync Active...");
        window.supabaseClient.channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, payload => DB.handleRealtime('transactions', payload))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'journals' }, payload => DB.handleRealtime('journals', payload))
            .subscribe((status) => { if (status === 'SUBSCRIBED') console.log("✨ REALTIME CONNECTED!"); });
    },

    handleRealtime: (table, payload) => {
        if (DB.isResetting) return;
        const { eventType, new: newRec, old: oldRec } = payload;
        const isLocked = localStorage.getItem('NEOMA_RESET_LOCK');

        if (isLocked && eventType !== 'DELETE') return; // Block inserts during reset

        console.log(`⚡ Live Update [${table}]: ${eventType}`);
        try {
            if (eventType === 'INSERT' || eventType === 'UPDATE') {
                const dataItem = { ...newRec.data, id: newRec.id };
                if (table === 'transactions') {
                    const idx = CACHE.transactions.findIndex(t => t.id === newRec.id);
                    if (idx > -1) CACHE.transactions[idx] = dataItem;
                    else CACHE.transactions.push(dataItem);
                } else if (table === 'journals') {
                    const idx = CACHE.journals.findIndex(j => j.id === newRec.id);
                    if (idx > -1) CACHE.journals[idx] = dataItem;
                    else CACHE.journals.push(dataItem);
                }
            } else if (eventType === 'DELETE') {
                if (table === 'transactions') CACHE.transactions = CACHE.transactions.filter(t => t.id !== oldRec.id);
                else if (table === 'journals') CACHE.journals = CACHE.journals.filter(j => j.id !== oldRec.id);
            }
            DB.saveToLocalStorage();
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('NEOMA_DB_UPDATE'));
        } catch (e) { console.error("Realtime Error:", e); }
    },

    syncCloudFull: async () => {
        if (DB.isResetting || localStorage.getItem('NEOMA_RESET_LOCK')) return false;
        try {
            const tombstones = JSON.parse(localStorage.getItem('NEOMA_TOMBSTONES') || '[]');
            if (navigator.onLine) await DB.syncLocalToCloud(); // Push first

            if (!window.supabaseClient || !navigator.onLine) return false;

            const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
                window.supabaseClient.from('transactions').select('*'),
                window.supabaseClient.from('journals').select('*'),
                window.supabaseClient.from('customers').select('*'),
                window.supabaseClient.from('tax23Payments').select('*'),
                window.supabaseClient.from('employees').select('*'),
                window.supabaseClient.from('payrolls').select('*'),
                window.supabaseClient.from('expenses').select('*')
            ]);

            if (r1.data) CACHE.transactions = r1.data.map(r => ({ ...r.data, id: r.id })).filter(t => !tombstones.includes(t.id));
            if (r2.data) CACHE.journals = r2.data.map(r => ({ ...r.data, id: r.id })).filter(j => !tombstones.includes(j.id));
            if (r3.data) {
                const all = r3.data.map(r => ({ ...r.data, id: r.id }));
                const set = all.find(c => c.id === 'SETTINGS_GLOBAL');
                if (set && set.target) CACHE.dashboardData = { target: set.target };
                CACHE.customers = all.filter(c => c.id !== 'SETTINGS_GLOBAL');
            }
            if (r4.data) CACHE.tax23Payments = r4.data.map(r => ({ ...r.data, id: r.id }));
            if (r5.data) CACHE.employees = r5.data.map(r => ({ ...r.data, id: r.id }));
            if (r6.data) CACHE.payrolls = r6.data.map(r => ({ ...r.data, id: r.id }));
            if (r7.data) CACHE.expenses = r7.data.map(r => ({ ...r.data, id: r.id }));

            DB.saveToLocalStorage();
            console.log("✅ Full Sync Complete.");
            return true;
        } catch (e) { console.error("Sync Error - Check Tables in Supabase:", e); return false; }
    },

    syncLocalToCloud: async () => {
        if (!window.supabaseClient) return;
        try {
            // Very simplified bulk push for clarity
            for (const t of CACHE.transactions) await window.supabaseClient.from('transactions').upsert({ id: t.id, data: t }).catch(console.warn);
            for (const j of CACHE.journals) await window.supabaseClient.from('journals').upsert({ id: j.id, data: j }).catch(console.warn);
            for (const c of CACHE.customers) await window.supabaseClient.from('customers').upsert({ id: c.id, data: c }).catch(console.warn);
            for (const tx of CACHE.tax23Payments) await window.supabaseClient.from('tax23Payments').upsert({ id: tx.id, data: tx }).catch(() => { });
            for (const e of CACHE.employees) await window.supabaseClient.from('employees').upsert({ id: e.id, data: e }).catch(() => { });
            for (const p of CACHE.payrolls) await window.supabaseClient.from('payrolls').upsert({ id: p.id, data: p }).catch(() => { });
            for (const ex of CACHE.expenses) await window.supabaseClient.from('expenses').upsert({ id: ex.id, data: ex }).catch(() => { });

            if (CACHE.dashboardData?.target) {
                await window.supabaseClient.from('customers').upsert({ id: 'SETTINGS_GLOBAL', data: { target: CACHE.dashboardData.target, type: 'SETTINGS' } });
            }
        } catch (e) { console.warn("Upload Error:", e); }
    },

    forcePullCloud: async () => {
        if (!window.supabaseClient) return alert("Offline!");
        try {
            document.body.style.opacity = '0.5';
            await DB.syncCloudFull();
            alert("✅ Sinkronisasi Berhasil!");
            location.reload();
        } catch (e) { alert("Error: " + e.message); location.reload(); }
    },

    clearData: async () => {
        try {
            // Backup functionality first
            const data = {
                transactions: window.CACHE.transactions,
                journals: window.CACHE.journals,
                customers: window.CACHE.customers,
                tax23Payments: window.CACHE.tax23Payments,
                employees: window.CACHE.employees,
                payrolls: window.CACHE.payrolls,
                expenses: window.CACHE.expenses,
                dashboardData: window.CACHE.dashboardData,
                backupDate: new Date().toISOString()
            };
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `NEOMA_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) { console.error("Backup failed", e); }

        setTimeout(async () => {
            if (confirm("⚠️ RESET RIWAYAT TRANSAKSI\n\nApakah Anda ingin MENGHAPUS SEMUA DATA TRANSAKSI & JURNAL?\n\nData Pelanggan TIDAK akan dihapus.\n\nData yang dihapus tidak bisa kembali.")) {
                const code = prompt("Ketik 'HAPUS' untuk konfirmasi:");
                if (code === 'HAPUS') {
                    document.body.style.cursor = 'wait';
                    DB.isResetting = true;
                    localStorage.setItem('NEOMA_RESET_LOCK', 'true');

                    // 1. Clear Local State (Keep Customers/Employees/Settings)
                    window.CACHE.transactions = [];
                    window.CACHE.journals = [];
                    window.CACHE.payrolls = [];
                    window.CACHE.expenses = [];
                    window.CACHE.tax23Payments = [];
                    // CACHE.dashboardData = {}; // Optional: reset target? No.

                    localStorage.removeItem('transactions');
                    localStorage.removeItem('journals');
                    localStorage.removeItem('payrolls');
                    localStorage.removeItem('expenses');
                    localStorage.removeItem('tax23Payments');
                    // localStorage.removeItem('dashboardData');

                    if (window.supabaseClient) {
                        try {
                            console.log("🧹 Starting NUCLEAR Cloud Cleanup...");

                            // 2. FETCH EVERYTHING TO MARK AS DEAD (TOMBSTONE STRATEGY)
                            const { data: txData } = await window.supabaseClient.from('transactions').select('id');
                            const { data: jnData } = await window.supabaseClient.from('journals').select('id');
                            const { data: pyData } = await window.supabaseClient.from('payrolls').select('id');
                            const { data: exData } = await window.supabaseClient.from('expenses').select('id');
                            const { data: taxData } = await window.supabaseClient.from('tax23Payments').select('id');

                            const txIds = txData ? txData.map(d => d.id) : [];
                            const jnIds = jnData ? jnData.map(d => d.id) : [];
                            const pyIds = pyData ? pyData.map(d => d.id) : [];
                            const exIds = exData ? exData.map(d => d.id) : [];
                            const taxIds = taxData ? taxData.map(d => d.id) : [];

                            console.log(`Found ${txIds.length} Tx, ${jnIds.length} Journals, ${taxIds.length} Taxes to kill.`);

                            // 3. MARK AS "TOMBSTONES" (Persistent Client-Side Blacklist)
                            const oldTombstones = JSON.parse(localStorage.getItem('NEOMA_TOMBSTONES') || '[]');
                            const newTombstones = [...new Set([...oldTombstones, ...txIds, ...jnIds, ...pyIds, ...exIds, ...taxIds])];
                            localStorage.setItem('NEOMA_TOMBSTONES', JSON.stringify(newTombstones));

                            // 4. ATTEMPT REAL CLOUD DELETE (Best Effort)
                            const deleteBatch = async (table, ids) => {
                                if (!ids || ids.length === 0) return;
                                const chunkSize = 20;
                                for (let i = 0; i < ids.length; i += chunkSize) {
                                    const chunk = ids.slice(i, i + chunkSize);
                                    await window.supabaseClient.from(table).delete().in('id', chunk);
                                }
                            };

                            await deleteBatch('journals', jnIds);
                            await deleteBatch('transactions', txIds);
                            await deleteBatch('payrolls', pyIds);
                            await deleteBatch('expenses', exIds);
                            await deleteBatch('tax23Payments', taxIds);

                            console.log("✅ Cleanup Sequence Finished.");
                            localStorage.removeItem('NEOMA_RESET_LOCK');
                            alert("✅ Reset Berhasil! Database telah dibersihkan.");
                            location.reload();

                        } catch (e) {
                            console.error("Cloud Reset Error:", e);
                            localStorage.removeItem('NEOMA_RESET_LOCK');
                            alert("✅ Reset Selesai (Data lama disembunyikan).");
                            location.reload();
                        }
                    } else {
                        localStorage.removeItem('NEOMA_RESET_LOCK');
                        alert("✅ Reset Berhasil (Mode Offline).");
                        location.reload();
                    }
                }
            }
        }, 1000);
    },

    exportData: () => {
        const data = {
            transactions: window.CACHE.transactions,
            journals: window.CACHE.journals,
            customers: window.CACHE.customers,
            tax23Payments: window.CACHE.tax23Payments,
            employees: window.CACHE.employees,
            payrolls: window.CACHE.payrolls,
            expenses: window.CACHE.expenses,
            dashboardData: window.CACHE.dashboardData,
            backupDate: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    },

    importData: (jsonString) => {
        try {
            const data = JSON.parse(jsonString);
            if (!data.backupDate) throw new Error("Format Backup Tidak Valid");

            window.CACHE.transactions = data.transactions || [];
            window.CACHE.journals = data.journals || [];
            window.CACHE.customers = data.customers || [];
            window.CACHE.tax23Payments = data.tax23Payments || [];
            window.CACHE.employees = data.employees || [];
            window.CACHE.payrolls = data.payrolls || [];
            window.CACHE.expenses = data.expenses || [];
            if (data.dashboardData) window.CACHE.dashboardData = data.dashboardData;

            DB.saveToLocalStorage();
            return { success: true, count: window.CACHE.transactions.length };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }
};

// EXPORT GLOBAL
if (typeof window !== 'undefined') window.DB = DB;
