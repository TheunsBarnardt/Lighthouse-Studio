export interface WindowsIntegratedConfig {
  /** HTTP header from which to read the authenticated Windows user principal (e.g. DOMAIN\user). */
  principalHeader: string;
  /** IP addresses of trusted upstream IIS servers. Requests from other IPs are rejected. */
  trustedProxyIps: string[];
  /** Optional header to fall back to if principalHeader is absent. */
  fallbackHeader?: string;
}
