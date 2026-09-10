import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '../../data'),
  JWT_SECRET: process.env.JWT_SECRET || 'ums-library-unpublish-secret-key-2026',
  SESSION_SECRET: process.env.SESSION_SECRET || 'ums-library-patron-secret-2026',

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',
  ALLOWED_EMAIL_DOMAIN: process.env.ALLOWED_EMAIL_DOMAIN || 'ums.ac.id',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // CAS SSO UMS (auth.ums.ac.id)
  CAS_HOST: process.env.CAS_HOST || 'auth.ums.ac.id',
  CAS_PORT: parseInt(process.env.CAS_PORT || '443', 10),
  CAS_CONTEXT: process.env.CAS_CONTEXT || '/cas',
  CAS_VERSION: process.env.CAS_VERSION || '2.0',
  CAS_DISABLE_SSL_VALIDATION: process.env.CAS_DISABLE_SSL_VALIDATION === 'true',
  CAS_SERVICE_URL: process.env.CAS_SERVICE_URL || 'http://localhost:5000/api/v1/auth/cas/callback',
  CAS_PATRON_SERVICE_URL: process.env.CAS_PATRON_SERVICE_URL || 'http://localhost:5000/api/v1/patron/sso/callback',

  // EPrints Database (Read-Only)
  // Check both EPRINTS_USE_MOCK and whether DB_HOST is set
  EPRINTS_USE_MOCK: process.env.EPRINTS_USE_MOCK === 'true',
  EPRINTS_DB_HOST: process.env.DB_HOST || process.env.EPRINTS_DB_HOST || '127.0.0.1',
  EPRINTS_DB_PORT: parseInt(process.env.DB_PORT || process.env.EPRINTS_DB_PORT || '3306', 10),
  EPRINTS_DB_NAME: process.env.DB_DATABASE || process.env.EPRINTS_DB_NAME || 'eprints',
  EPRINTS_DB_USER: process.env.DB_USERNAME || process.env.EPRINTS_DB_USER || '',
  EPRINTS_DB_PASSWORD: process.env.DB_PASSWORD || process.env.EPRINTS_DB_PASSWORD || '',

  // Storage Mount Path for PDFs
  EPRINTS_DOCUMENTS_PATH: process.env.EPRINTS_DOCUMENTS_PATH || path.join(__dirname, '../../mock-storage/documents'),

  // EPrints HTTP Origin for live document streaming
  EPRINTS_BASE_URL: process.env.EPRINTS_BASE_URL || 'http://localhost',
  EPRINTS_HTTP_USER: process.env.EPRINTS_HTTP_USER || process.env.DB_USERNAME || '',
  EPRINTS_HTTP_PASSWORD: process.env.EPRINTS_HTTP_PASSWORD || process.env.DB_PASSWORD || '',
};
