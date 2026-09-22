import { broadcastLogout, broadcastLogin } from '../utils/sessionSync';

const API_BASE = '/api/v1';

// Client UUID stored in localStorage for fingerprinting
export function getClientUuid(): string {
  let uuid = localStorage.getItem('ums_client_uuid');
  if (!uuid) {
    uuid = 'client_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('ums_client_uuid', uuid);
  }
  return uuid;
}

export interface PatronSession {
  id: string;
  token_code: string;
  patron_name: string;
  patron_nim: string;
  expires_at: string;
  remaining_seconds: number;
}

export interface ArticleItem {
  eprintid: number;
  title: string;
  abstract: string;
  date_year: number;
  type: string;
  eprint_status: 'archive' | 'buffer' | 'inbox' | 'deletion';
  creators: string[];
  department?: string;
  id_number?: string;
  nim?: string;
  nidn?: string;
  documents?: {
    docid: number;
    filename: string;
    filesize: number;
    format: string;
    security: string;
  }[];
}

export interface TokenAdminItem {
  id: string;
  token_code: string;
  patron_name: string;
  patron_nim: string;
  duration_minutes: number;
  claim_window_minutes?: number;
  claim_expires_at?: string;
  claim_remaining_seconds?: number;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'EXPIRED_UNCLAIMED' | 'REVOKED';
  created_at: string;
  claimed_at?: string;
  expires_at?: string;
  extended_minutes: number;
  remaining_seconds?: number;
  notes?: string;
  incident_count?: number;
  last_incident_at?: string;
  last_incident_type?: string;
}

export interface AuditLogItem {
  id: string;
  patron_nim: string;
  patron_name: string;
  action: string;
  eprint_id?: number;
  article_title?: string;
  eprint_status?: string;
  ip_address: string;
  user_agent?: string;
  created_at: string;
}

export interface UserItem {
  email: string;
  name: string;
  role: 'ADMIN' | 'USER' | 'SUPER_ADMIN';
  is_active: number;
  last_login_at?: string;
  created_at?: string;
  sso_attributes?: string;
}

export interface BrowseItem {
  value: string;
  label: string;
  count: number;
}

export interface BrowseResult {
  category: 'year' | 'subject' | 'division' | 'type' | 'author';
  items: BrowseItem[];
}

export interface SearchSuggestions {
  nearestKeywords: string[];
  relatedDivisions: BrowseItem[];
  relatedSubjects: BrowseItem[];
  popularKeywords: string[];
}

export interface ArticleSearchResult {
  items: ArticleItem[];
  total: number;
  totalPages: number;
  suggestions?: SearchSuggestions;
}

export function getAdminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = localStorage.getItem('ums_admin_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // === Patron Session ===
  async claimToken(tokenCode: string): Promise<{ success: boolean; session?: PatronSession; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/patron/session/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-uuid': getClientUuid(),
        },
        credentials: 'include',
        body: JSON.stringify({
          tokenCode,
          clientUuid: getClientUuid(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error?.message || 'Gagal mengaktivasi token' };
      }
      if (data.session) {
        localStorage.setItem('ums_patron_session', JSON.stringify(data.session));
        localStorage.setItem('ums_patron_token_id', data.session.id);
        broadcastLogin(data.session);
      }
      return { success: true, session: data.session };
    } catch (err: any) {
      return { success: false, error: 'Terjadi kesalahan jaringan.' };
    }
  },

  async intranetCheckin(
    patronNim: string,
    patronName: string
  ): Promise<{ success: boolean; session?: PatronSession; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/patron/intranet-checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-uuid': getClientUuid(),
        },
        credentials: 'include',
        body: JSON.stringify({
          patronNim: patronNim.trim(),
          patronName: patronName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error?.message || 'Gagal menyimpan data identitas pemustaka' };
      }
      if (data.session) {
        localStorage.setItem('ums_patron_session', JSON.stringify(data.session));
        localStorage.setItem('ums_intranet_session', JSON.stringify(data.session));
        localStorage.setItem('ums_patron_token_id', data.session.id);
        broadcastLogin(data.session);
      }
      return { success: true, session: data.session };
    } catch (err: any) {
      return { success: false, error: 'Terjadi kesalahan jaringan saat check-in.' };
    }
  },

  async getPatronSsoLoginUrl(): Promise<{ url: string; switchAccountUrl?: string }> {
    const res = await fetch(`${API_BASE}/patron/sso/login`);
    if (!res.ok) {
      throw new Error('Gagal mendapatkan tautan SSO UMS');
    }
    return res.json();
  },

  async getSessionStatus(): Promise<{ isActive: boolean; session?: PatronSession; reason?: string }> {
    const storedTokenId = localStorage.getItem('ums_patron_token_id') || '';
    if (!storedTokenId) {
      return { isActive: false };
    }

    const qs = new URLSearchParams();
    qs.append('token_id', storedTokenId);

    const res = await fetch(`${API_BASE}/patron/session/status?${qs.toString()}`, {
      headers: {
        'x-client-uuid': getClientUuid(),
        'x-patron-token-id': storedTokenId,
      },
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Gagal memverifikasi status sesi (HTTP ${res.status})`);
    }

    const data = await res.json();
    if (data.isActive && data.session) {
      localStorage.setItem('ums_patron_session', JSON.stringify(data.session));
      localStorage.setItem('ums_patron_token_id', data.session.id);
    } else if (data.isActive === false && data.reason) {
      localStorage.removeItem('ums_patron_session');
      localStorage.removeItem('ums_patron_token_id');
    }
    return data;
  },

  async logoutPatron(sessionData?: { tokenId?: string; patronNim?: string; patronName?: string }): Promise<void> {
    try {
      let tokenId = sessionData?.tokenId;
      let patronNim = sessionData?.patronNim;
      let patronName = sessionData?.patronName;

      if (!tokenId || !patronNim) {
        try {
          const raw = localStorage.getItem('ums_patron_session') || localStorage.getItem('ums_intranet_session');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (!tokenId && parsed.id) tokenId = parsed.id;
            if (!patronNim && parsed.patron_nim) patronNim = parsed.patron_nim;
            if (!patronName && parsed.patron_name) patronName = parsed.patron_name;
          }
        } catch { }
      }

      await fetch(`${API_BASE}/patron/session/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-uuid': getClientUuid(),
        },
        credentials: 'include',
        body: JSON.stringify({
          tokenId,
          patronNim,
          patronName,
        }),
      });
    } finally {
      localStorage.removeItem('ums_patron_session');
      localStorage.removeItem('ums_intranet_session');
      localStorage.removeItem('ums_patron_token_id');
      broadcastLogout('USER_LOGOUT');
    }
  },

  // === Articles Catalog ===
  async searchArticles(params: {
    q?: string;
    status?: 'ALL' | 'UNPUBLISH' | 'PUBLISH';
    year?: number;
    subject?: string;
    division?: string;
    type?: string;
    author?: string;
    id_number?: string;
    page?: number;
    limit?: number;
  }): Promise<ArticleSearchResult> {
    const qs = new URLSearchParams();
    if (params.q) qs.append('q', params.q);
    if (params.status) qs.append('status', params.status);
    if (params.year) qs.append('year', params.year.toString());
    if (params.subject) qs.append('subject', params.subject);
    if (params.division) qs.append('division', params.division);
    if (params.type) qs.append('type', params.type);
    if (params.author) qs.append('author', params.author);
    if (params.id_number) qs.append('id_number', params.id_number);
    if (params.page) qs.append('page', params.page.toString());
    if (params.limit) qs.append('limit', params.limit.toString());

    const storedTokenId = localStorage.getItem('ums_patron_token_id') || '';
    if (storedTokenId) qs.append('token_id', storedTokenId);

    let patronHeaders: Record<string, string> = {};
    try {
      const rawSession = localStorage.getItem('ums_patron_session') || localStorage.getItem('ums_intranet_session');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed.patron_nim) patronHeaders['x-patron-nim'] = parsed.patron_nim;
        if (parsed.patron_name) patronHeaders['x-patron-name'] = parsed.patron_name;
      }
    } catch { }

    const res = await fetch(`${API_BASE}/articles?${qs.toString()}`, {
      credentials: 'include',
      headers: {
        'x-client-uuid': getClientUuid(),
        ...(storedTokenId ? { 'x-patron-token-id': storedTokenId } : {}),
        ...patronHeaders,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal memuat katalog artikel');
    }
    return await res.json();
  },

  async browseCategory(
    category: 'year' | 'subject' | 'division' | 'type' | 'author',
    q?: string
  ): Promise<BrowseResult> {
    const qs = new URLSearchParams();
    if (q) qs.append('q', q);

    const storedTokenId = localStorage.getItem('ums_patron_token_id') || '';
    if (storedTokenId) qs.append('token_id', storedTokenId);

    let patronHeaders: Record<string, string> = {};
    try {
      const rawSession = localStorage.getItem('ums_patron_session') || localStorage.getItem('ums_intranet_session');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed.patron_nim) patronHeaders['x-patron-nim'] = parsed.patron_nim;
        if (parsed.patron_name) patronHeaders['x-patron-name'] = parsed.patron_name;
      }
    } catch { }

    const res = await fetch(`${API_BASE}/browse/${category}?${qs.toString()}`, {
      credentials: 'include',
      headers: {
        'x-client-uuid': getClientUuid(),
        ...(storedTokenId ? { 'x-patron-token-id': storedTokenId } : {}),
        ...patronHeaders,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal memuat data penjelajahan');
    }
    return await res.json();
  },

  async getArticle(id: number): Promise<ArticleItem> {
    const storedTokenId = localStorage.getItem('ums_patron_token_id') || '';
    const qs = new URLSearchParams();
    if (storedTokenId) qs.append('token_id', storedTokenId);

    let patronHeaders: Record<string, string> = {};
    try {
      const rawSession = localStorage.getItem('ums_patron_session') || localStorage.getItem('ums_intranet_session');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed.patron_nim) patronHeaders['x-patron-nim'] = parsed.patron_nim;
        if (parsed.patron_name) patronHeaders['x-patron-name'] = parsed.patron_name;
      }
    } catch { }

    const res = await fetch(`${API_BASE}/articles/${id}?${qs.toString()}`, {
      credentials: 'include',
      headers: {
        'x-client-uuid': getClientUuid(),
        ...(storedTokenId ? { 'x-patron-token-id': storedTokenId } : {}),
        ...patronHeaders,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Artikel tidak ditemukan');
    }
    const data = await res.json();
    return data.article;
  },

  getDocumentStreamUrl(articleId: number, docId: number, tokenId?: string, patronNim?: string, patronName?: string): string {
    const uuid = getClientUuid();
    const storedTokenId = tokenId || localStorage.getItem('ums_patron_token_id') || '';
    const qs = new URLSearchParams();
    if (uuid) qs.append('client_uuid', uuid);
    if (storedTokenId) qs.append('token_id', storedTokenId);

    let effectiveNim = patronNim;
    let effectiveName = patronName;
    if (!effectiveNim || !effectiveName) {
      try {
        const rawSession = localStorage.getItem('ums_patron_session') || localStorage.getItem('ums_intranet_session');
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (!effectiveNim && parsed.patron_nim) effectiveNim = parsed.patron_nim;
          if (!effectiveName && parsed.patron_name) effectiveName = parsed.patron_name;
        }
      } catch { }
    }

    if (effectiveNim) qs.append('patron_nim', effectiveNim);
    if (effectiveName) qs.append('patron_name', effectiveName);

    return `${API_BASE}/articles/${articleId}/documents/${docId}/view?${qs.toString()}`;
  },

  // === Admin Authentication & Tokens ===
  async devLogin(email?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data?.token) {
      localStorage.setItem('ums_admin_token', data.token);
    }
    return data;
  },

  async getAdminMe(): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  },

  async adminLogout(): Promise<{ success: boolean; message?: string; casLogoutUrl?: string }> {
    localStorage.removeItem('ums_admin_token');
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Logout request failed:', err);
    }
    return { success: true };
  },

  async createToken(data: {
    patronName: string;
    patronNim: string;
    durationMinutes: number;
    claimWindowMinutes?: number;
    notes?: string;
  }): Promise<{ token: TokenAdminItem; qrDataUrl: string }> {
    const res = await fetch(`${API_BASE}/admin/tokens`, {
      method: 'POST',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal membuat token');
    return json;
  },

  async createBatchTokens(data: {
    items: { patronName: string; patronNim: string; notes?: string }[];
    durationMinutes: number;
    claimWindowMinutes?: number;
    defaultNotes?: string;
  }): Promise<{ success: boolean; message: string; tokens: { token: TokenAdminItem; qrDataUrl: string }[]; count: number }> {
    const res = await fetch(`${API_BASE}/admin/tokens/batch`, {
      method: 'POST',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal membuat tiket massal');
    return json;
  },

  async listTokens(filter?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    tokens: TokenAdminItem[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  }> {
    const qs = new URLSearchParams();
    if (filter?.status && filter.status !== 'ALL') qs.append('status', filter.status);
    if (filter?.search) qs.append('search', filter.search);
    if (filter?.page) qs.append('page', filter.page.toString());
    if (filter?.limit) qs.append('limit', filter.limit.toString());

    const res = await fetch(`${API_BASE}/admin/tokens?${qs.toString()}`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal memuat token');
    return json;
  },

  getTokensExportUrl(filter?: { status?: string; search?: string }): string {
    const qs = new URLSearchParams();
    if (filter?.status && filter.status !== 'ALL') qs.append('status', filter.status);
    if (filter?.search) qs.append('search', filter.search);
    return `${API_BASE}/admin/tokens/export${qs.toString() ? `?${qs.toString()}` : ''}`;
  },

  async extendToken(id: string, minutes: number): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/tokens/${id}/extend`, {
      method: 'POST',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ minutes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal memperpanjang sesi');
    }
  },

  async revokeToken(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/tokens/${id}/revoke`, {
      method: 'POST',
      headers: getAdminHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal mencabut token');
    }
  },

  async deleteToken(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/tokens/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal menghapus sesi tiket');
    }
  },

  async getAuditLogs(params?: {
    search?: string;
    nim?: string;
    action?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    logs: AuditLogItem[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  }> {
    const qs = new URLSearchParams();
    if (params?.search) qs.append('search', params.search);
    if (params?.nim) qs.append('nim', params.nim);
    if (params?.action && params.action !== 'ALL') qs.append('action', params.action);
    if (params?.page) qs.append('page', params.page.toString());
    if (params?.limit) qs.append('limit', params.limit.toString());

    const res = await fetch(`${API_BASE}/admin/audit-logs?${qs.toString()}`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal memuat audit log');
    return json;
  },

  async deleteAuditLog(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/audit-logs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal menghapus catatan log audit');
    }
  },

  async deleteBulkAuditLogs(ids: string[]): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/audit-logs`, {
      method: 'DELETE',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Gagal menghapus log audit');
    }
  },

  getAuditExportUrl(filter?: { search?: string; action?: string; nim?: string } | string): string {
    if (typeof filter === 'string') {
      const qs = filter ? `?search=${encodeURIComponent(filter)}` : '';
      return `${API_BASE}/admin/audit-logs/export${qs}`;
    }
    const qs = new URLSearchParams();
    if (filter?.search) qs.append('search', filter.search);
    if (filter?.nim) qs.append('nim', filter.nim);
    if (filter?.action && filter.action !== 'ALL') qs.append('action', filter.action);
    return `${API_BASE}/admin/audit-logs/export${qs.toString() ? `?${qs.toString()}` : ''}`;
  },

  // === User Management ===
  async listUsers(params?: {
    search?: string;
    role?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    users: UserItem[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  }> {
    const qs = new URLSearchParams();
    if (params?.search) qs.append('search', params.search);
    if (params?.role && params.role !== 'ALL') qs.append('role', params.role);
    if (params?.page) qs.append('page', params.page.toString());
    if (params?.limit) qs.append('limit', params.limit.toString());

    const res = await fetch(`${API_BASE}/admin/users?${qs.toString()}`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal memuat daftar pengguna');
    return json;
  },

  getUsersExportUrl(filter?: { search?: string; role?: string }): string {
    const qs = new URLSearchParams();
    if (filter?.search) qs.append('search', filter.search);
    if (filter?.role && filter.role !== 'ALL') qs.append('role', filter.role);
    return `${API_BASE}/admin/users/export${qs.toString() ? `?${qs.toString()}` : ''}`;
  },

  async createUser(data: { email: string; name: string; role: 'SUPER_ADMIN' | 'ADMIN' | 'USER' }): Promise<{ success: boolean; user: UserItem; message?: string }> {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal menambahkan pengguna');
    return json;
  },

  async updateUser(
    email: string,
    data: { role?: 'SUPER_ADMIN' | 'ADMIN' | 'USER'; is_active?: number; name?: string }
  ): Promise<{ success: boolean; user: UserItem; message?: string }> {
    const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal memperbarui pengguna');
    return json;
  },

  async deleteUser(email: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal menghapus pengguna');
    return json;
  },

  // === CAS SSO (auth.ums.ac.id) ===
  async getCasLoginUrl(): Promise<{ url: string; switchAccountUrl?: string }> {
    const res = await fetch(`${API_BASE}/auth/cas/login`, { credentials: 'include' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal menyiapkan sesi SSO');
    return json;
  },

  // === Analytics & Usage Reports ===
  async getAnalytics(params?: AnalyticsFilterParams): Promise<AnalyticsResponse> {
    const qs = new URLSearchParams();
    if (params) {
      if (params.periodType) qs.append('periodType', params.periodType);
      if (params.date) qs.append('date', params.date);
      if (params.month !== undefined) qs.append('month', String(params.month));
      if (params.year !== undefined) qs.append('year', String(params.year));
      if (params.startDate) qs.append('startDate', params.startDate);
      if (params.endDate) qs.append('endDate', params.endDate);
    }
    const res = await fetch(`${API_BASE}/admin/analytics?${qs.toString()}`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal memuat data analitik');
    return json;
  },

  async exportBatchTokensExcel(items: any[]): Promise<Blob> {
    const res = await fetch(`${API_BASE}/admin/tokens/export-batch`, {
      method: 'POST',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error?.message || 'Gagal mengekspor berkas Excel batch tiket');
    }
    return await res.blob();
  },

  async exportAnalyticsExcel(params?: AnalyticsFilterParams): Promise<Blob> {
    const qs = new URLSearchParams();
    if (params) {
      if (params.periodType) qs.append('periodType', params.periodType);
      if (params.date) qs.append('date', params.date);
      if (params.month !== undefined) qs.append('month', String(params.month));
      if (params.year !== undefined) qs.append('year', String(params.year));
      if (params.startDate) qs.append('startDate', params.startDate);
      if (params.endDate) qs.append('endDate', params.endDate);
    }
    const res = await fetch(`${API_BASE}/admin/analytics/export-excel?${qs.toString()}`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error?.message || 'Gagal mengekspor laporan Excel');
    }
    return await res.blob();
  },

  async exportAnalyticsCsv(params?: AnalyticsFilterParams): Promise<Blob> {
    return this.exportAnalyticsExcel(params);
  },

  // === Security Incident Telemetry & Live Alerts ===
  async reportSecurityIncident(params: {
    action: string;
    articleId?: number;
    docId?: number;
    articleTitle?: string;
  }): Promise<{ success: boolean }> {
    try {
      const storedTokenId = localStorage.getItem('ums_patron_token_id') || '';
      const res = await fetch(`${API_BASE}/patron/incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-uuid': getClientUuid(),
          ...(storedTokenId ? { 'x-patron-token-id': storedTokenId } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          ...params,
          tokenId: storedTokenId,
        }),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  async getRecentIncidents(limit = 10): Promise<{ success: boolean; items: any[] }> {
    try {
      const res = await fetch(`${API_BASE}/admin/incidents/recent?limit=${limit}`, {
        credentials: 'include',
        headers: getAdminHeaders(),
      });
      const json = await res.json();
      return json;
    } catch {
      return { success: false, items: [] };
    }
  },

  async getDatabaseStats(): Promise<{ success: boolean; stats?: DatabaseStats; error?: { message: string } }> {
    try {
      const res = await fetch(`${API_BASE}/admin/backup/stats`, {
        credentials: 'include',
        headers: getAdminHeaders(),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'Gagal memuat statistik database.' } };
    }
  },

  async downloadDatabaseBackup(): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/backup/download`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    if (!res.ok) {
      throw new Error('Gagal mengunduh file backup database');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    a.download = `unpublish_db_backup_${dateStr}.sqlite`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  async exportDatabaseJson(): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/backup/export-json`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    if (!res.ok) {
      throw new Error('Gagal mengekspor data database ke JSON');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    a.download = `unpublish_db_export_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  async optimizeDatabase(): Promise<{ success: boolean; message?: string; currentSizeFormatted?: string; error?: { message: string } }> {
    try {
      const res = await fetch(`${API_BASE}/admin/backup/optimize`, {
        method: 'POST',
        credentials: 'include',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'Gagal mengoptimasi database.' } };
    }
  },

  // === EPrints Repository DB Status (Live MySQL vs Mock) ===
  async getEPrintsDbStatus(): Promise<EPrintsDbStatus> {
    const res = await fetch(`${API_BASE}/admin/eprints-status`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal mengecek status koneksi database EPrints');
    return json;
  },

  // === Security Settings & Campus Network Status ===
  async getPatronNetworkStatus(): Promise<NetworkStatusResponse> {
    const res = await fetch(`${API_BASE}/patron/network-status`);
    if (!res.ok) {
      throw new Error('Gagal memeriksa status jaringan');
    }
    return res.json();
  },

  async getAdminSecuritySettings(): Promise<SecuritySettingsResponse> {
    const res = await fetch(`${API_BASE}/admin/settings/security`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message || 'Gagal memuat pengaturan keamanan');
    }
    return res.json();
  },

  async updateAdminSecuritySettings(
    accessMode: AccessControlMode,
    umsIpWhitelist: string[]
  ): Promise<{ success: boolean; message: string; settings: SecuritySettings }> {
    const res = await fetch(`${API_BASE}/admin/settings/security`, {
      method: 'PUT',
      credentials: 'include',
      headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ accessMode, umsIpWhitelist }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message || 'Gagal menyimpan pengaturan keamanan');
    }
    return res.json();
  },
};

export const adminApi = api;

export interface EPrintsDbStatus {
  mode: 'LIVE_MYSQL' | 'MOCK';
  connected: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  latencyMs: number;
  totalArticles: number;
  unpublishArticles: number;
  publishArticles: number;
  documentsPath: string;
  documentsPathExists: boolean;
  lastChecked: string;
  statusMessage: string;
  error?: string;
}

export interface DatabaseStats {
  databaseFile: string;
  databasePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  lastModified: string;
  created: string;
  integrity: string;
  journalMode: string;
  pageSize: number;
  pageCount: number;
  tables: {
    tokens: number;
    audit_logs: number;
    admin_users: number;
  };
  totalRecords: number;
}

export interface AnalyticsFilterParams {
  periodType?: 'daily' | 'monthly' | 'yearly' | 'custom' | 'all';
  date?: string; // YYYY-MM-DD
  month?: number; // 1-12
  year?: number; // YYYY
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface AnalyticsPeriodInfo {
  type: 'daily' | 'monthly' | 'yearly' | 'custom' | 'all';
  label: string;
  startDate: string;
  endDate: string;
  selectedDate?: string;
  selectedMonth?: number;
  selectedYear?: number;
}

export interface AnalyticsResponse {
  success: boolean;
  period: AnalyticsPeriodInfo;
  data: AnalyticsData;
}

export interface AnalyticsData {
  kpis: {
    totalTokens: number;
    activeTokens: number;
    pendingTokens: number;
    revokedTokens: number;
    totalDocumentViews: number;
    uniquePatrons: number;
    averageDurationMinutes: number;
  };
  topArticles: {
    eprint_id: number;
    article_title: string;
    view_count: number;
    unique_readers: number;
  }[];
  topPatrons: {
    patron_nim: string;
    patron_name: string;
    total_actions: number;
    document_views: number;
    tokens_used: number;
    last_activity: string;
  }[];
  facultyDistribution: {
    prefix: string;
    faculty: string;
    patron_count: number;
    activity_count: number;
  }[];
  hourlyActivity: {
    hour: string;
    label: string;
    count: number;
    view_count: number;
  }[];
  dailyTrend: {
    date: string;
    label?: string;
    total_events: number;
    document_views: number;
    active_readers: number;
  }[];
  tokenStatusBreakdown: {
    ACTIVE: number;
    PENDING: number;
    EXPIRED: number;
    REVOKED: number;
  };
}

export type AccessControlMode = 'HYBRID' | 'UMS_NETWORK_ONLY' | 'TOKEN_ONLY';

export interface SecuritySettings {
  accessMode: AccessControlMode;
  umsIpWhitelist: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface SecuritySettingsResponse {
  settings: SecuritySettings;
  currentClientIp: string;
  isCurrentClientInUmsNetwork: boolean;
}

export interface NetworkStatusResponse {
  clientIp: string;
  isUmsNetwork: boolean;
  accessMode: AccessControlMode;
  canReadDirectly: boolean;
  isTokenRequired: boolean;
  isBlocked: boolean;
  message: string;
}

// Security & Network Status APIs
export async function getPatronNetworkStatus(): Promise<NetworkStatusResponse> {
  const res = await fetch(`${API_BASE}/patron/network-status`);
  if (!res.ok) {
    throw new Error('Gagal memeriksa status jaringan');
  }
  return res.json();
}

export async function getAdminSecuritySettings(): Promise<SecuritySettingsResponse> {
  const res = await fetch(`${API_BASE}/admin/settings/security`, {
    headers: getAdminHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Gagal memuat pengaturan keamanan');
  }
  return res.json();
}

export async function updateAdminSecuritySettings(
  accessMode: AccessControlMode,
  umsIpWhitelist: string[]
): Promise<{ success: boolean; message: string; settings: SecuritySettings }> {
  const res = await fetch(`${API_BASE}/admin/settings/security`, {
    method: 'PUT',
    headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ accessMode, umsIpWhitelist }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Gagal menyimpan pengaturan keamanan');
  }
  return res.json();
}

// ==========================================
// Reading Heatmap & Duration Analytics APIs
// ==========================================
export interface HeatmapPageStat {
  pageNumber: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  viewCount: number;
  uniqueReaders: number;
  intensityScore: number; // 0 - 100%
}

export interface ReadingHeatmapData {
  eprintId: number;
  articleTitle: string;
  grandTotalSeconds: number;
  totalReadingEvents: number;
  totalUniqueReaders: number;
  maxRecordedPage: number;
  pages: HeatmapPageStat[];
  peakPages: HeatmapPageStat[];
}

export interface ReadingHeatmapSummaryItem {
  eprint_id: number;
  article_title: string;
  total_duration_seconds: number;
  unique_readers: number;
  total_events: number;
  pages_covered: number;
  last_read_at: string;
}

export interface ReadingHeatmapSummaryResponse {
  overallTotalSeconds: number;
  overallUniqueReaders: number;
  manuscripts: ReadingHeatmapSummaryItem[];
}

export async function sendReadingHeartbeat(params: {
  eprintId: number;
  articleTitle?: string;
  pageNumber: number;
  durationSeconds: number;
  patronNim?: string;
  patronName?: string;
  accessType?: 'INTRANET' | 'TOKEN';
}): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/patron/analytics/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-uuid': getClientUuid(),
      },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function getReadingHeatmap(eprintId: number): Promise<ReadingHeatmapData> {
  const res = await fetch(`${API_BASE}/admin/analytics/reading-heatmap/${eprintId}`, {
    headers: getAdminHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Gagal memuat heatmap durasi membaca naskah');
  }
  const body = await res.json();
  return body.data;
}

export async function getReadingHeatmapSummary(): Promise<ReadingHeatmapSummaryResponse> {
  const res = await fetch(`${API_BASE}/admin/analytics/reading-heatmap-summary`, {
    headers: getAdminHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Gagal memuat ringkasan durasi membaca naskah');
  }
  const body = await res.json();
  return body.data;
}
