import type { MiddlewareHandler } from 'astro';

const CSP_HEADER = 'Content-Security-Policy';

const generateNonce = (): string => {
	try {
		const bytes = crypto.getRandomValues(new Uint8Array(16));
		return btoa(String.fromCharCode(...bytes));
	} catch {
		return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
	}
};

export const onRequest: MiddlewareHandler = async (context, next) => {
	const nonce = generateNonce();
	context.locals.cspNonce = nonce;

	const response = await next();

	// Optionally prevent caching of HTML responses that contain nonces
	const contentType = response.headers.get('Content-Type') || '';
	if (contentType.startsWith('text/html')) {
		response.headers.set('Cache-Control', 'private, no-store');
	}

	const url = new URL(context.request.url);
	const isLocalDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

	// Baseline security headers
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set(
		'Permissions-Policy',
		["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()", "bluetooth=()"].join(
			', ',
		),
	);
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	if (!isLocalDev) {
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains; preload',
		);
	}

	const scriptSrc = isLocalDev
		? "script-src 'self' 'unsafe-inline'"
		: `script-src 'self' 'nonce-${nonce}'`;

	const styleSrc = isLocalDev
		? "style-src 'self' 'unsafe-inline'"
		: "style-src 'self'";

	const directives = [
		"default-src 'none'",
		scriptSrc,
		styleSrc,
		"img-src 'self' https: data:",
		"font-src 'self' https: data:",
		"connect-src 'self' https://api.github.com",
		"frame-ancestors 'none'",
		"base-uri 'none'",
		"form-action 'self'",
		"object-src 'none'",
	];

	// Avoid breaking local HTTP dev by upgrading.
	if (!isLocalDev) {
		directives.push('upgrade-insecure-requests');
	}

	if (!isLocalDev) {
		directives.push("trusted-types default");
		directives.push("require-trusted-types-for 'script'");
	}

	const csp = directives.join('; ');

	response.headers.set(CSP_HEADER, csp);
	return response;
};
