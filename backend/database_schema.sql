-- 1. Create CUSTOMERS Table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create TRANSACTIONS Table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create JOURNALS Table
CREATE TABLE IF NOT EXISTS journals (
    id TEXT PRIMARY KEY,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create TAX PPH 23 PAYMENTS Table (New)
CREATE TABLE IF NOT EXISTS tax23Payments (
    id TEXT PRIMARY KEY,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create EMPLOYEES Table (New for Payroll)
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax23Payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 7. Create Policies (Allow All Actions - Adjust for Production!)
-- DROP existing policies to avoid errors if re-running
DROP POLICY IF EXISTS "Enable all access for all users" ON customers;
DROP POLICY IF EXISTS "Enable all access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable all access for all users" ON journals;
DROP POLICY IF EXISTS "Enable all access for all users" ON tax23Payments;
DROP POLICY IF EXISTS "Enable all access for all users" ON employees;

CREATE POLICY "Enable all access for all users" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON journals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON tax23Payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON employees FOR ALL USING (true) WITH CHECK (true);
