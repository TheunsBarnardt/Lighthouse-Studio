import { describe, expect, it, vi } from 'vitest';

import { AzureKeyVaultSecretStore } from '../src/index.js';

// Mock the Azure SDK modules so tests run without real Key Vault credentials.
vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn().mockImplementation(() => ({})),
}));

function makeMockSecretClient(secrets: Record<string, string>) {
  return {
    listPropertiesOfSecrets: vi.fn().mockImplementation(async function* () {
      for (const name of Object.keys(secrets)) {
        yield { name };
      }
    }),
    getSecret: vi.fn().mockImplementation(async (name: string) => ({
      name,
      value: secrets[name],
    })),
  };
}

vi.mock('@azure/keyvault-secrets', () => ({
  SecretClient: vi.fn(),
}));

describe('AzureKeyVaultSecretStore — conformance', () => {
  async function makeStore(vaultSecrets: Record<string, string> = {}) {
    const { SecretClient } = await import('@azure/keyvault-secrets');
    vi.mocked(SecretClient).mockImplementation(
      () => makeMockSecretClient(vaultSecrets) as unknown as InstanceType<typeof SecretClient>,
    );
    return new AzureKeyVaultSecretStore({ vaultUri: 'https://test.vault.azure.net' });
  }

  it('get returns undefined for a missing key', async () => {
    const store = await makeStore({ 'platform-db-url': 'postgres://localhost' });
    const result = await store.get('nonexistent');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeUndefined();
  });

  it('get strips the prefix and returns the secret value', async () => {
    const store = await makeStore({ 'platform-db-url': 'postgres://localhost/test' });
    const result = await store.get('db-url');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe('postgres://localhost/test');
  });

  it('list returns all keys without the prefix', async () => {
    const store = await makeStore({
      'platform-secret-a': 'a',
      'platform-secret-b': 'b',
      'other-prefix-secret': 'ignored',
    });
    const result = await store.list();
    expect(result.isOk()).toBe(true);
    const keys = result._unsafeUnwrap();
    expect(keys).toContain('secret-a');
    expect(keys).toContain('secret-b');
    expect(keys).not.toContain('other-prefix-secret');
  });

  it('refresh re-fetches secrets from Key Vault', async () => {
    const { SecretClient } = await import('@azure/keyvault-secrets');
    const mockClient = makeMockSecretClient({ 'platform-key': 'initial' });
    vi.mocked(SecretClient).mockImplementation(
      () => mockClient as unknown as InstanceType<typeof SecretClient>,
    );
    const store = new AzureKeyVaultSecretStore({ vaultUri: 'https://test.vault.azure.net' });

    const first = await store.get('key');
    expect(first._unsafeUnwrap()).toBe('initial');

    mockClient.getSecret.mockResolvedValueOnce({ name: 'platform-key', value: 'updated' });
    await store.refresh();

    const second = await store.get('key');
    expect(second._unsafeUnwrap()).toBe('updated');
  });

  it('get returns an error when Key Vault is unreachable', async () => {
    const { SecretClient } = await import('@azure/keyvault-secrets');
    vi.mocked(SecretClient).mockImplementation(() => {
      return {
        listPropertiesOfSecrets: vi.fn().mockImplementation(async function* () {
          throw new Error('Network unreachable');
        }),
        getSecret: vi.fn(),
      } as unknown as InstanceType<typeof SecretClient>;
    });
    const store = new AzureKeyVaultSecretStore({ vaultUri: 'https://test.vault.azure.net' });
    const result = await store.get('any-key');
    expect(result.isErr()).toBe(true);
  });

  it('uses a custom prefix when configured', async () => {
    const { SecretClient } = await import('@azure/keyvault-secrets');
    vi.mocked(SecretClient).mockImplementation(
      () =>
        makeMockSecretClient({ 'myapp-secret': 'value' }) as unknown as InstanceType<
          typeof SecretClient
        >,
    );
    const store = new AzureKeyVaultSecretStore({
      vaultUri: 'https://test.vault.azure.net',
      secretPrefix: 'myapp-',
    });
    const result = await store.get('secret');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe('value');
  });
});
