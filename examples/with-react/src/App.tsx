import React from 'react';
import { useAuth, useQuery } from '@platform/sdk-react';
import { usePlatformClient } from '@platform/sdk-react';

interface Product {
  id: string;
  name: string;
  price: number;
}

export function App() {
  const { session, signIn, signOut, isLoading } = useAuth();
  const client = usePlatformClient();

  const { data: products, isLoading: productsLoading } = useQuery<Product>(
    client.data('products').select('id,name,price').limit(20),
    { enabled: session !== null },
  );

  if (!session) {
    return (
      <div>
        <h1>Platform SDK — React Example</h1>
        <button
          onClick={() => signIn({ email: 'admin@example.com', password: 'your-password' })}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in…' : 'Sign In'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Platform SDK — React Example</h1>
      <p>Signed in as: {session.user?.email}</p>
      <button onClick={() => signOut()} disabled={isLoading}>
        Sign Out
      </button>

      <h2>Products</h2>
      {productsLoading ? (
        <p>Loading…</p>
      ) : (
        <ul>
          {products?.map((p) => (
            <li key={p.id}>
              {p.name} — ${p.price.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
