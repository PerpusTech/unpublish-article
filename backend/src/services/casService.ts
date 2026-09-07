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
   * Resolve user's official full name from campus EPrints MySQL database
   */
  public static async resolveCampusName(usernameOrEmail: string): Promise<string | null> {
    if (!mysqlPool) return null;
    try {
      const cleanUsername = usernameOrEmail.split('@')[0].trim();
      const [rows]: any = await mysqlPool.query(
        'SELECT name_honourific, name_given, name_family FROM user WHERE username = ? OR email = ? ORDER BY userid DESC LIMIT 1',
        [cleanUsername, usernameOrEmail]
      );
      if (rows && rows.length > 0) {
        const u = rows[0];
        const parts = [u.name_honourific, u.name_given, u.name_family].filter(Boolean).map((s: string) => s.trim());
        const fullName = parts.join(' ').trim();
        if (fullName) return fullName;
      }
    } catch (err) {
      console.warn('[EPrints user name lookup error]:', err);
    }
    return null;
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
