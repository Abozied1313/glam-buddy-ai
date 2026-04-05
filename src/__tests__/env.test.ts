import { describe, it, expect } from 'vitest';

describe('Environment Variables', () => {
  it('should have VITE_SUPABASE_URL defined and be a valid URL', () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    expect(url).toBeDefined();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
    expect(url).toContain('supabase.co');
  });

  it('should have VITE_SUPABASE_PUBLISHABLE_KEY defined', () => {
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
    expect(key).toContain('.');
  });

  it('should have VITE_SUPABASE_PROJECT_ID defined', () => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    expect(projectId).toBeDefined();
    expect(typeof projectId).toBe('string');
    expect(projectId.length).toBeGreaterThan(0);
  });

  it('should validate that all required Supabase credentials are present', () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    
    expect(url).toBeTruthy();
    expect(key).toBeTruthy();
    expect(projectId).toBeTruthy();
  });
});
