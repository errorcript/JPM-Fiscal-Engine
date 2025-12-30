// Data KBLI
const KBLI_SERVICES = [
    { code: "62019", title: "Aktivitas Pemrograman Komputer Lainnya", description: "Jasa pengembangan software kustom, integrasi API, dan sistem.", minDP: 50 },
    { code: "74149", title: "Aktivitas Desain Konten Kreatif Lainnya", description: "Desain grafis, UI/UX, dan konten digital.", minDP: 100 }
];

// COA Minimalis (SAK EMKM)
const COA = {
    ASSETS: [
        { code: '1-1000', name: 'Kas & Bank', type: 'DEBIT' },
        { code: '1-1200', name: 'Piutang Usaha', type: 'DEBIT' },
        { code: '1-1300', name: 'Perlengkapan', type: 'DEBIT' }
    ],
    LIABILITIES: [
        { code: '2-1000', name: 'Utang Usaha', type: 'CREDIT' },
        { code: '2-2000', name: 'Utang Pajak PPh', type: 'CREDIT' },
        { code: '2-2200', name: 'Utang PPh 23', type: 'CREDIT' }
    ],
    EQUITY: [
        { code: '3-1000', name: 'Modal Usaha', type: 'CREDIT' },
        { code: '3-3000', name: 'Saldo Laba', type: 'CREDIT' } // Retained Earnings
    ],
    REVENUE: [
        { code: '4-1000', name: 'Pendapatan Jasa', type: 'CREDIT' }
    ],
    EXPENSES: [
        { code: '6-1000', name: 'Biaya Gaji', type: 'DEBIT' },
        { code: '6-2000', name: 'Biaya Listrik & Internet', type: 'DEBIT' },
        { code: '6-3000', name: 'Biaya Sewa', type: 'DEBIT' },
        { code: '6-4000', name: 'Biaya Jasa Profesional', type: 'DEBIT' },
        { code: '6-5000', name: 'Biaya Operasional Lain', type: 'DEBIT' },
        { code: '6-9999', name: 'Beban Pajak', type: 'DEBIT' }
    ]
};

// IMMEDIATE EXPORT (Safety first)
if (typeof window !== 'undefined') {
    window.KBLI_SERVICES = KBLI_SERVICES;
    window.COA = COA;

    // Safety Listener for Multi-Tab Sync Conflict
    window.addEventListener('storage', (e) => {
        if (e.key === 'JPM_RESET_LOCK' && e.newValue === 'true') {
            console.log("🛑 Reset detected in another tab. Reloading to prevent conflicts...");
            document.body.innerHTML = '<div style="padding:2rem; text-align:center;"><h1>⚠️ RESET IN PROGRESS...</h1><p>Reset sedang berjalan di tab lain. Halaman akan dimuat ulang...</p></div>';
            setTimeout(() => location.reload(), 1500);
        }
    });
}

// Helper: Get Normal Balance (Debit/Credit) for an account code
const getAccountNormalBalance = (code) => {
    // 1 & 6 = DEBIT normal, 2,3,4 = CREDIT normal
    const prefix = code.charAt(0);
    return ['1', '6'].includes(prefix) ? 'DEBIT' : 'CREDIT';
};

// Supabase Configuration
const SUPABASE_URL = 'https://spnxftudkpuipjzvalhy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6HKvz0icCqGKfdkkGWURfg_jzFkGUlV'; // Using Publishable Key for client-side

let supabaseClient = null;

// Initialize Supabase Query Client (Lazy Helper)
const _initClient = () => {
    if (supabaseClient) return true; // Already init

    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("Supabase Client Init: Success");
            return true;
        } catch (e) {
            console.error("Supabase Init Error:", e);
            return false;
        }
    } else if (window.supabase && typeof window.supabase.createClient === 'function') {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("Supabase Client Init: Success (Window)");
            return true;
        } catch (e) {
            console.error("Supabase Init Error (Window):", e);
            return false;
        }
    }
    return false;
};

// Try init immediately (in case order is correct)
_initClient();

// In-Memory Cache for Performance + LocalStorage Backup
let CACHE = { transactions: [], journals: [], customers: [], tax23Payments: [], employees: [], dashboardData: {} };

try {
    CACHE.transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    CACHE.journals = JSON.parse(localStorage.getItem('journals')) || [];
    CACHE.customers = JSON.parse(localStorage.getItem('customers')) || [];
    CACHE.tax23Payments = JSON.parse(localStorage.getItem('tax23Payments')) || [];
    CACHE.employees = JSON.parse(localStorage.getItem('employees')) || [];
    CACHE.dashboardData = JSON.parse(localStorage.getItem('dashboardData')) || {};
} catch (e) {
    console.error("⚠️ LocalStorage Error (Safe Mode Enabled). Cache set to default.", e);
}

const DB = {
    // 1. INIT
    // 1. INIT
    init: async () => {
        let attempts = 0;
        // Check navigator.onLine to skip wait if definitely offline
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

        while (!supabaseClient && attempts < 20 && isOnline) {
            if (_initClient()) break;
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }

        if (!supabaseClient) {
            console.warn("⚠️ Mode Offline: Supabase Library Gagal Dimuat/Tidak Terhubung.");
        } else {
            console.log("✅ Supabase Library Ready.");
            // ✨ LIFETIME (REALTIME) SYNC
            DB.startRealtime();
        }

        // Auto Sync every 5 mins
        setInterval(() => {
            const isLocked = localStorage.getItem('JPM_RESET_LOCK');
            // Check navigator.onLine before attempting sync to reduce noise
            if (supabaseClient && !DB.isResetting && !isLocked && navigator.onLine) DB.syncCloudFull();
        }, 5 * 60 * 1000);

        // Initial Sync Strategy
        const isLocked = localStorage.getItem('JPM_RESET_LOCK');
        if (isLocked) {
            console.warn("⚠️ Sync blocked by Reset Lock.");
            return true;
        }

        if (CACHE.transactions.length > 0) {
            console.log("⚡ Menggunakan Data Lokal...");
            if (!DB.isResetting && navigator.onLine) DB.syncCloudFull(); // Background sync
            return true;
        } else {
            console.log("☁️ Data Kosong. Fetch Cloud...");
            // Only try active fetch if online
            if (!DB.isResetting && navigator.onLine) await DB.syncCloudFull();
            return true;
        }
    },

    isResetting: false,

    // 🔴 LIFETIME SYNC (REALTIME LISTENER)
    startRealtime: () => {
        if (!supabaseClient) return;

        console.log("📡 Mengaktifkan Realtime Sync (Lifetime)...");
        supabaseClient.channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, payload => {
                DB.handleRealtime('transactions', payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'journals' }, payload => {
                DB.handleRealtime('journals', payload);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log("✨ LIFETIME SCY: CONNECTED!");
            });
    },

    handleRealtime: (table, payload) => {
        // 1. Jika Tab ini sedang melakukan Reset, JANGAN diganggu.
        if (DB.isResetting) return;

        const { eventType, new: newRec, old: oldRec } = payload;
        const isLocked = localStorage.getItem('JPM_RESET_LOCK');

        // 2. Jika ada Tab LAIN sedang Reset (Lock aktif):
        // - TOLAK 'INSERT'/'UPDATE' (Supaya data zombie gak masuk)
        // - TERIMA 'DELETE' (Supaya Tab ini ikut bersih-bersih)
        if (isLocked && eventType !== 'DELETE') {
            console.log("🛡️ Realtime Event Blocked by Reset Lock");
            return;
        }

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
            }
            else if (eventType === 'DELETE') {
                if (table === 'transactions') {
                    CACHE.transactions = CACHE.transactions.filter(t => t.id !== oldRec.id);
                } else if (table === 'journals') {
                    CACHE.journals = CACHE.journals.filter(j => j.id !== oldRec.id);
                }
            }

            DB.saveToLocalStorage();
            // Broadcast event agar UI bisa update otomatis jika mendengarkan
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('JPM_DB_UPDATE'));

        } catch (e) {
            console.error("Realtime Error:", e);
        }
    },

    syncCloudFull: async () => {
        if (DB.isResetting || localStorage.getItem('JPM_RESET_LOCK')) {
            console.warn("⛔ Sync Aborted: Reset in progress.");
            return false;
        }
        try {
            // Load Tombstones (Deleted data that stubbornly exists in cloud)
            const tombstones = JSON.parse(localStorage.getItem('JPM_TOMBSTONES') || '[]');

            // First, push local changes
            if (navigator.onLine) await DB.syncLocalToCloud();

            // Then fetch latest from cloud (Parallel)
            if (!supabaseClient || !navigator.onLine) return false;

            const p1 = supabaseClient.from('transactions').select('*');
            const p2 = supabaseClient.from('journals').select('*');
            const p3 = supabaseClient.from('customers').select('*');
            const p4 = supabaseClient.from('tax23Payments').select('*');
            const p5 = supabaseClient.from('employees').select('*');

            const [r1, r2, r3, r4, r5] = await Promise.all([p1, p2, p3, p4, p5]);

            if (r1.data && r1.data.length > 0) {
                // Filter out tombstones
                CACHE.transactions = r1.data
                    .map(row => ({ ...row.data, id: row.id }))
                    .filter(t => !tombstones.includes(t.id));
            } else {
                CACHE.transactions = [];
            }

            if (r2.data && r2.data.length > 0) {
                // Filter out tombstones
                CACHE.journals = r2.data
                    .map(row => ({ ...row.data, id: row.id }))
                    .filter(j => !tombstones.includes(j.id));
            } else {
                CACHE.journals = [];
            }

            if (r3.data && !r3.error) {
                const allCustomers = r3.data.map(row => ({ ...row.data, id: row.id }));

                // Extract Global Settings (Target Omset)
                const settings = allCustomers.find(c => c.id === 'SETTINGS_GLOBAL');
                if (settings && settings.target) {
                    CACHE.dashboardData = { target: settings.target };
                }

                // Keep only real customers
                CACHE.customers = allCustomers.filter(c => c.id !== 'SETTINGS_GLOBAL');
            }

            if (r4.data && !r4.error) {
                CACHE.tax23Payments = r4.data.map(row => ({ ...row.data, id: row.id }));
            }

            if (r5.data && !r5.error) {
                CACHE.employees = r5.data.map(row => ({ ...row.data, id: row.id }));
            }

            DB.saveToLocalStorage();
            console.log("✅ Full Sync Complete.");
            return true;
        } catch (e) {
            console.error("Background Sync Error:", e);
            return false;
        }
    },

    syncLocalToCloud: async () => {
        if (!supabaseClient) return;

        try {
            console.log("Mengunggah data lokal ke cloud...");
            for (const t of CACHE.transactions) {
                if (DB.isResetting || localStorage.getItem('JPM_RESET_LOCK')) return;
                await supabaseClient.from('transactions').upsert({ id: t.id, data: t });
            }
            for (const j of CACHE.journals) {
                if (DB.isResetting || localStorage.getItem('JPM_RESET_LOCK')) return;
                await supabaseClient.from('journals').upsert({ id: j.id, data: j });
            }
            // Sync Customers
            if (CACHE.customers.length > 0) {
                for (const c of CACHE.customers) {
                    if (DB.isResetting || localStorage.getItem('JPM_RESET_LOCK')) return;
                    const { error } = await supabaseClient.from('customers').upsert({ id: c.id, data: c });
                    if (error && error.code !== '42P01') console.error("Gagal Cloud Customer:", error);
                }
            }

            // Sync Tax 23
            if (CACHE.tax23Payments.length > 0) {
                for (const tx of CACHE.tax23Payments) {
                    if (DB.isResetting || localStorage.getItem('JPM_RESET_LOCK')) return;
                    try {
                        await supabaseClient.from('tax23Payments').upsert({ id: tx.id, data: tx });
                    } catch (e) { console.warn("Tax23 Cloud Save Failed (Table Missing?)"); }
                }
            }

            // Sync Employees
            if (CACHE.employees.length > 0) {
                for (const emp of CACHE.employees) {
                    if (DB.isResetting || localStorage.getItem('JPM_RESET_LOCK')) return;
                    await supabaseClient.from('employees').upsert({ id: emp.id, data: emp }).catch(e => console.warn("Employee Cloud Fail"));
                }
            }

            // Sync Settings (Target Omset)
            if (CACHE.dashboardData && CACHE.dashboardData.target) {
                const settingsData = { target: CACHE.dashboardData.target }; // clean object
                await supabaseClient.from('customers').upsert({
                    id: 'SETTINGS_GLOBAL',
                    data: { ...settingsData, type: 'SETTINGS', name: 'SYSTEM_SETTINGS' }
                });
            }

            console.log("Upload Lokal selesai.");
        } catch (e) {
            console.warn("Sync Local->Cloud Upload Terhenti (Offline?):", e.message);
        }
    },

    forcePullCloud: async () => {
        if (!supabaseClient) {
            alert("Error: Tidak terhubung ke Supabase.");
            return;
        }
        try {
            document.body.style.opacity = '0.5';
            document.body.style.pointerEvents = 'none';

            await DB.syncCloudFull();

            alert("✅ Sinkronisasi Berhasil!");
            location.reload();

        } catch (e) {
            console.error("Force Pull Failed:", e);
            alert("❌ Gagal Sync: " + e.message);
            document.body.style.opacity = '1';
            document.body.style.pointerEvents = 'all';
        }
    },

    generateId: () => Math.random().toString(36).substr(2, 9).toUpperCase(),

    // READ Operations
    getTransaction: (id) => CACHE.transactions.find(t => t.id === id),
    getAllTransactions: () => [...CACHE.transactions],
    getAllJournals: () => [...CACHE.journals],
    getCustomers: () => CACHE.customers || [],
    getTax23Payments: () => CACHE.tax23Payments || [],
    getEmployees: () => CACHE.employees || [],
    getDashboardData: () => CACHE.dashboardData || {},

    // WRITE Operations
    saveTransaction: async (data) => {
        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('transactions').upsert({ id: data.id, data: data });
                if (error) throw error;
            } catch (e) {
                console.error("Cloud Error (Simpan Lokal Saja):", e);
                alert("⚠️ Gagal ke Cloud. Disimpan di LOKAL saja.");
            }
        }
        const idx = CACHE.transactions.findIndex(t => t.id === data.id);
        if (idx > -1) CACHE.transactions[idx] = data;
        else CACHE.transactions.push(data);
        DB.saveToLocalStorage();
        return data;
    },

    saveJournal: async (entry) => {
        if (supabaseClient) {
            supabaseClient.from('journals').upsert({ id: entry.id, data: entry }).then(({ error }) => {
                if (error) console.error("Jurnal Cloud Error:", error);
            });
        }
        CACHE.journals.push(entry);
        DB.saveToLocalStorage();
        return entry;
    },

    saveCustomer: async (data) => {
        // Auto ID if missing
        if (!data.id) data.id = DB.generateId();

        // Remove empty keys
        if (!data.name) return;

        // Check duplicate by Name (Update if exists)
        const idx = CACHE.customers.findIndex(c => c.name.toLowerCase() === data.name.toLowerCase());

        if (idx > -1) {
            CACHE.customers[idx] = { ...CACHE.customers[idx], ...data }; // Update
        } else {
            CACHE.customers.push(data); // Insert
        }

        DB.saveToLocalStorage();

        if (supabaseClient) {
            try {
                await supabaseClient.from('customers').upsert({ id: idx > -1 ? CACHE.customers[idx].id : data.id, data: data });
            } catch (e) { console.warn("Customer Cloud Save Failed (Table Missing?)"); }
        }
    },

    saveDashboardSettings: async (settings) => {
        CACHE.dashboardData = { ...CACHE.dashboardData, ...settings };
        DB.saveToLocalStorage();
        // Trigger background sync to push settings
        setTimeout(() => DB.syncLocalToCloud(), 100);
    },

    saveTax23Payment: async (data) => {
        if (!data.id) data.id = DB.generateId();
        const idx = CACHE.tax23Payments.findIndex(t => t.id === data.id);
        if (idx > -1) CACHE.tax23Payments[idx] = data;
        else CACHE.tax23Payments.push(data);

        DB.saveToLocalStorage();

        // Optimistic: Don't await cloud
        if (supabaseClient) {
            supabaseClient.from('tax23Payments').upsert({ id: data.id, data: data })
                .then(({ error }) => { if (error) console.warn("Cloud Tax Save Fail", error); })
                .catch(console.error);
        }
        return data;
    },

    saveEmployee: async (data) => {
        if (!data.id) data.id = DB.generateId();
        const idx = CACHE.employees.findIndex(e => e.id === data.id);
        if (idx > -1) CACHE.employees[idx] = data;
        else CACHE.employees.push(data);

        DB.saveToLocalStorage();
        DB.saveToLocalStorage();

        // Optimistic Sync
        if (supabaseClient) {
            supabaseClient.from('employees').upsert({ id: data.id, data: data })
                .then(({ error }) => { if (error) console.error("Cloud Employee Save Fail", error); })
                .catch(console.error);
        }
    },

    deleteEmployee: async (id) => {
        if (!confirm("Yakin ingin menghapus karyawan ini?")) return;

        CACHE.employees = CACHE.employees.filter(e => e.id !== id);
        DB.saveToLocalStorage();

        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('employees').delete().eq('id', id);
                if (error) console.error("Cloud Delete Employee Error:", error);
            } catch (e) {
                console.error("Cloud Delete Employee Exception:", e);
            }
        }
    },

    deleteTransaction: async (id) => {
        CACHE.transactions = CACHE.transactions.filter(t => t.id !== id);
        DB.saveToLocalStorage();

        if (supabaseClient) {
            await supabaseClient.from('transactions').delete().eq('id', id);
        }
    },

    deleteJournalsBySource: async (transId) => {
        const toDelete = CACHE.journals.filter(j => j.refId === transId);

        CACHE.journals = CACHE.journals.filter(j => j.refId !== transId);
        DB.saveToLocalStorage();

        if (supabaseClient) {
            toDelete.forEach(j => {
                supabaseClient.from('journals').delete().eq('id', j.id).then();
            });
        }
    },

    deleteJournal: async (id) => {
        CACHE.journals = CACHE.journals.filter(j => j.id !== id);
        DB.saveToLocalStorage();
        if (supabaseClient) {
            await supabaseClient.from('journals').delete().eq('id', id);
        }
    },

    markAsPaid: async (id) => {
        const idx = CACHE.transactions.findIndex(t => t.id === id);
        if (idx !== -1) {
            const updatedData = { ...CACHE.transactions[idx], status: 'PAID' };
            CACHE.transactions[idx] = updatedData;
            DB.saveToLocalStorage();

            if (supabaseClient) {
                await supabaseClient.from('transactions').update({ data: updatedData }).eq('id', id);
            }
            return CACHE.transactions[idx];
        }
        return null;
    },

    saveToLocalStorage: () => {
        localStorage.setItem('transactions', JSON.stringify(CACHE.transactions));
        localStorage.setItem('journals', JSON.stringify(CACHE.journals));
        localStorage.setItem('customers', JSON.stringify(CACHE.customers));
        localStorage.setItem('tax23Payments', JSON.stringify(CACHE.tax23Payments));
        localStorage.setItem('employees', JSON.stringify(CACHE.employees));
        localStorage.setItem('dashboardData', JSON.stringify(CACHE.dashboardData));
    },

    exportData: () => {
        const data = {
            transactions: CACHE.transactions,
            journals: CACHE.journals,
            customers: CACHE.customers,
            tax23Payments: CACHE.tax23Payments,
            employees: CACHE.employees,
            backupDate: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    },

    importData: (jsonStr) => {
        try {
            const data = JSON.parse(jsonStr);
            let mergedCount = 0;

            if (data.transactions && data.journals) {
                // Smart Merge Strategy
                data.transactions.forEach(newItem => {
                    const idx = CACHE.transactions.findIndex(t => t.id === newItem.id);
                    if (idx > -1) CACHE.transactions[idx] = newItem;
                    else CACHE.transactions.push(newItem);
                    mergedCount++;
                });

                data.journals.forEach(newItem => {
                    const idx = CACHE.journals.findIndex(j => j.id === newItem.id);
                    if (idx > -1) CACHE.journals[idx] = newItem;
                    else CACHE.journals.push(newItem);
                });

                if (data.customers) {
                    data.customers.forEach(newItem => {
                        const idx = CACHE.customers.findIndex(c => c.id === newItem.id || c.name === newItem.name);
                        if (idx > -1) CACHE.customers[idx] = { ...CACHE.customers[idx], ...newItem };
                        else CACHE.customers.push(newItem);
                    });
                }

                if (data.tax23Payments) {
                    data.tax23Payments.forEach(newItem => {
                        const idx = CACHE.tax23Payments.findIndex(t => t.id === newItem.id);
                        if (idx > -1) CACHE.tax23Payments[idx] = newItem;
                        else CACHE.tax23Payments.push(newItem);
                    });
                }

                if (data.employees) {
                    data.employees.forEach(newItem => {
                        const idx = CACHE.employees.findIndex(e => e.id === newItem.id);
                        if (idx > -1) CACHE.employees[idx] = newItem;
                        else CACHE.employees.push(newItem);
                    });
                }

                DB.saveToLocalStorage();
                setTimeout(() => DB.syncLocalToCloud(), 500);
                return { success: true, count: mergedCount };
            }
            return { success: false, message: "Format JSON salah/kosong" };
        } catch (e) {
            return { success: false, message: e.message };
        }
    },

    clearData: async () => {
        try {
            const json = DB.exportData();
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `JPM_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
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
                    localStorage.setItem('JPM_RESET_LOCK', 'true');

                    // 1. Clear Local State
                    CACHE.transactions = [];
                    CACHE.journals = [];
                    CACHE.dashboardData = {};

                    localStorage.removeItem('transactions');
                    localStorage.removeItem('journals');
                    localStorage.removeItem('dashboardData');
                    localStorage.removeItem('tax23Payments');
                    localStorage.removeItem('employees');

                    if (supabaseClient) {
                        try {
                            console.log("🧹 Starting NUCLEAR Cloud Cleanup...");

                            // 2. FETCH EVERYTHING TO MARK AS DEAD (TOMBSTONE STRATEGY)
                            // We fetch IDs to add them to a blacklist. This way, even if delete fails, we ignore them.
                            const { data: txData } = await supabaseClient.from('transactions').select('id');
                            const { data: jnData } = await supabaseClient.from('journals').select('id');

                            const txIds = txData ? txData.map(d => d.id) : [];
                            const jnIds = jnData ? jnData.map(d => d.id) : [];

                            console.log(`Found ${txIds.length} Tx and ${jnIds.length} Journals to kill.`);

                            // 3. MARK AS "TOMBSTONES" (Persistent Client-Side Blacklist)
                            const oldTombstones = JSON.parse(localStorage.getItem('JPM_TOMBSTONES') || '[]');
                            const newTombstones = [...new Set([...oldTombstones, ...txIds, ...jnIds])];
                            localStorage.setItem('JPM_TOMBSTONES', JSON.stringify(newTombstones));

                            // 4. ATTEMPT REAL CLOUD DELETE (Best Effort, Chunked)
                            const deleteBatch = async (table, ids) => {
                                if (!ids || ids.length === 0) return;

                                // Chunking to avoid URL too long error
                                const chunkSize = 20;
                                for (let i = 0; i < ids.length; i += chunkSize) {
                                    const chunk = ids.slice(i, i + chunkSize);
                                    const { error } = await supabaseClient.from(table).delete().in('id', chunk);
                                    if (error) console.warn(`Partial Delete Fail ${table}:`, error.message);
                                }
                            };

                            // Run deletions (Don't await perfectly, just try)
                            await deleteBatch('journals', jnIds);
                            await deleteBatch('transactions', txIds);

                            console.log("✅ Cleanup Sequence Finished.");
                            localStorage.removeItem('JPM_RESET_LOCK');
                            alert("✅ Reset Berhasil! Database telah dibersihkan.");
                            location.reload();

                        } catch (e) {
                            console.error("Cloud Reset Error:", e);
                            localStorage.removeItem('JPM_RESET_LOCK');
                            // Even if error, we reload because Tombstones should hide the data.
                            alert("✅ Reset Selesai (Data lama disembunyikan).");
                            location.reload();
                        }
                    } else {
                        localStorage.removeItem('JPM_RESET_LOCK');
                        alert("✅ Reset Berhasil (Mode Offline).");
                        location.reload();
                    }
                }
            }
        }, 1000);
    }
};

// EXPORT TO WINDOW (CRITICAL FIX)
if (typeof window !== 'undefined') {
    window.KBLI_SERVICES = KBLI_SERVICES;
    window.COA = COA;
    window.DB = DB;
    console.log("Global Variables (KBLI, COA, DB) attached to window.");
}
