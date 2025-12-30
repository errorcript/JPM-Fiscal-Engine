/**
 * DASHBOARD CONTROLLER
 * Mengelola logika halaman dashboard termasuk:
 * 1. Menampilkan Statistik (Keuangan, Omset, Target)
 * 2. Action Center (Notifikasi Tagihan & Pajak)
 * 3. Riwayat Transaksi (List & Search)
 * 4. Fungsi-fungsi Aksi (Bayar, Hapus, Cetak)
 */

window.dash = {
    // Target Omset Bulanan Default
    target: 10000000,

    /**
     * INIT: Fungsi Utama yang dijalankan saat halaman dimuat.
     * Mengambil data dari backend dan merender UI.
     */
    init: async () => {
        console.log("🚀 DASHBOARD LOADER: v.FINAL-REV-3");

        // Debug Visual
        const histEl = document.getElementById('historyContainer');
        if (histEl) histEl.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:1rem; font-size:0.9rem;">🔄 Menghubungkan Database...</div>';

        // Cek Dependensi Script
        if (typeof DB === 'undefined' || typeof AccountingService === 'undefined') {
            const errorMsg = "Critical: Backend scripts not loaded. Check network or file paths.";
            console.error(errorMsg);
            document.getElementById('checklistContainer').innerHTML = `<div style="padding:1rem; color: #ef4444; background: rgba(239,68,68,0.1); border-radius: 8px;">${errorMsg}</div>`;
            return;
        }

        try {
            // 1. Inisialisasi Database (dengan Timeout 10 detik agar tidak hanging selamanya)
            const dbPromise = DB.init();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Database Timeout")), 10000));

            await Promise.race([dbPromise, timeoutPromise]);

            // 2. Hitung Statistik Keuangan
            const stats = AccountingService.recalcStats();
            const taxData = AccountingService.calculateTax();

            // Ambil Saldo Kas dari Balance Sheet
            const balanceSheet = AccountingService.getBalanceSheet();
            const cash = balanceSheet.assets.accounts['1-1000'] || 0;

            // Load Target user dari local storage
            // Load Target user dari DB (Cloud Sync aware)
            const dashData = DB.getDashboardData();
            dash.target = dashData.target || 10000000;

            // 3. Update Tampilan Angka-angka (UI Binding)
            dash.updateStatUI(stats, cash);

            // 4. Render Action Center (Daftar Tugas)
            dash.renderActionCenter(stats, taxData);

            // 5. Render Riwayat Transaksi
            dash.renderHistory();

        } catch (e) {
            console.error("Dashboard Init Error:", e);
            document.getElementById('historyContainer').innerHTML = `
                <div style="text-align:center; padding:2rem; color:#ef4444;">
                    <div style="font-size:2rem; margin-bottom:1rem;">⚠️</div>
                    <div style="font-weight:bold;">Gagal Memuat Data</div>
                    <div style="font-size:0.8rem; margin-top:0.5rem; opacity:0.8;">${e.message}</div>
                    <button onclick="location.reload()" style="margin-top:1rem; padding:0.5rem 1rem; border:1px solid #ef4444; background:none; color:#ef4444; border-radius:6px; cursor:pointer;">Coba Lagi</button>
                    ${e.message.includes('Timeout') ? '<br><br><small>Koneksi lambat? Cek internet anda.</small>' : ''}
                </div>`;

            document.getElementById('checklistContainer').innerHTML = `
                <div style="padding:1rem; color: #fca5a5; text-align:center;">
                    Gagal memuat Action Center. <a href="#" onclick="location.reload()" style="color:white;">Reload</a>
                </div>`;
        }
    },

    /**
     * Update Angka Statistik di Kartu Atas
     */
    updateStatUI: (stats, cash) => {
        // Format Rupiah
        const fmt = AccountingService.formatIDR;

        document.getElementById('dispNetIncome').textContent = fmt(stats.netIncome);
        document.getElementById('dispCash').textContent = fmt(cash);
        document.getElementById('dispRevenue').textContent = fmt(stats.revenue);
        document.getElementById('txtTarget').textContent = `Target: ${fmt(dash.target)}`;

        // Update Progress Bar Target
        let pct = (stats.revenue / dash.target) * 100;
        if (pct > 100) pct = 100;
        document.getElementById('progressBar').style.width = `${pct}%`;
        document.getElementById('txtPersen').textContent = `${Math.round(pct)}%`;
    },

    /**
     * Render Action Center (Checklist Prioritas)
     * Menampilkan apa yang harus dilakukan user hari ini.
     */
    renderActionCenter: (stats, taxData) => {
        const list = document.getElementById('checklistContainer');
        list.innerHTML = '';
        const fmt = AccountingService.formatIDR;

        // A. Cek Invoice Belum Lunas
        if (stats.unpaidCount > 0) {
            list.innerHTML += itemTemplate(
                '!', 'rgba(239, 68, 68, 0.2)', '#ef4444',
                `${stats.unpaidCount} Invoice Belum Dibayar`,
                `Total Tertahan: ${fmt(stats.unpaidTotal)}`,
                `<button onclick="dash.followUp()" class="btn btn-sm btn-primary" style="font-size:0.75rem; padding: 4px 12px; font-weight:600;">Follow Up 📢</button>`
            );
        } else {
            list.innerHTML += itemTemplate(
                '✓', 'rgba(16, 185, 129, 0.2)', '#10b981',
                'Semua Invoice Aman',
                'Cashflow lancar jaya.',
                ''
            );
        }

        // NEW: Cek PPh 23 Belum Disetor (Prioritas Tinggi)
        const unpaidTax23 = DB.getTax23Payments().filter(t => !t.ntpp).length;
        if (unpaidTax23 > 0) {
            list.innerHTML += itemTemplate(
                '⚖️', 'rgba(245, 158, 11, 0.2)', '#f59e0b',
                `${unpaidTax23} PPh 23 Belum Disetor`,
                `Segera setor pajak 2% ke negara dan input NTPP.`,
                `<a href='reports.html' class='btn btn-sm btn-secondary' style='font-size:0.7rem; text-decoration:none;'>Urus Pajak</a>`
            );
        }

        // B. Cek Pajak
        if (!taxData.taxPaid && taxData.taxAmount > 0) {
            list.innerHTML += itemTemplate(
                '!', 'rgba(245, 158, 11, 0.2)', '#f59e0b',
                'Pajak Belum Disetor',
                `PPh Final bulan ini: ${fmt(taxData.taxAmount)}`,
                `<a href="reports.html" class="btn btn-primary" style="font-size:0.7rem; text-decoration:none;">Bayar</a>`
            );
        } else if (!taxData.taxPaid && taxData.grossRevenue > 0 && taxData.taxAmount === 0) {
            list.innerHTML += itemTemplate(
                '🎁', 'rgba(16, 185, 129, 0.2)', '#10b981',
                'Fasilitas Bebas Pajak',
                'Omset kumulatif masih di bawah 500jt.',
                ''
            );
        }

        // C. Pengingat Harian
        list.innerHTML += itemTemplate(
            '?', 'rgba(59, 130, 246, 0.2)', '#3b82f6',
            'Cek Selisih Kas',
            'Sudahkah anda input semua pengeluaran kecil hari ini?',
            `<a href="reports.html" class="btn btn-secondary" style="font-size:0.7rem; text-decoration:none;">Input</a>`
        );
    },

    /**
     * Render Daftar Riwayat Transaksi (Sebelah Kanan)
     */
    renderHistory: () => {
        const container = document.getElementById('historyContainer');
        const searchInput = document.getElementById('searchHistory');
        const term = searchInput ? searchInput.value.toLowerCase() : '';

        // Ambil data dari DB & Sortir tanggal terbaru
        let list = DB.getAllTransactions().sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
        container.innerHTML = '';

        // Filter Pencarian
        if (term) {
            list = list.filter(t =>
                t.customer.name.toLowerCase().includes(term) ||
                t.refNumber.toLowerCase().includes(term)
            );
        }

        if (list.length === 0) {
            container.innerHTML = `
                <div style="color:var(--text-secondary); text-align:center; padding:2rem; font-size:0.9rem;">
                    <div>${term ? 'Tidak ditemukan.' : 'Belum ada transaksi.'}</div>
                    ${!term ? '<div style="margin-top:10px;"><button onclick="if(confirm(\'Sync Cloud?\')){ DB.forcePullCloud(); }" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:white; padding:4px 10px; border-radius:4px; cursor:pointer;">🔄 Tarik Data Cloud</button></div>' : ''}
                </div>`;
            return;
        }

        // Generate HTML per item
        list.forEach(t => {
            const isPaid = t.status === 'PAID';
            const color = t.type === 'INVOICE' ? '#60a5fa' : '#34d399';
            const bg = t.type === 'INVOICE' ? 'rgba(96, 165, 250, 0.2)' : 'rgba(52, 211, 153, 0.2)';

            // Ikon SVG untuk tombol
            const iconPay = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`;
            const iconPrint = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`;
            const iconTrash = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

            // Tombol Aksi
            let actionButtons = `<div class="btn-group">`;
            if (!isPaid) {
                actionButtons += `<button class="btn-icon btn-pay" onclick="dash.payItem('${t.id}')" title="Terima Pembayaran (Tandai Lunas)">${iconPay}</button>`;
            }
            actionButtons += `<button class="btn-icon btn-print" onclick="dash.printItem('${t.id}')" title="Cetak PDF">${iconPrint}</button>`;
            actionButtons += `<button class="btn-icon btn-del" onclick="dash.deleteItem('${t.id}')" title="Hapus Data">${iconTrash}</button>`;
            actionButtons += `</div>`;

            // Badge Status
            const statusBadge = isPaid
                ? `<span style="font-size:0.7rem; color:var(--success); background:rgba(16, 185, 129, 0.1); padding:2px 6px; border-radius:4px; font-weight:600; margin-left:6px;">LUNAS</span>`
                : `<span style="font-size:0.7rem; color:var(--danger); background:rgba(239, 68, 68, 0.1); padding:2px 6px; border-radius:4px; font-weight:600; margin-left:6px;">TAGIHAN</span>`;

            // Buat Elemen HTML
            const item = document.createElement('div');
            item.className = 'checklist-item';

            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.75rem; flex-grow:1; width:100%;">
                    <div class="check-icon" style="background:${bg}; color:${color}; font-size:0.75rem; width:40px; height:40px; min-width:40px; display:flex; align-items:center; justify-content:center; border-radius:10px;">
                        ${t.type === 'INVOICE' ? 'INV' : 'NTA'}
                    </div>
                    <div class="check-content" style="overflow:hidden;">
                        <div class="check-title" style="font-size:1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${t.customer.name}</div>
                        <div class="check-sub" style="font-size:0.85rem; margin-top:4px; display:flex; align-items:center; flex-wrap:wrap;">
                            ${t.refNumber}
                            ${statusBadge}
                        </div>
                        <div style="font-size:0.9rem; font-weight:bold; color:var(--text-primary); margin-top:4px;">${AccountingService.formatIDR(t.totalAmount)}</div>
                    </div>
                </div>
                <div class="check-action" style="flex-shrink:0;">
                    ${actionButtons}
                </div>
            `;
            container.appendChild(item);
        });
    },

    // --- FUNGSI AKSI (ACTIONS) ---

    // 1. Hapus Transaksi
    deleteItem: async (id) => {
        if (confirm("Hapus transaksi ini? Data jurnal juga akan dihapus permanen.")) {
            try {
                await DB.deleteTransaction(id);
                await DB.deleteJournalsBySource(id);
                dash.init(); // Refresh UI
            } catch (e) {
                console.error("Delete Failed", e);
                alert("Gagal menghapus: " + e.message);
            }
        }
    },

    // 2. Cetak PDF (Redirect ke Halaman Cetak)
    printItem: (id) => {
        window.location.href = `invoice-gen.html?view=${id}`;
    },

    // 3. Bayar Tagihan (Pelunasan)
    payItem: async (id) => {
        const t = DB.getAllTransactions().find(x => x.id === id);
        if (!t) return;

        const msg = `Tandai LUNAS invoice ${t.refNumber}?\n\nNilai: ${AccountingService.formatIDR(t.totalAmount)}\nSaldo Kas akan bertambah otomatis.`;
        if (confirm(msg)) {
            try {
                // Update Status di DB
                const trans = await DB.markAsPaid(id);
                if (trans) {
                    // Buat Jurnal Otomatis (Kas Bertambah, Piutang Berkurang)
                    const journalId = DB.generateId();
                    const entry = {
                        id: journalId,
                        date: new Date().toISOString().split('T')[0],
                        desc: `Pelunasan #${trans.refNumber}`,
                        lines: [
                            { account: '1-1000', debit: trans.totalAmount, credit: 0 }, // Kas (Debit)
                            { account: '1-1200', debit: 0, credit: trans.totalAmount }  // Piutang (Credit)
                        ],
                        refId: trans.id
                    };
                    await DB.saveJournal(entry);
                    alert("✅ Pembayaran Berhasil!");
                    dash.init();
                }
            } catch (e) {
                console.error("Payment Failed", e);
                alert("Gagal memproses pembayaran.");
            }
        }
    },

    // 4. Set Target Omset
    setTarget: () => {
        const current = dash.target;
        const input = prompt("Masukkan Target Omset Bulanan (Rp):", current);
        if (input && !isNaN(input)) {
            dash.target = parseInt(input);
            DB.saveDashboardSettings({ target: dash.target });
            dash.init();
        }
    },

    // 5. Follow Up (Tagih WA)
    followUp: () => {
        const modal = document.getElementById('followUpModal');
        const container = document.getElementById('fuList');
        const list = DB.getAllTransactions().filter(t => t.type === 'INVOICE' && t.status !== 'PAID');

        if (list.length === 0) {
            alert("Tidak ada tagihan yang belum dibayar. Bagus!");
            return;
        }

        container.innerHTML = '';
        list.forEach(t => {
            const item = document.createElement('div');
            item.className = 'fu-item';
            const phone = t.customer.phone || '';

            // Generate Link WA
            let waLink = '#';
            if (phone) {
                let p = phone.replace(/\D/g, '');
                if (p.startsWith('0')) p = '62' + p.slice(1);
                else if (p.startsWith('8')) p = '62' + p;

                const msg = `Halo Kak ${t.customer.name}! 👋\n\nKami ingin menginformasikan Invoice *${t.refNumber}* \nSenilai: *${AccountingService.formatIDR(t.totalAmount)}*\nStatus: *BELUM LUNAS* ⏳\n\nMohon kesediaannya untuk melakukan pembayaran ya. Terima kasih banyak atas kerjasamanya! 🙏✨`;
                waLink = `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
            }

            const btnWA = phone ?
                `<a href="${waLink}" target="_blank" class="btn" style="background:#25D366; color:white; padding:8px 16px; font-size:0.85rem; text-decoration:none; display:inline-flex; align-items:center; gap:6px; border-radius:50px; white-space:nowrap; transition:0.2s;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    <span style="font-weight:600;">Tagih WA</span>
                </a>` :
                `<span style="color:#64748b; font-size:0.8rem; background:rgba(255,255,255,0.05); padding:6px 12px; border-radius:50px;">No Phone</span>`;

            item.innerHTML = `
                <div>
                    <span class="fu-name">${t.customer.name}</span>
                    <span class="fu-meta">${t.refNumber} • <span style="color:#ef4444;">${AccountingService.formatIDR(t.totalAmount)}</span></span>
                </div>
                <div>${btnWA}</div>
            `;
            container.appendChild(item);
        });

        modal.style.display = 'flex';
    },

    // 6. Manual Backup
    backupData: () => {
        const json = DB.exportData();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `JPM_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // 7. Restore Data
    restoreData: (input) => {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = DB.importData(e.target.result);
            if (result.success) {
                alert(`Restore Berhasil! ${result.count} transaksi dipulihkan.`);
                location.reload();
            } else {
                alert("Gagal Restore: " + result.message);
            }
        };
        reader.readAsText(file);
        input.value = '';
    },
    /**
     * Helper: Scroll ke Riwayat
     */
    scrollToHistory: () => {
        const el = document.getElementById('historySection');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
};

// Helper Template Action Center
function itemTemplate(icon, bg, color, title, sub, action) {
    return `
    <div class="checklist-item">
        <div class="check-icon" style="background: ${bg}; color:${color}">${icon}</div>
        <div class="check-content">
            <div class="check-title">${title}</div>
            <div class="check-sub">${sub}</div>
        </div>
        ${action ? `<div class="check-action">${action}</div>` : ''}
    </div>`;
}

// Global Manual Sync Function
async function manualSync() {
    if (confirm("⚠️ SYNC CLOUD (Manual)\n\nData lokal browser ini akan diunggah ke Cloud.\nLanjutkan?")) {
        try {
            await DB.syncLocalToCloud(); // Upload
            await DB.init(); // Reload
            alert("✅ Sinkronisasi Berhasil!");
            location.reload();
        } catch (e) {
            alert("Gagal: " + e.message);
        }
    }
}

// Jalankan Init dengan Delay untuk memastikan Auth & DB siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(dash.init, 500));
} else {
    setTimeout(dash.init, 500);
}
