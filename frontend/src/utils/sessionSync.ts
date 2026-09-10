import { PatronSession } from '../services/api';

const BROADCAST_CHANNEL_NAME = 'ums_patron_session_channel';
export const STORAGE_LOGOUT_KEY = 'ums_patron_logout_event';
export const STORAGE_SESSION_KEY = 'ums_patron_session';
export const STORAGE_INTRANET_KEY = 'ums_intranet_session';
export const STORAGE_TOKEN_ID_KEY = 'ums_patron_token_id';

export interface SessionSyncMessage {
  type: 'PATRON_LOGOUT' | 'PATRON_LOGIN' | 'PATRON_SESSION_EXPIRED';
  timestamp: number;
  reason?: string;
  session?: PatronSession;
}

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  broadcastChannel = null;
}

/**
 * Broadcasts a logout/session termination event to all other open tabs.
 */
export function broadcastLogout(reason: string = 'USER_LOGOUT'): void {
  const timestamp = Date.now();
  const payload: SessionSyncMessage = {
    type: 'PATRON_LOGOUT',
    timestamp,
    reason,
  };

  // 1. BroadcastChannel (Zero-latency instant cross-tab sync)
  try {
    broadcastChannel?.postMessage(payload);
  } catch {}

  // 2. Storage Event trigger (Native fallback for all browsers)
  try {
    localStorage.setItem(STORAGE_LOGOUT_KEY, JSON.stringify(payload));
  } catch {}
}

/**
 * Broadcasts a login/session claim event to all other open tabs.
 */
export function broadcastLogin(session: PatronSession): void {
  const timestamp = Date.now();
  const payload: SessionSyncMessage = {
    type: 'PATRON_LOGIN',
    timestamp,
    session,
  };

  try {
    broadcastChannel?.postMessage(payload);
  } catch {}

  try {
    localStorage.setItem('ums_patron_login_event', JSON.stringify(payload));
  } catch {}
}

/**
 * Subscribes to cross-tab session synchronization events.
 * Triggered whenever a session is terminated, expired, or claimed in ANY tab.
 */
export function subscribeSessionSync(callbacks: {
  onLogout: (reason?: string) => void;
  onLogin?: (session: PatronSession) => void;
}): () => void {
  const { onLogout, onLogin } = callbacks;

  // Handler for Storage Event (Cross-Tab Native)
  const handleStorage = (e: StorageEvent) => {
    // A) Explicit logout signal was set
    if (e.key === STORAGE_LOGOUT_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        onLogout(data.reason || 'USER_LOGOUT');
      } catch {
        onLogout('USER_LOGOUT');
      }
      return;
    }

    // B) Session was removed from localStorage in another tab
    if ((e.key === STORAGE_SESSION_KEY || e.key === STORAGE_INTRANET_KEY) && !e.newValue) {
      onLogout('SESSION_REMOVED');
      return;
    }

    // C) Session was claimed / updated in another tab
    if (e.key === STORAGE_SESSION_KEY && e.newValue && onLogin) {
      try {
        const sessionData = JSON.parse(e.newValue);
        if (sessionData?.id) {
          onLogin(sessionData);
        }
      } catch {}
    }
  };

  // Handler for BroadcastChannel Message (Instant)
  const handleBroadcast = (event: MessageEvent<SessionSyncMessage>) => {
    const data = event.data;
    if (!data) return;

    if (data.type === 'PATRON_LOGOUT' || data.type === 'PATRON_SESSION_EXPIRED') {
      onLogout(data.reason || 'USER_LOGOUT');
    } else if (data.type === 'PATRON_LOGIN' && data.session && onLogin) {
      onLogin(data.session);
    }
  };

  window.addEventListener('storage', handleStorage);
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
  };
}
