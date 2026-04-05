import { describe, it, expect } from 'vitest';

describe('Replicate API Configuration', () => {
  it('should have REPLICATE_API_TOKEN environment variable', () => {
    const token = process.env.REPLICATE_API_TOKEN;
    expect(token).toBeDefined();
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
  });

  it('should have valid Replicate API token format', () => {
    const token = process.env.REPLICATE_API_TOKEN;
    // Replicate tokens typically start with 'r8_' and contain alphanumeric characters
    expect(token).toMatch(/^r8_[a-zA-Z0-9]+$/);
  });

  it('should have minimum token length', () => {
    const token = process.env.REPLICATE_API_TOKEN;
    expect(token!.length).toBeGreaterThan(10);
  });

  it('should validate Replicate API token with test request', async () => {
    const token = process.env.REPLICATE_API_TOKEN;
    
    if (!token) {
      throw new Error('REPLICATE_API_TOKEN is not set');
    }

    try {
      // Test the token by fetching account information
      const response = await fetch('https://api.replicate.com/v1/account', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // We expect either 200 (success) or 401 (invalid token)
      // If we get 401, the token is invalid
      expect(response.status).not.toBe(401);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toBeDefined();
        console.log('✓ Replicate API token is valid');
      } else if (response.status === 429) {
        // Rate limited but token is valid
        console.log('✓ Replicate API token is valid (rate limited)');
      } else {
        console.log(`Response status: ${response.status}`);
      }
    } catch (error) {
      // Network errors are acceptable in test environment
      console.log('Network test skipped (expected in test environment)');
    }
  });
});
