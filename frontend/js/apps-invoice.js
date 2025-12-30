// Application Logic

const app = {
    state: {
        step: 1,
        isDPMode: false,
        data: {
            type: '',
            customer: { name: '', address: '', phone: '' },
            items: [],
            amount: 0,
            dueDate: ''
        }
    },

    init: async () => {
        // 1. Populate UI IMMEDIATELY (Static Data)
        app.populateServices();

        // Set Default Date to Today
        const today = new Date().toISOString().split('T')[0];
        const dueDateEl = document.getElementById('dueDate');
        if (dueDateEl) dueDateEl.value = today;

        // 2. Then Connect DB (Async)
        await DB.init();

        // 3. Setup Autocomplete
        app.setupCustomerAutocomplete();


        // CHECK FOR VIEW MODE (From Dashboard)
        const urlParams = new URLSearchParams(window.location.search);
        const viewId = urlParams.get('view');

        if (viewId) {
            const t = DB.getTransaction(viewId);
            if (t) {
                app.currentTransaction = t;
                app.renderFinalOutput(t);

                // Adjust UI for "View Mode"
                const successBox = document.querySelector('#postActions > div:first-child');
                if (successBox) {
                    successBox.innerHTML = `
                        <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">📂 Mode Lihat Dokumen</h3>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">Anda sedang melihat arsip dokumen lama.</p>
                    `;
                    successBox.style.borderColor = 'var(--text-secondary)';
                    successBox.style.background = 'var(--bg-secondary)';
                }

                const btnRefresh = document.querySelector('button[onclick="location.reload()"]');
                if (btnRefresh) {
                    btnRefresh.textContent = "⬅️ Dashboard";
                    btnRefresh.onclick = () => window.location.href = 'dashboard.html';
                }
            } else {
                alert("Dokumen tidak ditemukan!");
                window.location.href = 'dashboard.html';
            }
        }
    },

    selectType: (type, el) => {
        app.state.data.type = type;
        document.querySelectorAll('.card-option').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        const dueGroup = document.getElementById('dueDateGroup');
        if (type === 'NOTA') {
            dueGroup.style.display = 'none';
        } else {
            dueGroup.style.display = 'block';
        }
        setTimeout(() => app.nextStep(), 300);
    },

    populateServices: () => {
        const select = document.getElementById('serviceSelect');
        if (!select) return; // Guard clause if element missing

        // Retain default option
        select.innerHTML = '<option value="" disabled selected>-- Pilih Template --</option>';

        if (typeof KBLI_SERVICES !== 'undefined') {
            KBLI_SERVICES.forEach(s => {
                const option = document.createElement('option');
                option.value = s.code;
                option.text = `[${s.code}] ${s.title}`;
                select.appendChild(option);
            });
        }
    },

    fillDescription: () => {
        const code = document.getElementById('serviceSelect').value;
        const service = KBLI_SERVICES.find(s => s.code === code);
        const descInput = document.getElementById('itemDesc');
        if (service) {
            descInput.value = service.description;
        }
    },

    addItem: () => {
        const descInput = document.getElementById('itemDesc');
        const priceInput = document.getElementById('itemPrice');
        const qtyInput = document.getElementById('itemQty');
        const serviceSelect = document.getElementById('serviceSelect');

        const desc = descInput.value;
        const price = parseFloat(priceInput.value);
        let qty = parseInt(qtyInput.value) || 1;

        const code = serviceSelect.value;
        const service = KBLI_SERVICES.find(s => s.code === code);
        const minDP = service ? (service.minDP || 100) : 100;

        if (!desc || !price || price <= 0) {
            alert("Mohon isi Deskripsi dan Harga yang valid.");
            return;
        }

        const newItem = {
            desc, qty, price, total: qty * price,
            originalDesc: desc,
            originalPrice: price,
            minDP: minDP,
            isDP: false
        };

        if (app.state.isDPMode) app.recalcDP(newItem);

        app.state.data.items.push(newItem);
        app.renderItemList();

        // Reset Inputs
        descInput.value = '';
        priceInput.value = '';
        qtyInput.value = '1';
        serviceSelect.value = '';
    },

    toggleDPMode: () => {
        app.state.isDPMode = !app.state.isDPMode;
        app.state.data.items.forEach(item => app.recalcDP(item));
        app.renderItemList();
    },

    recalcDP: (item) => {
        if (app.state.isDPMode && item.minDP < 100) {
            item.price = item.originalPrice * (item.minDP / 100);
            item.desc = `(DP ${item.minDP}%) ${item.originalDesc}`;
            item.isDP = true;
        } else {
            item.price = item.originalPrice;
            item.desc = item.originalDesc;
            item.isDP = false;
        }
        item.total = item.qty * item.price;
    },

    removeItem: (index) => {
        app.state.data.items.splice(index, 1);
        app.renderItemList();
    },

    renderItemList: () => {
        const container = document.getElementById('itemList');
        const totalEl = document.getElementById('displayTotal');
        container.innerHTML = '';
        let grandTotal = 0;

        if (app.state.data.items.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-secondary); font-size:0.8rem; padding:1rem;">Belum ada item ditambahkan.</div>';
        } else {
            app.state.data.items.forEach((item, idx) => {
                grandTotal += item.total;
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding:0.5rem 0;';

                let minDPInfo = '';
                if (item.minDP < 100) {
                    minDPInfo = `<span style="font-size:0.75rem; color:#f59e0b; background:rgba(245,158,11,0.1); padding:2px 6px; border-radius:4px; margin-left:6px; border:1px solid rgba(245,158,11,0.2);">Min DP: ${item.minDP}%</span>`;
                }

                row.innerHTML = `
                    <div style="flex-grow:1; margin-right:1rem;">
                        <div style="font-weight:600; font-size:0.9rem;">
                            ${item.desc} ${minDPInfo}
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-secondary);">${item.qty} x ${app.formatCurrency(item.price)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:bold; color:var(--text-primary);">${app.formatCurrency(item.total)}</div>
                        <button onclick="app.removeItem(${idx})" style="background:none; border:none; color:#ef4444; font-size:0.8rem; cursor:pointer;">Hapus</button>
                    </div>
                `;
                container.appendChild(row);
            });
        }

        app.state.data.amount = grandTotal;
        totalEl.textContent = app.formatCurrency(grandTotal);

        // RENDER DP TOGGLE ONLY IF TYPE IS INVOICE (Not NOTA)
        if (app.state.data.type !== 'NOTA' && app.state.data.items.length > 0) {
            const hasFlexibleDP = app.state.data.items.some(i => i.minDP < 100);
            let dpToggle = document.getElementById('btnToggleDP');
            if (hasFlexibleDP && !dpToggle) {
                const itemListDiv = document.getElementById('itemList');
                const listParent = itemListDiv.parentNode;
                let wrapper = document.getElementById('dpToggleContainer');
                if (!wrapper) {
                    wrapper = document.createElement('div');
                    wrapper.id = 'dpToggleContainer';
                    wrapper.style.marginBottom = '1rem';
                    wrapper.style.marginTop = '1rem';
                    listParent.appendChild(wrapper);
                }
                const btnLab = app.state.isDPMode ? "✅ Mode DP Aktif (Partial)" : "⬜ Mode DP Non-Aktif (Full)";
                const bg = app.state.isDPMode ? "var(--accent-color)" : "rgba(255,255,255,0.05)";
                wrapper.innerHTML = `
                    <button id="btnToggleDP" onclick="app.toggleDPMode()" class="btn" style="width:100%; border:1px solid rgba(255,255,255,0.2); background:${bg}; color:white; padding:0.8rem; border-radius:8px; cursor:pointer; transition:all 0.2s;">
                        ${btnLab}
                    </button>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px; text-align:center;">Aktifkan untuk menerapkan hitungan DP sesuai KBLI.</div>
                 `;
            } else if (!hasFlexibleDP && dpToggle) {
                const wrapper = document.getElementById('dpToggleContainer');
                if (wrapper) wrapper.remove();
            }
        } else {
            // Remove DP Toggle for NOTA or Empty Items
            const wrapper = document.getElementById('dpToggleContainer');
            if (wrapper) wrapper.remove();
        }
    },

    nextStep: () => {
        if (!app.validateStep(app.state.step)) return;
        app.saveStepData();
        if (app.state.step < 4) {
            app.state.step++;
            app.updateUI();
        }
    },

    prevStep: () => {
        if (app.state.step > 1) {
            app.state.step--;
            app.updateUI();
        }
    },

    validateStep: (step) => {
        if (step === 1) {
            if (!app.state.data.type) { alert("Pilih tipe dokumen dulu!"); return false; }
        }
        if (step === 2) {
            const name = document.getElementById('custName').value;
            if (!name) { alert("Nama Pelanggan wajib diisi!"); return false; }
        }
        if (step === 3) {
            if (app.state.data.items.length === 0) { alert("Minimal harus ada 1 item!"); return false; }
        }
        return true;
    },

    saveStepData: () => {
        if (app.state.step === 2) {
            app.state.data.customer.name = document.getElementById('custName').value;
            app.state.data.customer.phone = document.getElementById('custPhone').value;
            app.state.data.customer.address = document.getElementById('custAddress').value;
            app.state.data.dueDate = document.getElementById('dueDate').value;
        }
    },

    updateUI: () => {
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.getElementById(`step${app.state.step}`).classList.add('active');
        document.querySelectorAll('.step-dot').forEach(el => {
            const s = parseInt(el.getAttribute('data-step'));
            if (s <= app.state.step) {
                el.classList.add('active');
                el.style.background = 'var(--accent-color)';
                el.style.border = 'none';
            } else {
                el.classList.remove('active');
                el.style.background = 'var(--bg-secondary)';
                el.style.border = '1px solid var(--text-secondary)';
            }
        });
        document.getElementById('btnPrev').style.display = app.state.step === 1 ? 'none' : 'inline-block';
        if (app.state.step === 4) {
            document.getElementById('btnNext').style.display = 'none';
            document.getElementById('btnSubmit').style.display = 'inline-block';
            app.renderSummary();
        } else {
            document.getElementById('btnNext').style.display = 'inline-block';
            document.getElementById('btnSubmit').style.display = 'none';
        }
    },

    renderSummary: () => {
        document.getElementById('summType').textContent = app.state.data.type;
        document.getElementById('summName').textContent = app.state.data.customer.name;
        document.getElementById('summItemCount').textContent = `${app.state.data.items.length} Item`;
        document.getElementById('summTotal').textContent = app.formatCurrency(app.state.data.amount);
    },

    formatCurrency: (num) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);
    },

    formatDate: (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    },

    formatTime: (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':') + ' WIB';
    },

    generate: async () => {
        const transId = DB.generateId();
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

        const prefix = app.state.data.type === 'INVOICE' ? 'INV' : 'NTA';
        const refNumber = `${prefix}/${year}/${month}/${rnd}`;

        const transaction = {
            id: transId,
            refNumber: refNumber,
            type: app.state.data.type,
            customer: app.state.data.customer,
            items: app.state.data.items,
            totalAmount: app.state.data.amount,
            issueDate: now.toISOString(),
            dueDate: app.state.data.dueDate,
            status: app.state.data.type === 'NOTA' ? 'PAID' : 'DUE'
        };

        app.currentTransaction = transaction;

        try {
            // Auto-Save Customer
            await DB.saveCustomer(app.state.data.customer);

            // Updated: Await cloud Save. If validation or connection fails, it throws.
            // This prevents "Local Only" ghost data.
            await DB.saveTransaction(transaction);

            // Auto Journal is also async now
            const journal = await AccountingService.createAutoJournal(transaction);

            app.renderFinalOutput(transaction, journal);
        } catch (e) {
            console.error("Transaction Aborted:", e);
            // Alert handled in DB.saveTransaction but we stop UI progression
        }
    },

    renderFinalOutput: (t, journal) => {
        document.getElementById('wizard').style.display = 'none';
        document.querySelector('header').style.display = 'none';
        document.getElementById('preview-container').style.display = 'block';
        document.getElementById('postActions').style.display = 'block';

        const actionContainer = document.getElementById('postActions');
        if (!document.getElementById('btnAcc')) {
            const btnAcc = document.createElement('button');
            btnAcc.id = 'btnAcc';
            btnAcc.className = 'btn btn-primary';
            btnAcc.textContent = '📊 Lihat Laporan Keuangan';
            btnAcc.style.marginLeft = '1rem';
            btnAcc.onclick = () => window.location.href = 'reports.html';
            actionContainer.insertBefore(btnAcc, actionContainer.firstChild);
        }

        document.getElementById('outTitle').textContent = t.type;
        // Fix for "Ghost Text": Force solid color and reset background clips
        const titleEl = document.getElementById('outTitle');
        titleEl.style.color = t.type === 'INVOICE' ? '#2563eb' : '#16a34a'; // Darker Blue/Green
        titleEl.style.background = 'none';
        titleEl.style.webkitTextFillColor = 'initial';
        titleEl.style.textShadow = '0px 0px 1px rgba(0,0,0,0.1)';

        document.getElementById('outRef').textContent = `#${t.refNumber}`;

        // Update Status Badge (Top)
        const statusBadge = document.getElementById('outStatus');
        if (statusBadge) {
            if (t.status === 'PAID') {
                statusBadge.textContent = 'LUNAS (PAID)';
                statusBadge.style.background = '#dcfce7';
                statusBadge.style.color = '#15803d';
                statusBadge.style.border = '1px solid #86efac';
            } else {
                statusBadge.textContent = 'TAGIHAN (UNPAID)';
                statusBadge.style.background = '#fee2e2';
                statusBadge.style.color = '#b91c1c';
                statusBadge.style.border = '1px solid #fca5a5';
            }
        }

        document.getElementById('outDate').innerHTML = `
            ${app.formatDate(t.issueDate)}<br>
            <span style="font-size:0.85rem; color:#64748b; font-weight:normal;">Pukul ${app.formatTime(t.issueDate)}</span>
        `;

        if (t.type === 'INVOICE' && t.dueDate) {
            document.getElementById('outDue').textContent = app.formatDate(t.dueDate);
            document.getElementById('dueContainer').style.display = 'block';
        } else {
            document.getElementById('dueContainer').style.display = 'none';
        }

        document.getElementById('outCustomerName').innerHTML = `
            <div style="font-weight:bold; font-size:1.1rem; margin-bottom:4px; color:#0f172a;">${t.customer.name}</div>
            ${t.customer.phone ? `<div style="font-size:0.9rem; color:#64748b; margin-bottom:4px;">📞 ${t.customer.phone}</div>` : ''}
        `;
        document.getElementById('outCustomerAddr').innerHTML = t.customer.address ? `<div style="white-space: pre-wrap;">${t.customer.address}</div>` : '-';

        const tbody = document.querySelector('.invoice-table tbody');
        tbody.innerHTML = '';

        t.items.forEach(item => {
            const row = document.createElement('tr');
            const displayPrice = item.originalPrice !== undefined ? item.originalPrice : item.price;
            const displayTotal = displayPrice * item.qty;

            row.innerHTML = `
                <td>
                    <div style="font-weight:500; font-size:0.95rem; line-height:1.4; color:#1e293b;">${item.desc}</div>
                </td>
                <td style="text-align: right; vertical-align:top; font-weight:bold;">
                    <div style="font-size:0.8rem; color:#64748b; font-weight:normal;">${item.qty} x ${app.formatCurrency(displayPrice)}</div>
                    ${app.formatCurrency(displayTotal)}
                </td>
            `;
            tbody.appendChild(row);
        });

        const realTotal = t.items.reduce((sum, item) => {
            const price = item.originalPrice !== undefined ? item.originalPrice : item.price;
            return sum + (item.qty * price);
        }, 0);

        const grandTotalEl = document.getElementById('outGrandTotal');
        const totalContainer = grandTotalEl ? grandTotalEl.closest('.inv-total-inner') : null;

        if (totalContainer) {
            const remaining = realTotal - t.totalAmount;
            const isDP = Math.abs(realTotal - t.totalAmount) > 100;

            if (isDP) {
                // Logic: If Paid, visuals show Sisa 0.
                const showRemaining = t.status === 'PAID' ? 0 : remaining;
                const remainingColor = t.status === 'PAID' ? '#10b981' : '#ef4444'; // Green if 0/Paid, Red if Debt
                const paidLabel = t.status === 'PAID' ? 'Total Dibayar (LUNAS)' : 'Pembayaran Awal (DP)';

                totalContainer.innerHTML = `
                    <div style="display:grid; grid-template-columns: auto auto; gap: 8px 24px; text-align:right; align-items:center;">
                        <div style="color:#64748b; font-size:0.9rem;">Total Nilai Proyek</div>
                        <div style="font-weight:600; color:#64748b; font-size:0.9rem;">${app.formatCurrency(realTotal)}</div>
                        
                        <div style="color:#0f172a; font-weight:600; font-size:1.1rem;">${paidLabel}</div>
                        <div style="font-weight:800; color:#3b82f6; font-size:1.4rem;">${app.formatCurrency(t.totalAmount)}</div>
                        
                        <div style="color:${remainingColor}; font-size:0.9rem; font-weight:600; border-top:1px dashed #e2e8f0; padding-top:8px;">Sisa Tagihan</div>
                        <div style="color:${remainingColor}; font-size:1rem; font-weight:700; border-top:1px dashed #e2e8f0; padding-top:8px;">${app.formatCurrency(showRemaining)}</div>
                    </div>
                `;
            } else {
                const statusBadge = t.status === 'PAID' ?
                    `<span style="background:#dcfce7; color:#166534; font-size:0.6rem; padding:2px 6px; border-radius:4px; vertical-align:middle; margin-left:8px;">LUNAS</span>`
                    : '';

                totalContainer.innerHTML = `
                   <div style="font-size:0.9rem; color:#64748b; margin-bottom:8px;">Total Tagihan ${statusBadge}</div>
                   <div style="font-size:2rem; font-weight:800; color:#3b82f6;" id="outGrandTotal">${app.formatCurrency(t.totalAmount)}</div>
                `;
            }
        }
    },

    downloadPDF: (postActionCallback = null) => {
        try {
            if (typeof html2pdf === 'undefined') {
                alert("Library PDF (html2pdf) belum dimuat. Menggunakan Print Browser.");
                window.print();
                if (postActionCallback) postActionCallback();
                return;
            }

            const t = app.currentTransaction || app.state.data;
            const safeName = (t.customer.name || 'Client').replace(/[^a-zA-Z0-9 -]/g, '').trim();
            const safeRef = t.refNumber ? t.refNumber.replace(/[\/\\?%*:|"<>]/g, '-') : 'INV';
            const filename = `${safeName} - ${safeRef}.pdf`;

            const element = document.getElementById('preview-container');
            const box = element.querySelector('.invoice-box');

            // 1. Optimize styles for PDF (Full Width, No Shadow)
            const originalShadow = box.style.boxShadow;
            const originalMaxWidth = element.style.maxWidth;
            const originalMargin = element.style.margin;

            box.style.boxShadow = 'none'; // Remove shadow to prevent overflow/artifacts
            box.style.borderRadius = '0'; // Sharp corners for PDF
            element.style.maxWidth = 'none'; // Allow full width
            element.style.width = '794px';   // A4 width at 96 DPI (approx)
            element.style.margin = '0 auto';

            const opt = {
                margin: [0, 0, 0, 0], // Top, Left, Bottom, Right
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    scrollY: 0,
                    useCORS: true,
                    letterRendering: true
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            const titleEl = document.getElementById('outTitle');
            if (titleEl) {
                titleEl.style.display = 'block';
                titleEl.style.visibility = 'visible';
            }

            html2pdf().set(opt).from(element).save()
                .then(() => {
                    // Restore Styles
                    box.style.boxShadow = originalShadow;
                    box.style.borderRadius = '';
                    element.style.maxWidth = originalMaxWidth;
                    element.style.margin = originalMargin;

                    if (postActionCallback) postActionCallback();
                })
                .catch(err => {
                    console.error("PDF Fail:", err);

                    // Restore Styles on error too
                    box.style.boxShadow = originalShadow;
                    box.style.borderRadius = '';
                    element.style.maxWidth = originalMaxWidth;
                    element.style.margin = originalMargin;

                    if (err.name === 'SecurityError' || err.message.includes('Tainted')) {
                        if (confirm("⚠️ Browser memblokir 'Auto Download'. Gunakan mode Print?")) {
                            // Fallback to manual print view hacks
                            const titleColor = t.type === 'INVOICE' ? '#3b82f6' : '#22c55e';
                            let mount = document.getElementById('print-mount');
                            if (!mount) {
                                mount = document.createElement('div');
                                mount.id = 'print-mount';
                                document.body.appendChild(mount);
                            }

                            // Re-clone for Print Mode
                            mount.innerHTML = '';
                            const clone = element.cloneNode(true);
                            mount.appendChild(clone);

                            // ... (Wait context for the rest of print-mount logic if needed, but we keep existing logic flow below)
                            // Since we are replacing a block, we need to ensure we connect to valid code below.
                            // The original code had a large block for print fallback. 
                            // I will invoke the EXISTING print logic by throwing/handling or just re-implementing the style injection briefly.

                            const style = document.createElement('style');
                            style.id = 'print-style-block';
                            style.innerHTML = `
                                @media print { 
                                    @page { size: auto; margin: 0mm; }
                                    body > *:not(#print-mount) { display: none !important; }
                                    #print-mount { display: block !important; width:100%; height:100%; }
                                    #print-mount .invoice-box { box-shadow: none !important; border:none !important; }
                                }
                            `;
                            document.head.appendChild(style);
                            setTimeout(() => { window.print(); mount.remove(); style.remove(); }, 500);
                        }
                    } else {
                        alert("Gagal PDF: " + err.message);
                    }
                });
        } catch (e) {
            console.error(e);
            alert("System Error: " + e.message);
        }
    },


    shareToWA: () => {
        const d = app.currentTransaction || app.state.data;
        const total = app.formatCurrency(d.totalAmount || d.amount);
        const itemText = d.items.map(i => `- ${i.desc.substring(0, 20)}...`).join('%0A');
        const text = `Halo *${d.customer.name}*,%0A%0ABerikut terlampir Invoice/Nota dari *Neoma Creative Hub* senilai *${total}*.%0A%0ADetail Layanan:%0A${itemText}%0A%0AInfo lebih lengkap lihat di PDF terlampir.%0A%0ATerima kasih,%0ANeoma Creative Hub`;

        let url = `https://wa.me/?text=${text}`;
        if (d.customer.phone && d.customer.phone.trim().length > 5) {
            let p = d.customer.phone.replace(/\D/g, '');
            if (p.startsWith('0')) p = '62' + p.slice(1);
            else if (p.startsWith('8')) p = '62' + p;
            url = `https://wa.me/${p}?text=${text}`;
        }

        app.downloadPDF(() => {
            const newWindow = window.open(url, '_blank');
            if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
                window.location.href = url;
            }
        });
    },

    setupCustomerAutocomplete: () => {
        const input = document.getElementById('custName');
        const list = document.getElementById('customerList');
        const phone = document.getElementById('custPhone');
        const addr = document.getElementById('custAddress');

        if (!input || !list) return;

        // 1. Populate List
        const customers = DB.getCustomers();
        list.innerHTML = '';
        customers.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            list.appendChild(opt);
        });

        // 2. Handle Selection
        input.addEventListener('input', () => {
            const val = input.value;
            const found = customers.find(c => c.name === val);

            if (found) {
                if (found.phone) phone.value = found.phone;
                if (found.address) addr.value = found.address;

                // Feedback visual
                input.style.borderColor = 'var(--success)';
                setTimeout(() => input.style.borderColor = 'var(--text-secondary)', 1000);
            }
        });
    },

    shareToEmail: () => {
        app.downloadPDF(() => {
            const d = app.currentTransaction || app.state.data;
            const total = app.formatCurrency(d.totalAmount || d.amount);
            const subject = `Invoice from Neoma Creative Hub - ${d.customer.name} #${d.refNumber || ''}`;
            const body = `Yth. ${d.customer.name},\n\nTerlampir tagihan dari Neoma Creative Hub sebesar ${total}.\n\nSalam,\nNeoma Creative Hub`;
            const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.location.href = url;
        });
    }
};

document.addEventListener('DOMContentLoaded', app.init);
