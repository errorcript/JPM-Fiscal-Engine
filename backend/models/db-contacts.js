// --- 4. CONTACTS MODULE (Customers, Employees) ---

Object.assign(DB, {
    // READ
    getCustomers: () => window.CACHE.customers || [],
    getEmployees: () => window.CACHE.employees || [],

    // WRITE
    saveCustomer: async (data) => {
        if (!data.id) data.id = DB.generateId();
        if (!data.name) return;

        const idx = window.CACHE.customers.findIndex(c => c.name.toLowerCase() === data.name.toLowerCase());
        if (idx > -1) {
            window.CACHE.customers[idx] = { ...window.CACHE.customers[idx], ...data };
        } else {
            window.CACHE.customers.push(data);
        }
        DB.saveToLocalStorage();

        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
            try {
                await window.supabaseClient.from('customers').upsert({ id: idx > -1 ? window.CACHE.customers[idx].id : data.id, data: data });
            } catch (e) { console.warn("Customer Cloud Fail"); }
        }
    },

    saveEmployee: async (data) => {
        if (!data.id) data.id = DB.generateId();
        const idx = window.CACHE.employees.findIndex(e => e.id === data.id);
        if (idx > -1) window.CACHE.employees[idx] = data;
        else window.CACHE.employees.push(data);
        DB.saveToLocalStorage();

        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
            try {
                await window.supabaseClient.from('employees').upsert({ id: data.id, data: data });
            } catch (e) {
                console.error("Cloud Save Failed:", e);
                // Jangan throw error agar UI lokal tetap jalan
            }
        }
    },

    deleteEmployee: async (id) => {
        if (!confirm("Yakin ingin menghapus karyawan ini?")) return;
        window.CACHE.employees = window.CACHE.employees.filter(e => e.id !== id);
        DB.saveToLocalStorage();

        if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient) {
            try {
                await window.supabaseClient.from('employees').delete().eq('id', id);
            } catch (e) { console.error("Cloud Delete Failed", e); }
        }
    }
});
