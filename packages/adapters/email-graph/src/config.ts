export interface GraphEmailConfig {
  /** Azure AD tenant ID for the Graph API authentication. */
  tenantId: string;
  /** Application (client) ID registered in Azure AD. */
  clientId: string;
  /** The 'from' address for all outbound emails (must be a valid Exchange Online mailbox). */
  fromAddress: string;
}
