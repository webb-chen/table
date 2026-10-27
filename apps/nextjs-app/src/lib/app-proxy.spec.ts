/**
 * @vitest-environment node
 */
import { NextRequest } from 'next/server';
import { APP_ROBOTS_TAG, proxy } from './app-proxy';

const makeRequest = (url: string) => new NextRequest(url, { headers: { host: 'app.webb.sale' } });

describe('app proxy SEO isolation', () => {
  it.each([
    'https://www.webb.sale/',
    'https://www.webb.sale/auth/login',
    'https://www.webb.sale/setting/personal-access-token',
  ])('marks %s as noindex without changing routing behavior', (url) => {
    const response = proxy(makeRequest(url));

    expect(response.headers.get('X-Robots-Tag')).toBe(APP_ROBOTS_TAG);
    expect(response.headers.get('location')).toBeNull();
  });

  it('keeps the noindex header on the existing affiliate redirect response', () => {
    const response = proxy(makeRequest('https://www.webb.sale/space?via=partner&x=1'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://www.webb.sale/space?x=1');
    expect(response.headers.get('X-Robots-Tag')).toBe(APP_ROBOTS_TAG);
  });
});
