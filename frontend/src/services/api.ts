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
      }
      return { success: true, session: data.session };
    } catch (err: any) {
      return { success: false, error: 'Terjadi kesalahan jaringan.' };
    }
  },

  async getSessionStatus(): Promise<{ isActive: boolean; session?: PatronSession; reason?: string }> {
    try {
      const storedTokenId = localStorage.getItem('ums_patron_token_id') || '';
      const qs = new URLSearchParams();
      if (storedTokenId) qs.append('token_id', storedTokenId);

      const res = await fetch(`${API_BASE}/patron/session/status?${qs.toString()}`, {
        headers: {
          'x-client-uuid': getClientUuid(),
          ...(storedTokenId ? { 'x-patron-token-id': storedTokenId } : {})
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.isActive && data.session) {
        localStorage.setItem('ums_patron_session', JSON.stringify(data.session));
        localStorage.setItem('ums_patron_token_id', data.session.id);
      } else {
        localStorage.removeItem('ums_patron_session');
        localStorage.removeItem('ums_patron_token_id');
      }
      return data;
    } catch {
      return { isActive: false };
    }
  },

  async logoutPatron(): Promise<void> {
    try {
      await fetch(`${API_BASE}/patron/session/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      localStorage.removeItem('ums_patron_session');
      localStorage.removeItem('ums_patron_token_id');
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
  }): Promise<{ items: ArticleItem[]; total: number; totalPages: number }> {
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

    const res = await fetch(`${API_BASE}/articles?${qs.toString()}`, {
      credentials: 'include',
      headers: {
        'x-client-uuid': getClientUuid(),
        ...(storedTokenId ? { 'x-patron-token-id': storedTokenId } : {})
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

    const res = await fetch(`${API_BASE}/browse/${category}?${qs.toString()}`, {
      credentials: 'include',
      headers: {
        'x-client-uuid': getClientUuid(),
        ...(storedTokenId ? { 'x-patron-token-id': storedTokenId } : {})
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

    const res = await fetch(`${API_BASE}/articles/${id}?${qs.toString()}`, {
      credentials: 'include',
      headers: {
        'x-client-uuid': getClientUuid(),
        ...(storedTokenId ? { 'x-patron-token-id': storedTokenId } : {})
      },
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Artikel tidak ditemukan');
    }
    const data = await res.json();
    return data.article;
  },

  getDocumentStreamUrl(articleId: number, docId: number, tokenId?: string): string {
    const uuid = getClientUuid();
    const storedTokenId = tokenId || localStorage.getItem('ums_patron_token_id') || '';
    const qs = new URLSearchParams();
    if (uuid) qs.append('client_uuid', uuid);
    if (storedTokenId) qs.append('token_id', storedTokenId);
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

  async createUser(data: { email: string; name: string; role: 'ADMIN' | 'USER' }): Promise<{ success: boolean; user: UserItem; message?: string }> {
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
    data: { role?: 'ADMIN' | 'USER'; is_active?: number; name?: string }
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

  // === Analytics ===
  async getAnalytics(period?: string): Promise<AnalyticsData> {
    const qs = new URLSearchParams();
    if (period) qs.append('period', period);
    const res = await fetch(`${API_BASE}/admin/analytics?${qs.toString()}`, {
      credentials: 'include',
      headers: getAdminHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Gagal memuat data analitik');
    return json.data || json;
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
};

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
