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
    expect(key).toMatch(/^eyJ/); // JWT tokens start with eyJ
  });

  it('should be able to create Supabase client', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const client = createClient(url, key);
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('should be able to connect to Supabase', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const client = createClient(url, key);
    
    // Test basic connectivity by checking auth state
    const { data, error } = await client.auth.getSession();
    
    // Should not throw an error (even if no session exists)
    expect(error).toBeNull();
  });
});
