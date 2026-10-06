export const prerender = false;

import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  const country = cf?.country || request.headers.get('cf-ipcountry') || '';

  return new Response(JSON.stringify({ country }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
