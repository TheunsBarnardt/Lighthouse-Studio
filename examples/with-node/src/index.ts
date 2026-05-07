/**
 * Example: using @platform/sdk from Node.js
 *
 * Prerequisites:
 *   PLATFORM_URL=http://localhost:3000
 *   PLATFORM_ANON_KEY=<your-anon-key>
 */
import { createClient } from '@platform/sdk';

const client = createClient({
  url: process.env['PLATFORM_URL'] ?? 'http://localhost:3000',
  anonKey: process.env['PLATFORM_ANON_KEY'] ?? '',
});

async function main(): Promise<void> {
  // Sign in
  const { session, error } = await client.auth.signIn({
    email: 'admin@example.com',
    password: 'your-password',
  });
  if (error) throw error;
  console.log('Signed in as:', session?.user?.email);

  // Query data
  const { data: rows } = await client.data('products').select('id,name,price').limit(10);
  console.log('Products:', rows);

  // Insert a row
  const { data: inserted } = await client
    .data('products')
    .insert({ name: 'New Widget', price: 9.99 });
  console.log('Inserted:', inserted);

  // Execute raw SQL (requires query.read permission)
  const result = await client.query.execute('SELECT count(*) AS total FROM products');
  console.log('Total products:', result.rows[0]);

  await client.auth.signOut();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
