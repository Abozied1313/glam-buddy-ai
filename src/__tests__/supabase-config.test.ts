import { describe, it, expect } from 'vitest';

describe('Supabase Configuration', () => {
  it('should have valid VITE_SUPABASE_URL', () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    expect(url).toBeDefined();
    expect(url).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
  });

  it('should have valid VITE_SUPABASE_PUBLISHABLE_KEY', () => {
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    expect(key).toBeDefined();
    expect(key.length).toBeGreaterThan(0);
    expect(key).toMatch(/^(?:eyJ|sb_publishable_)/);
  });

  it('should be able to create Supabase client', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const client = createClient(url, key);
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('can read an empty local session without a network request', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const client = createClient(url, key);
    
    // This checks local auth initialization, not live Supabase connectivity.
    const { data, error } = await client.auth.getSession();
    
    // Should not throw an error (even if no session exists)
    expect(error).toBeNull();
    expect(data.session).toBeNull();
  });
});
