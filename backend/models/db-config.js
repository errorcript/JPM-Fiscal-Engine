// --- 1. KONFIGURASI & KONSTANTA ---

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

// Supabase Configuration
const SUPABASE_URL = 'https://spnxftudkpuipjzvalhy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6HKvz0icCqGKfdkkGWURfg_jzFkGUlV';

// Helper: Get Normal Balance
const getAccountNormalBalance = (code) => {
    const prefix = code.charAt(0);
    return ['1', '6'].includes(prefix) ? 'DEBIT' : 'CREDIT';
};

// EXPORT TO WINDOW
if (typeof window !== 'undefined') {
    window.KBLI_SERVICES = KBLI_SERVICES;
    window.COA = COA;
    window.SUPABASE_URL = SUPABASE_URL;
    window.SUPABASE_KEY = SUPABASE_KEY;
    window.getAccountNormalBalance = getAccountNormalBalance;
}
