# 🚀 JPM Fiscal Engine
**The Independent Financial Backbone for PT Jaya Perkasa Mandalika**

[![Internal Use Only](https://img.shields.io/badge/Status-Internal--Only-red?style=for-the-badge)](https://github.com/errorcript/JPM-Fiscal-Engine)
[![Engine Version](https://img.shields.io/badge/Version-1.2.0--Stable-blue?style=for-the-badge)](https://github.com/errorcript/JPM-Fiscal-Engine)

---

## 📜 Deskripsi Proyek
**JPM Fiscal Engine** adalah sistem automasi finansial mandiri yang dirancang khusus untuk mengelola seluruh ekosistem keuangan, perpajakan, dan distribusi profit internal **PT Jaya Perkasa Mandalika (Websitegan)**. 

Aplikasi ini berdiri sepenuhnya sebagai aset internal perusahaan untuk menjamin efisiensi operasional, transparansi bagi hasil, dan kepatuhan fiskal yang presisi. Proyek ini beroperasi secara eksklusif untuk kebutuhan internal PT JPM.

---

## ✨ Core Features (Current Capacity)

| Fitur | Deskripsi | Status |
| :--- | :--- | :--- |
| **Automated Receipt Generator** | Penerbitan kuitansi resmi otomatis (PDF) segera setelah invoice tervalidasi. | ✅ Running |
| **PDF Tax Parser** | Ekstraksi data otomatis dari Faktur Pajak PDF (DPP, PPN 11%, Deskripsi Proyek) untuk sinkronisasi data pajak. | ✅ Running |
| **Automatic Distribution Logic** | Kalkulasi bagi hasil tim (Bagi 5) berdasarkan "Sultan Equation" secara transparan setelah potongan pajak & operasional. | ✅ Running |
| **E-Signature Validation** | Verifikasi tanda tangan elektronik pada dokumen fiskal untuk menjamin keabsahan data. | ✅ Running |

---

## ⚙️ Alur Kerja Sistem (System Flow)

1. **📥 Input**: Import dokumen pendukung seperti Faktur Pajak (PDF).
2. **🔄 Process**:
   - Sistem melakukan *parsing* data pajak secara otomatis.
   - Menghitung distribusi profit berdasarkan formula internal (Sultan Equation).
   - Menyiapkan draf kuitansi dan log finansial.
3. **📤 Output**: Penerbitan Kuitansi resmi dan pembaruan saldo log tim PT JPM secara real-time.

---

## 🗺️ Roadmap Pengembangan

- [ ] **Errorscript Financial Sync**: Integrasi tambahan untuk pengiriman data jatah bersih ke aplikasi Errorscript Financial sebagai personal tracking tool.
- [ ] **Wacap Notification Gateway**: Pengiriman alert otomatis via WhatsApp Agent (Wacap) saat kuitansi diterbitkan atau dana masuk.
- [ ] **JPM Executive Dashboard**: Dasbor visual untuk monitoring profitabilitas setiap proyek PT JPM secara real-time bagi pemegang kepentingan.

---

## 🛠️ Instalasi & Konfigurasi Teknis

### Persyaratan Sistem
- Node.js (v18+)
- Database: Supabase (PostgreSQL)

### Langkah Instalasi
1. Clone repository:
   ```bash
   git clone https://github.com/errorcript/JPM-Fiscal-Engine.git
   cd JPM-Fiscal-Engine
   ```
2. Instalasi dependencies:
   ```bash
   npm install
   ```
3. Konfigurasi Environment:
   Buat file `.env` di root directory dan lengkapi variabel berikut:
   ```env
   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # JPM Engine Settings
   DISTRIBUTION_MODE=SULTAN_EQUATION_V1
   TAX_RATE_PPN=0.11
   ```

---

Proyek ini dikembangkan dan dikelola sepenuhnya oleh tim developer **PT Jaya Perkasa Mandalika**. Seluruh integrasi dengan layanan eksternal (seperti Errorscript Financial) bersifat opsional dan merupakan fitur sinkronisasi data sekunder. JPM Fiscal Engine adalah entitas teknologi terpisah yang berfokus pada kekuatan finansial internal perusahaan.

---

**© 2025 PT Jaya Perkasa Mandalika.**  
*Automating transparency, empowering growth.*
