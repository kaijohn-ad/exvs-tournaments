import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';

const REALM = 'Boost Bracket Admin';

const unauthorized = new Response('Unauthorized', {
	status: 401,
	headers: {
		'WWW-Authenticate': `Basic realm="${REALM}"`
	}
});

const decodeBase64 = (value: string) => {
	if (typeof atob === 'function') {
		return atob(value);
	}

	if (typeof Buffer !== 'undefined') {
		return Buffer.from(value, 'base64').toString('utf8');
	}

	throw new Error('Base64 decoding is not supported in this environment.');
};

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	if (path.startsWith('/admin')) {
		const expectedUser = env.BASIC_AUTH_USER;
		const expectedPass = env.BASIC_AUTH_PASS;

		if (!expectedUser || !expectedPass) {
			return new Response('Basic authentication is not configured.', { status: 500 });
		}

		const authorization = event.request.headers.get('authorization');

		if (!authorization?.startsWith('Basic ')) {
			return unauthorized;
		}

		const decoded = decodeBase64(authorization.slice(6));
		const separatorIndex = decoded.indexOf(':');

		if (separatorIndex === -1) {
			return unauthorized;
		}

		const username = decoded.slice(0, separatorIndex);
		const password = decoded.slice(separatorIndex + 1);

		if (username !== expectedUser || password !== expectedPass) {
			return unauthorized;
		}
	}

	return resolve(event);
};
