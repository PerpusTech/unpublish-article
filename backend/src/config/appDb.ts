import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { ENV } from './env';

// Ensure data directory exists
if (!fs.existsSync(ENV.DATA_DIR)) {
  fs.mkdirSync(ENV.DATA_DIR, { recursive: true });
}

export const dbPath = path.join(ENV.DATA_DIR, 'app.db');
const db = new sqlite3.Database(dbPath);

// Promisified DB helpers
export const query = {
  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  },

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  },
};

export async function initAppDb(): Promise<void> {
  console.log(`[DB] Initializing local database at: ${dbPath}`);

  // 1. Tokens Table
  await query.run(`
    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      token_code TEXT UNIQUE NOT NULL,
      patron_name TEXT NOT NULL,
      patron_nim TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      device_fingerprint TEXT,
      created_by_admin TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      claimed_at DATETIME,
      expires_at DATETIME,
      claim_window_minutes INTEGER DEFAULT 30,
      claim_expires_at DATETIME,
      extended_minutes INTEGER DEFAULT 0,
      notes TEXT,
      incident_count INTEGER DEFAULT 0,
      last_incident_at DATETIME,
      last_incident_type TEXT
    )
  `);

  try {
    await query.run(`ALTER TABLE tokens ADD COLUMN claim_window_minutes INTEGER DEFAULT 30`);
  } catch {}
  try {
    await query.run(`ALTER TABLE tokens ADD COLUMN claim_expires_at DATETIME`);
  } catch {}
  try {
    await query.run(`ALTER TABLE tokens ADD COLUMN incident_count INTEGER DEFAULT 0`);
  } catch {}
  try {
    await query.run(`ALTER TABLE tokens ADD COLUMN last_incident_at DATETIME`);
  } catch {}
  try {
    await query.run(`ALTER TABLE tokens ADD COLUMN last_incident_type TEXT`);
  } catch {}

  await query.run(`CREATE INDEX IF NOT EXISTS idx_tokens_code ON tokens(token_code)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_tokens_expires ON tokens(expires_at)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_tokens_claim_expires ON tokens(claim_expires_at)`);

  // 2. Audit Logs Table
  await query.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL,
      patron_nim TEXT NOT NULL,
      patron_name TEXT NOT NULL,
      action TEXT NOT NULL,
      eprint_id INTEGER,
      article_title TEXT,
      eprint_status TEXT,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query.run(`CREATE INDEX IF NOT EXISTS idx_audit_token ON audit_logs(token_id)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_audit_nim ON audit_logs(patron_nim)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_audit_eprint ON audit_logs(eprint_id)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`);

  // 2b. Page-Level Reading Duration & Heatmap Logs Table
  await query.run(`
    CREATE TABLE IF NOT EXISTS page_reading_logs (
      id TEXT PRIMARY KEY,
      eprint_id INTEGER NOT NULL,
      article_title TEXT,
      page_number INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      patron_nim TEXT,
      patron_name TEXT,
      access_type TEXT DEFAULT 'INTRANET',
      ip_address TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query.run(`CREATE INDEX IF NOT EXISTS idx_reading_eprint ON page_reading_logs(eprint_id)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_reading_page ON page_reading_logs(eprint_id, page_number)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_reading_created ON page_reading_logs(created_at)`);

  // 3. Admin Users Table
  await query.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ADMIN',
      is_active INTEGER NOT NULL DEFAULT 1,
      sso_attributes TEXT,
      last_login_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: add sso_attributes column if table already exists without it
  try {
    await query.run(`ALTER TABLE admin_users ADD COLUMN sso_attributes TEXT`);
  } catch {
    // Column already exists
  }

  // Migrate legacy LIBRARIAN role to ADMIN
  await query.run(`UPDATE admin_users SET role = 'ADMIN' WHERE role = 'LIBRARIAN'`);

  // Auto-enrich and set SUPER_ADMIN specifically for Muhammad Asharul Ma'ali (masharulmaali / mam708)
  const asharulUser = await query.get('SELECT email FROM admin_users WHERE email = ?', ['mam708@ums.ac.id']);
  if (!asharulUser) {
    await query.run(
      `INSERT INTO admin_users (email, name, role, is_active) VALUES ('mam708@ums.ac.id', 'Muhammad Asharul Ma''ali', 'SUPER_ADMIN', 1)`
    );
  } else {
    await query.run(
      `UPDATE admin_users SET role = 'SUPER_ADMIN', name = 'Muhammad Asharul Ma''ali' WHERE email = 'mam708@ums.ac.id'`
    );
  }

  // Seed default UMS library admin for development / initial setup
  const defaultAdmin = await query.get('SELECT email FROM admin_users WHERE email = ?', ['pustakawan@ums.ac.id']);
  if (!defaultAdmin) {
    await query.run(
      `INSERT INTO admin_users (email, name, role, is_active) VALUES (?, ?, ?, 1)`,
      ['pustakawan@ums.ac.id', 'Pustakawan Layanan UMS', 'SUPER_ADMIN']
    );
    console.log('[DB] Seeded default librarian: pustakawan@ums.ac.id');
  }

  // 4. System Settings Table (Dynamic Access Mode & UMS Network Whitelist)
  await query.run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const accessModeSetting = await query.get('SELECT value FROM system_settings WHERE key = ?', ['access_mode']);
  if (!accessModeSetting) {
    await query.run(`INSERT INTO system_settings (key, value) VALUES ('access_mode', 'HYBRID')`);
    await query.run(`INSERT INTO system_settings (key, value) VALUES ('ums_ip_whitelist', ?)`, [
      JSON.stringify([
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        '127.0.0.1',
        '::1',
        'localhost',
      ])
    ]);
    console.log('[DB] Seeded default security settings: Mode HYBRID (Jaringan UMS + Token)');
  }

  // Sync all live EPrints Repository Administrators into local admin_users table
  try {
    const { CasService } = await import('../services/casService');
    await CasService.syncEPrintsAdmins();
  } catch (err) {
    console.warn('[DB] Could not sync EPrints admins during startup:', err);
  }

  console.log('[DB] Database tables verified and EPrints roles synchronized successfully.');
}

export default db;
