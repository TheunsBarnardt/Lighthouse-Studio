declare module 'node-saml' {
  export interface SamlConfig {
    callbackUrl: string;
    /** SP entity ID */
    issuer: string;
    /** IDP SSO URL */
    entryPoint: string;
    /** IDP signing certificate(s). Pass raw base64 or full PEM. */
    cert?: string | string[];
    /** SP private key (PEM) for signing AuthnRequests */
    privateCert?: string;
    /** SP private key (PEM) for decrypting assertions */
    decryptionPvk?: string;
    signatureAlgorithm?: 'sha256' | 'sha512';
    digestAlgorithm?: 'sha256' | 'sha512';
    disableRequestedAuthnContext?: boolean;
    identifierFormat?: string;
    validateInResponseTo?: boolean;
    acceptedClockSkewMs?: number;
    idpIssuer?: string;
    audience?: string | false;
  }

  export interface SamlProfile {
    nameID: string;
    nameIDFormat?: string;
    nameQualifier?: string;
    spNameQualifier?: string;
    email?: string;
    mail?: string;
    displayName?: string;
    issuer?: string;
    inResponseTo?: string;
    sessionIndex?: string;
    [key: string]: unknown;
  }

  export class SAML {
    constructor(options: SamlConfig);

    /**
     * Generate the HTTP-Redirect binding authorization URL.
     * Returns a URL string with SAMLRequest query parameter.
     */
    getAuthorizeUrl(options?: {
      RelayState?: string;
      additionalParams?: Record<string, string>;
    }): Promise<string>;

    /**
     * Validate an HTTP-POST binding SAMLResponse.
     * Returns { profile, success: false } for a successful login assertion.
     * Returns { profile: null, success: true } for a successful logout response.
     * Throws on validation failure.
     */
    validatePostResponse(body: {
      SAMLResponse: string;
      RelayState?: string;
      [key: string]: string | undefined;
    }): Promise<{ profile: SamlProfile | null; success: boolean }>;

    /** Generate SP metadata XML. */
    generateServiceProviderMetadata(
      decryptionCert: string | null,
      signingCert: string | null,
    ): string;
  }
}
