import type { APIContext } from 'astro';

const GITHUB_API_URL =
	'https://api.github.com/users/n0-tone/repos?per_page=100&sort=updated';
const EDGE_TTL_SECONDS = 900; // 15 minutes at the edge
const BROWSER_TTL_SECONDS = 300; // 5 minutes in the browser
const CACHED_AT_HEADER = 'x-no-tone-cached-at';

interface GithubRepo {
	name?: string;
	html_url?: string;
	homepage?: string | null;
	language?: string | null;
	description?: string | null;
	topics?: string[];
	fork?: boolean;
	archived?: boolean;
	has_pages?: boolean;
	stargazers_count?: number;
	updated_at?: string;
	[other: string]: unknown;
}

interface SimplifiedRepo {
	name: string;
	url: string;
	homepage: string;
	language: string;
	description: string;
	topics: string[];
	isFork: boolean;
	isArchived: boolean;
	hasPages: boolean;
	stars: number;
	updatedAt: string;
}

const simplifyRepos = (repos: unknown): SimplifiedRepo[] => {
	if (!Array.isArray(repos)) return [];
	return repos
		.filter((repo): repo is GithubRepo => !!repo && typeof repo === 'object')
		.filter((repo) => repo.name && repo.html_url)
		.map((repo) => ({
			name: String(repo.name),
			url: String(repo.html_url),
			homepage: repo.homepage ? String(repo.homepage) : '',
			language: repo.language ? String(repo.language) : 'Other',
			description: repo.description ? String(repo.description) : '',
			topics: Array.isArray(repo.topics) ? repo.topics : [],
			isFork: !!repo.fork,
			isArchived: !!repo.archived,
			hasPages: !!repo.has_pages,
			stars:
				typeof repo.stargazers_count === 'number' ? repo.stargazers_count : 0,
			updatedAt: repo.updated_at ? String(repo.updated_at) : '',
		}));
};

const buildHeaders = (origin: string | null) => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}`,
		'X-Content-Type-Options': 'nosniff',
	};

	// Only allow JS running on your own origin to read this response
	if (origin) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Vary'] = 'Origin';
	}

	return headers;
};

const readCachedAtMs = (res: Response): number => {
	const raw = res.headers.get(CACHED_AT_HEADER);
	if (!raw) return 0;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : 0;
};

const isFresh = (cachedAtMs: number, nowMs: number): boolean => {
	if (!cachedAtMs) return false;
	return nowMs - cachedAtMs < EDGE_TTL_SECONDS * 1000;
};

const responseFromCached = (cached: Response, origin: string | null): Response => {
	const etag = cached.headers.get('ETag');
	const headers = buildHeaders(origin);
	if (etag) headers['ETag'] = etag;
	return new Response(cached.body, { status: 200, headers });
};

const toCachedResponse = (body: string, etag: string | null): Response => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		[CACHED_AT_HEADER]: String(Date.now()),
	};
	if (etag) headers['ETag'] = etag;
	return new Response(body, { status: 200, headers });
};

export async function GET(context: APIContext): Promise<Response> {
	const request = context.request;
	const siteOrigin = context.url.origin;
	const origin = request.headers.get('Origin');

	// Basic origin check: allow same-origin requests and non-CORS requests (like server-to-server or direct curl)
	if (origin && origin !== siteOrigin) {
		return new Response(JSON.stringify({ error: 'Forbidden' }), {
			status: 403,
			headers: buildHeaders(null),
		});
	}

	const cache = (globalThis as any).caches?.default as Cache | undefined;
	const cacheKey = new Request(GITHUB_API_URL);
	const nowMs = Date.now();
	let cached: Response | undefined;
	const waitUntil = (context.locals as any)?.runtime?.ctx?.waitUntil as
		| ((promise: Promise<unknown>) => void)
		| undefined;

	// Try edge cache first
	if (cache) {
		cached = (await cache.match(cacheKey)) ?? undefined;
		if (cached && isFresh(readCachedAtMs(cached), nowMs)) {
			return responseFromCached(cached, origin ?? null);
		}
		if (cached) {
			const cachedRes = cached;
			const cachedEtag = cached.headers.get('ETag');
			const revalidate = async () => {
				try {
					const upstream = await fetch(GITHUB_API_URL, {
						headers: {
							'User-Agent': 'no-tone-site',
							'Accept': 'application/vnd.github.mercy-preview+json',
							...(cachedEtag ? { 'If-None-Match': cachedEtag } : {}),
						},
					});

					if (upstream.status === 304) {
						const body = await cachedRes.clone().text();
						await cache.put(cacheKey, toCachedResponse(body, cachedEtag ?? null));
						return;
					}

					if (!upstream.ok) return;

					const raw = await upstream.json();
					const simplified = simplifyRepos(raw);
					const body = JSON.stringify(simplified);
					const etag = upstream.headers.get('ETag');
					await cache.put(cacheKey, toCachedResponse(body, etag));
				} catch {
					// ignore revalidation errors
				}
			};

			// Stale-while-revalidate: serve cached immediately and refresh in background
			if (waitUntil) waitUntil(revalidate());
			return responseFromCached(cached, origin ?? null);
		}
	}

	// Fetch from GitHub (optionally revalidate with ETag)
	const cachedEtag = cached?.headers.get('ETag');
	const upstream = await fetch(GITHUB_API_URL, {
		headers: {
			// GitHub requires a User-Agent
			'User-Agent': 'no-tone-site',
			'Accept': 'application/vnd.github.mercy-preview+json', // Needed for topics
			...(cachedEtag ? { 'If-None-Match': cachedEtag } : {}),
		},
	});

	if (upstream.status === 304 && cached) {
		// Not modified: reuse cached body but bump cached timestamp
		const body = await cached.clone().text();
		const newCached = toCachedResponse(body, cachedEtag ?? null);
		if (cache) {
			try {
				await cache.put(cacheKey, newCached.clone());
			} catch {
				// ignore cache errors
			}
		}
		return new Response(body, { status: 200, headers: buildHeaders(origin ?? null) });
	}

	if (!upstream.ok) {
		// If we have anything cached (even stale), serve it.
		if (cached) return responseFromCached(cached, origin ?? null);
		return new Response(JSON.stringify([]), {
			status: 200,
			headers: buildHeaders(origin ?? null),
		});
	}

	const raw = await upstream.json();
	const simplified = simplifyRepos(raw);
	const body = JSON.stringify(simplified);

	// Store in edge cache for subsequent requests (store ETag + cached-at)
	const etag = upstream.headers.get('ETag');
	if (cache) {
		try {
			await cache.put(cacheKey, toCachedResponse(body, etag).clone());
		} catch {
			// ignore cache errors
		}
	}

	return new Response(body, { status: 200, headers: buildHeaders(origin ?? null) });
}
