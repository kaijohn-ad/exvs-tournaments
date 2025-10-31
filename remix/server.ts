import { createRequestHandler, type ServerBuild } from "@remix-run/cloudflare";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore This file won't exist if it hasn't yet been built
import * as build from "./build/server"; // eslint-disable-line import/no-unresolved
import { getLoadContext } from "./load-context";

// 開発環境でcryptoを利用可能にする
if (process.env.NODE_ENV === 'development') {
	try {
		const { webcrypto } = require("node:crypto");
		if (!globalThis.crypto) {
			globalThis.crypto = webcrypto as unknown as Crypto;
		}
	} catch (error) {
		// cryptoが利用できない場合は無視
		console.warn("Failed to setup crypto for development:", error);
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleRemixRequest = createRequestHandler(build as any as ServerBuild);

/**
 * `/admin` 配下へのアクセスに対してBasic認証を要求する
 * 環境変数が未設定の場合は認証をスキップ（本番環境のみ設定して有効化）
 * @param request リクエストオブジェクト
 * @param env 環境変数オブジェクト
 * @returns 認証が必要な場合は401レスポンス、それ以外はnull
 */
export function requireBasicAuthOnAdmin(request: Request, env: Env): Response | null {
	const { BASIC_AUTH_USER, BASIC_AUTH_PASSWORD } = env;
	// 環境変数が未設定の場合は認証をスキップ（本番環境のみ設定して有効化）
	if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
		return null;
	}

	const { pathname } = new URL(request.url);
	// `/admin` 配下のパスかどうかを判定
	const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
	if (!isAdminPath) {
		return null;
	}

	const header = request.headers.get('authorization') ?? '';
	const [scheme, encoded] = header.split(' ');

	// Authorizationヘッダが正しい形式でない場合は401を返す
	if (scheme?.toLowerCase() !== 'basic' || !encoded) {
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"',
			},
		});
	}

	// Base64デコードしてユーザー名とパスワードを取得
	let decoded = '';
	try {
		decoded = atob(encoded);
	} catch {
		// Base64デコードに失敗した場合は401を返す
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"',
			},
		});
	}

	const idx = decoded.indexOf(':');
	if (idx === -1) {
		// コロンが見つからない場合は401を返す
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"',
			},
		});
	}

	const user = decoded.slice(0, idx);
	const pass = decoded.slice(idx + 1);

	// ユーザー名とパスワードが一致しない場合は401を返す
	if (user !== BASIC_AUTH_USER || pass !== BASIC_AUTH_PASSWORD) {
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"',
			},
		});
	}

	// 認証成功
	return null;
}

export default {
	async fetch(request, env, ctx) {
		try {
			// `/admin` 配下へのアクセスに対してBasic認証をチェック
			const unauthorized = requireBasicAuthOnAdmin(request, env);
			if (unauthorized) {
				return unauthorized;
			}

			const loadContext = getLoadContext({
				request,
				context: {
					cloudflare: {
						// This object matches the return value from Wrangler's
						// `getPlatformProxy` used during development via Remix's
						// `cloudflareDevProxyVitePlugin`:
						// https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy
						cf: request.cf,
						ctx,
						caches,
						env,
					},
				},
			});
			return await handleRemixRequest(request, loadContext);
		} catch (error) {
			// ログに詳細なエラー情報を出力
			console.error("[server] Unexpected error:", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				url: request.url,
				method: request.method,
			});
			// createRequestHandlerは既にエラーハンドリングを行っているため、
			// 通常はここに到達しない。getLoadContextでのエラーなど、
			// createRequestHandlerの外で発生したエラーのみここでキャッチされる。
			// エラーを再スローしてRemixのエラーハンドリングに委譲
			throw error;
		}
	},
} satisfies ExportedHandler<Env>;
