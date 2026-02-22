export const getClientIp = (request: Request): string => {
	const cfIp = request.headers.get('CF-Connecting-IP');
	if (cfIp) return cfIp;
	const xff = request.headers.get('X-Forwarded-For');
	if (!xff) return 'unknown';
	return xff.split(',')[0]?.trim() || 'unknown';
};
