import type { APIContext } from 'astro';

const noCacheHeaders = {
	'Cache-Control': 'no-store',
	'Content-Type': 'application/json; charset=utf-8',
	'X-Content-Type-Options': 'nosniff',
};

const getClientIp = (request: Request): string => {
	const cfIp = request.headers.get('CF-Connecting-IP');
	if (cfIp) return cfIp;
	const xff = request.headers.get('X-Forwarded-For');
	if (!xff) return 'unknown';
	return xff.split(',')[0]?.trim() || 'unknown';
};

export async function POST({ request, url }: APIContext): Promise<Response> {
	try {
		const body = await request.text();
		console.warn('[csp-report]', {
			path: url.pathname,
			ip: getClientIp(request),
			size: body.length,
			body,
		});
	} catch {
		// ignore malformed payloads
	}

	return new Response(JSON.stringify({ ok: true }), {
		status: 202,
		headers: noCacheHeaders,
	});
}

export async function GET(): Promise<Response> {
	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: noCacheHeaders,
	});
}
