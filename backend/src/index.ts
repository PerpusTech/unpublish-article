import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env';
import { initAppDb } from './config/appDb';
import { AuthController } from './controllers/authController';
import { TokenController } from './controllers/tokenController';
import { ArticleController } from './controllers/articleController';
import { AuditController } from './controllers/auditController';
import { UserController } from './controllers/userController';
import { AnalyticsController } from './controllers/analyticsController';
import { BackupController } from './controllers/backupController';
import { SettingController } from './controllers/settingController';
import { requireAdminAuth } from './middlewares/adminAuth';
import { requirePatronSession, optionalPatronSession } from './middlewares/patronAuth';
import { TokenService } from './services/tokenService';

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: true, // Allow frontend origin
    credentials: true,
  })
);

// Health check endpoint for Docker & monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mockEprints: ENV.EPRINTS_USE_MOCK,
  });
});

const api = express.Router();

// ================= ADMIN & AUTH ROUTES =================
api.post('/auth/dev-login', AuthController.devLogin);
api.get('/auth/google', AuthController.getGoogleAuthUrl);
api.get('/auth/cas/login', AuthController.casLogin);
api.get('/auth/cas/callback', AuthController.casCallback);
api.get('/auth/cas/logout', AuthController.casLogout);
api.get('/auth/me', requireAdminAuth, AuthController.me);
api.post('/auth/logout', AuthController.logout);

api.post('/admin/tokens', requireAdminAuth, TokenController.createToken);
api.post('/admin/tokens/batch', requireAdminAuth, TokenController.createBatchTokens);
api.get('/admin/tokens', requireAdminAuth, TokenController.listTokens);
api.get('/admin/tokens/export', requireAdminAuth, TokenController.exportCsv);
api.post('/admin/tokens/:id/extend', requireAdminAuth, TokenController.extendToken);
api.post('/admin/tokens/:id/revoke', requireAdminAuth, TokenController.revokeToken);

api.get('/admin/audit-logs', requireAdminAuth, AuditController.listLogs);
api.get('/admin/audit-logs/export', requireAdminAuth, AuditController.exportCsv);
api.get('/admin/analytics', requireAdminAuth, AnalyticsController.getAnalytics);
api.get('/admin/incidents/recent', requireAdminAuth, TokenController.getRecentIncidents);
api.get('/admin/eprints-status', requireAdminAuth, ArticleController.getDbStatus);

// ================= DATABASE BACKUP & MAINTENANCE =================
api.get('/admin/backup/stats', requireAdminAuth, BackupController.getDatabaseStats);
api.get('/admin/backup/download', requireAdminAuth, BackupController.downloadBackup);
api.get('/admin/backup/export-json', requireAdminAuth, BackupController.exportJson);
api.post('/admin/backup/optimize', requireAdminAuth, BackupController.optimizeDatabase);

// ================= SECURITY & CAMPUS NETWORK SETTINGS =================
api.get('/admin/settings/security', requireAdminAuth, SettingController.getSecuritySettings);
api.put('/admin/settings/security', requireAdminAuth, SettingController.updateSecuritySettings);

// ================= USER MANAGEMENT ROUTES =================
api.get('/admin/users', requireAdminAuth, UserController.listUsers);
api.get('/admin/users/export', requireAdminAuth, UserController.exportCsv);
api.post('/admin/users', requireAdminAuth, UserController.createUser);
api.put('/admin/users/:email', requireAdminAuth, UserController.updateUser);
api.delete('/admin/users/:email', requireAdminAuth, UserController.deleteUser);

// ================= PATRON SESSION & TELEMETRY ROUTES =================
api.get('/patron/network-status', SettingController.getPatronNetworkStatus);
api.post('/patron/session/claim', TokenController.claimToken);
api.get('/patron/session/status', TokenController.getSessionStatus);
api.post('/patron/session/logout', TokenController.logout);
api.post('/patron/incident', TokenController.reportIncident);

// ================= PROTECTED ARTICLE & BROWSE ROUTES =================
api.get('/articles', requirePatronSession, ArticleController.listArticles);
api.get('/articles/:id', requirePatronSession, ArticleController.getArticle);
api.get('/articles/:id/documents/:docId/view', requirePatronSession, ArticleController.streamDocument);
api.get('/browse/:category', optionalPatronSession, ArticleController.browseCategory);

app.use('/api/v1', api);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } });
});

// Periodic token expiration maintenance (every 60s)
setInterval(async () => {
  try {
    const { tokens: activeTokens } = await TokenService.listTokens({ status: 'ACTIVE', limit: 1000 });
    const now = new Date().getTime();
    for (const t of activeTokens) {
      if (t.expires_at && now >= new Date(t.expires_at).getTime()) {
        await TokenService.getSessionStatus(t.id, t.device_fingerprint || '');
      }
    }
  } catch (err) {
    console.error('[Maintenance] Error running token cleaner:', err);
  }
}, 60000);

// Initialize DB and start server
async function bootstrap() {
  try {
    await initAppDb();
    app.listen(ENV.PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(` EPrints Unpublish Viewer Backend - Perpustakaan UMS`);
      console.log(` Status: Running on port ${ENV.PORT}`);
      console.log(` Environment: ${ENV.NODE_ENV}`);
      console.log(` Mock EPrints: ${ENV.EPRINTS_USE_MOCK ? 'ENABLED' : 'DISABLED'}`);
      console.log(` Documents Path: ${ENV.EPRINTS_DOCUMENTS_PATH}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('[FATAL] Failed to bootstrap server:', err);
    process.exit(1);
  }
}

bootstrap();
