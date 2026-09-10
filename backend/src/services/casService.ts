import https from 'https';
import { ENV } from '../config/env';
import { mysqlPool } from '../config/eprintsDb';

export interface CasAuthResult {
  success: boolean;
  username?: string;
  email?: string;
  name?: string;
  attributes?: Record<string, string>;
  error?: string;
}

export interface CampusUserRole {
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  eprintsUserType?: string;
  username?: string;
  email?: string;
}

export class CasService {
  /**
   * Build UMS CAS Login URL
   */
  public static getLoginUrl(customServiceUrl?: string): string {
    const serviceUrl = customServiceUrl || ENV.CAS_SERVICE_URL;
    const portStr = (ENV.CAS_PORT === 443 || ENV.CAS_PORT === 80) ? '' : `:${ENV.CAS_PORT}`;
    const protocol = ENV.CAS_PORT === 80 ? 'http' : 'https';
    return `${protocol}://${ENV.CAS_HOST}${portStr}${ENV.CAS_CONTEXT}/login?service=${encodeURIComponent(serviceUrl)}`;
  }

  /**
   * Build UMS CAS Logout URL (terminates CAS SSO TGC session)
   */
  public static getLogoutUrl(customServiceUrl?: string): string {
    const serviceUrl = customServiceUrl || `${ENV.FRONTEND_URL}/?view=admin`;
    const portStr = (ENV.CAS_PORT === 443 || ENV.CAS_PORT === 80) ? '' : `:${ENV.CAS_PORT}`;
    const protocol = ENV.CAS_PORT === 80 ? 'http' : 'https';
    return `${protocol}://${ENV.CAS_HOST}${portStr}${ENV.CAS_CONTEXT}/logout?service=${encodeURIComponent(serviceUrl)}`;
  }

  /**
   * Build UMS CAS Patron SSO Login URL
   */
  public static getPatronLoginUrl(customServiceUrl?: string): string {
    const serviceUrl = customServiceUrl || ENV.CAS_SERVICE_URL;
    const portStr = (ENV.CAS_PORT === 443 || ENV.CAS_PORT === 80) ? '' : `:${ENV.CAS_PORT}`;
    const protocol = ENV.CAS_PORT === 80 ? 'http' : 'https';
    return `${protocol}://${ENV.CAS_HOST}${portStr}${ENV.CAS_CONTEXT}/login?service=${encodeURIComponent(serviceUrl)}`;
  }

  /**
   * Build UMS CAS Patron SSO Logout URL
   */
  public static getPatronLogoutUrl(customServiceUrl?: string): string {
    const serviceUrl = customServiceUrl || `${ENV.FRONTEND_URL}/`;
    const portStr = (ENV.CAS_PORT === 443 || ENV.CAS_PORT === 80) ? '' : `:${ENV.CAS_PORT}`;
    const protocol = ENV.CAS_PORT === 80 ? 'http' : 'https';
    return `${protocol}://${ENV.CAS_HOST}${portStr}${ENV.CAS_CONTEXT}/logout?service=${encodeURIComponent(serviceUrl)}`;
  }

  /**
   * Resolve user's official full name from campus EPrints MySQL database
   */
  public static async resolveCampusName(usernameOrEmail: string): Promise<string | null> {
    const user = await CasService.resolveCampusUser(usernameOrEmail);
    return user ? user.name : null;
  }

  /**
   * Resolve user details and application role based on EPrints repository user status
   * - EPrints Repository Administrator (usertype = 'admin') -> ADMIN
   * - Specifically masharulmaali / mam708@ums.ac.id -> SUPER_ADMIN
   * - Others (editor, user, etc.) -> USER
   */
  public static async resolveCampusUser(usernameOrEmail: string): Promise<CampusUserRole | null> {
    const cleanUsername = usernameOrEmail.split('@')[0].trim().toLowerCase();
    const cleanEmail = usernameOrEmail.trim().toLowerCase();

    // 1. Check for Muhammad Asharul Ma'ali (masharulmaali / mam708)
    if (
      cleanUsername === 'masharulmaali' ||
      cleanUsername === 'mam708' ||
      cleanUsername === 'mas arul' ||
      cleanEmail === 'mam708@ums.ac.id'
    ) {
      let fullName = "Muhammad Asharul Ma'ali";
      if (mysqlPool) {
        try {
          const [rows]: any = await mysqlPool.query(
            `SELECT name_honourific, name_given, name_family, email, username, usertype 
             FROM user 
             WHERE username IN ('masharulmaali', 'mas arul', 'mam708') OR email = 'mam708@ums.ac.id' 
             ORDER BY userid DESC LIMIT 1`
          );
          if (rows && rows.length > 0) {
            const u = rows[0];
            const parts = [u.name_honourific, u.name_given, u.name_family].filter(Boolean).map((s: string) => s.trim());
            if (parts.length > 0) fullName = parts.join(' ').trim();
          }
        } catch (err) {
          console.warn('[EPrints resolve masharulmaali error]:', err);
        }
      }
      return {
        name: fullName,
        role: 'SUPER_ADMIN',
        eprintsUserType: 'admin',
        username: 'masharulmaali',
        email: 'mam708@ums.ac.id'
      };
    }

    if (!mysqlPool) return null;

    try {
      // 2. Query EPrints user table for other users
      const [rows]: any = await mysqlPool.query(
        `SELECT userid, username, usertype, name_honourific, name_given, name_family, email 
         FROM user 
         WHERE LOWER(username) = ? OR LOWER(email) = ? OR LOWER(username) = ? 
         ORDER BY (usertype = 'admin') DESC, userid DESC LIMIT 1`,
        [cleanUsername, cleanEmail, cleanEmail.split('@')[0]]
      );

      if (rows && rows.length > 0) {
        const u = rows[0];
        const parts = [u.name_honourific, u.name_given, u.name_family].filter(Boolean).map((s: string) => s.trim());
        const fullName = parts.join(' ').trim() || u.username;

        const isSuperAdmin =
          (u.username && u.username.toLowerCase() === 'masharulmaali') ||
          (u.email && u.email.toLowerCase() === 'mam708@ums.ac.id');
        const isRepoAdmin = u.usertype && u.usertype.toLowerCase() === 'admin';

        return {
          name: fullName,
          role: isSuperAdmin ? 'SUPER_ADMIN' : isRepoAdmin ? 'ADMIN' : 'USER',
          eprintsUserType: u.usertype,
          username: u.username,
          email: u.email || `${u.username}@ums.ac.id`
        };
      }
    } catch (err) {
      console.warn('[EPrints resolveCampusUser error]:', err);
    }
    return null;
  }

  /**
   * Sync Repository Administrators from live EPrints MySQL into local admin_users table
   */
  public static async syncEPrintsAdmins(): Promise<void> {
    if (!mysqlPool) return;
    try {
      const [rows]: any = await mysqlPool.query(
        `SELECT userid, username, usertype, name_honourific, name_given, name_family, email 
         FROM user 
         WHERE usertype = 'admin'`
      );

      if (!rows || rows.length === 0) return;

      const { query } = await import('../config/appDb');

      for (const u of rows) {
        const email = (u.email && u.email.trim()) ? u.email.trim().toLowerCase() : `${u.username.trim().toLowerCase()}@ums.ac.id`;
        if (!email || !email.includes('@')) continue;

        const parts = [u.name_honourific, u.name_given, u.name_family].filter(Boolean).map((s: string) => s.trim());
        const name = parts.join(' ').trim() || u.username;

        const isSuperAdmin =
          u.username.toLowerCase() === 'masharulmaali' ||
          u.username.toLowerCase() === 'mas arul' ||
          email === 'mam708@ums.ac.id';

        const assignedRole = isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN';

        const existing = await query.get('SELECT email, role FROM admin_users WHERE email = ?', [email]);
        if (!existing) {
          await query.run(
            `INSERT INTO admin_users (email, name, role, is_active) VALUES (?, ?, ?, 1)`,
            [email, name, assignedRole]
          );
        } else if (isSuperAdmin && existing.role !== 'SUPER_ADMIN') {
          await query.run(`UPDATE admin_users SET role = 'SUPER_ADMIN', name = ? WHERE email = ?`, [name, email]);
        }
      }
      console.log(`[EPrints Sync] Successfully synced ${rows.length} EPrints Repository Administrators.`);
    } catch (err) {
      console.warn('[EPrints Sync Admins error]:', err);
    }
  }

  /**
   * Validate CAS 2.0 Service Ticket (ST) against auth.ums.ac.id
   */
  public static async validateTicket(ticket: string, customServiceUrl?: string): Promise<CasAuthResult> {
    const serviceUrl = customServiceUrl || ENV.CAS_SERVICE_URL;
    const portStr = (ENV.CAS_PORT === 443 || ENV.CAS_PORT === 80) ? '' : `:${ENV.CAS_PORT}`;
    const protocol = ENV.CAS_PORT === 80 ? 'http' : 'https';
    const validateUrl = `${protocol}://${ENV.CAS_HOST}${portStr}${ENV.CAS_CONTEXT}/serviceValidate?service=${encodeURIComponent(serviceUrl)}&ticket=${encodeURIComponent(ticket)}`;

    return new Promise((resolve) => {
      const agent = new https.Agent({
        rejectUnauthorized: !ENV.CAS_DISABLE_SSL_VALIDATION,
      });

      const req = https.get(validateUrl, { agent }, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', async () => {
          try {
            console.log('=======================================================');
            console.log('[CAS serviceValidate XML Raw Response]:');
            console.log(rawData);
            console.log('=======================================================');

            const result = CasService.parseCasXml(rawData);

            // If name is not provided or is just the username/email, try resolving from campus EPrints DB
            if (result.success && result.username) {
              const isGenericName = !result.name || result.name === result.username || result.name === 'Civitas UMS';
              if (isGenericName) {
                const campusName = await CasService.resolveCampusName(result.username);
                if (campusName) {
                  result.name = campusName;
                  if (!result.attributes) result.attributes = {};
                  result.attributes['campus_fullname'] = campusName;
                }
              }
            }

            console.log('[CAS Processed Result]:', JSON.stringify(result));
            resolve(result);
          } catch (err: any) {
            resolve({ success: false, error: `Gagal memproses respon CAS: ${err.message}` });
          }
        });
      });

      req.on('error', (e) => {
        resolve({ success: false, error: `Gagal menghubungi server CAS UMS: ${e.message}` });
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ success: false, error: 'Koneksi ke server CAS UMS timeout (10 detik).' });
      });
    });
  }

  /**
   * Helper to parse CAS 2.0 XML response
   */
  private static parseCasXml(xml: string): CasAuthResult {
    // Check for authentication success
    if (xml.includes('<cas:authenticationSuccess') || xml.includes('authenticationSuccess')) {
      // Extract username from <cas:user>...</cas:user>
      const userMatch = xml.match(/<cas:user>([^<]+)<\/cas:user>/i) || xml.match(/<user>([^<]+)<\/user>/i);
      const username = userMatch ? userMatch[1].trim() : '';

      // Extract attributes from all variations:
      // 1. Tag pairs: <cas:key>value</cas:key> or <key>value</key>
      const attributes: Record<string, string> = {};
      const tagMatches = xml.matchAll(/<(?:cas:)?([a-zA-Z0-9_-]+)>([^<]+)<\/(?:cas:)?\1>/gi);
      for (const m of tagMatches) {
        const key = m[1].toLowerCase();
        if (
          key !== 'user' &&
          key !== 'authenticationsuccess' &&
          key !== 'serviceresponse' &&
          key !== 'attributes' &&
          key !== 'authenticationfailure'
        ) {
          attributes[key] = m[2].trim();
        }
      }

      // 2. Attributes style: <cas:attribute name="key" value="value"/> or <cas:attribute name="key">value</cas:attribute>
      const attrMatches = xml.matchAll(/<(?:cas:)?attribute\s+name=["']([^"']+)["'](?:\s+value=["']([^"']*)["']|>([^<]+)<\/(?:cas:)?attribute>)/gi);
      for (const m of attrMatches) {
        const key = m[1].toLowerCase();
        const val = (m[2] !== undefined ? m[2] : m[3] || '').trim();
        if (key && val) {
          attributes[key] = val;
        }
      }

      // Determine email
      let email =
        attributes['mail'] ||
        attributes['email'] ||
        attributes['userprincipalname'] ||
        attributes['edupersonprincipalname'] ||
        '';

      if (!email && username) {
        email = username.includes('@') ? username : `${username}@${ENV.ALLOWED_EMAIL_DOMAIN}`;
      }

      // Determine name (order of priority)
      const name =
        attributes['cn'] ||
        attributes['displayname'] ||
        attributes['nama'] ||
        attributes['fullname'] ||
        attributes['name'] ||
        (attributes['givenname'] && attributes['sn']
          ? `${attributes['givenname']} ${attributes['sn']}`
          : attributes['givenname'] || attributes['sn']) ||
        attributes['pegawai_nama'] ||
        attributes['mhs_nama'] ||
        username;

      return {
        success: true,
        username,
        email: email.toLowerCase(),
        name,
        attributes,
      };
    }

    // Authentication failure
    const failureMatch = xml.match(/<cas:authenticationFailure[^>]*>([^<]+)<\/cas:authenticationFailure>/i);
    const errorMsg = failureMatch ? failureMatch[1].trim() : 'Tiket SSO UMS tidak valid atau sudah kedaluwarsa.';
    return {
      success: false,
      error: errorMsg,
    };
  }
}
