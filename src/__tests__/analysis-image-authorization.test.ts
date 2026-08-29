import { describe, expect, it } from 'vitest';
import { getOwnedImagePath } from '../../supabase/functions/analyze-style/validation';

const base = 'https://testproject.supabase.co';
const user = '11111111-1111-4111-8111-111111111111';
const path = `${user}/photo.jpg`;
const signed = `${base}/storage/v1/object/sign/analysis-images/${path}?token=example`;

describe('analysis input image authorization', () => {
  it('accepts the signed storage URL for the current user', () => {
    expect(getOwnedImagePath(signed, base, user)).toBe(path);
  });
  it('ignores signature changes when comparing the underlying path', () => {
    expect(getOwnedImagePath(signed.replace('example', 'refreshed'), base, user)).toBe(path);
  });
  it('decodes valid filenames once', () => {
    expect(getOwnedImagePath(signed.replace('photo.jpg', 'my%20photo.jpg'), base, user)).toBe(`${user}/my photo.jpg`);
  });
  it.each([
    signed.replace('testproject.supabase.co', 'testproject.attacker.example'),
    signed.replace('testproject.supabase.co', 'testproject.supabase.co.attacker.example'),
    signed.replace('https:', 'http:'),
    signed.replace('testproject.supabase.co', 'testproject.supabase.co:8443'),
    signed.replace('https://', 'https://someone:password@'),
    signed.replace('analysis-images/', 'analysis-images-copy/'),
    signed.replace(user, '22222222-2222-4222-8222-222222222222'),
    signed.replace('photo.jpg', '%2e%2e%2fother%2fphoto.jpg'),
    signed.replace('photo.jpg', '%252e%252e%252fother%252fphoto.jpg'),
    signed.replace('photo.jpg', '%5cother.jpg'),
    signed.replace('photo.jpg', '%00photo.jpg'),
    signed.replace('photo.jpg', '%broken'),
    'not a URL',
    null,
  ])('rejects unauthorized or ambiguous URLs (%#)', (url) => {
    expect(getOwnedImagePath(url, base, user)).toBeNull();
  });
});
