import { createRequestHandler, type ServerBuild } from "@remix-run/cloudflare";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore This file won't exist if it hasn't yet been built
import * as build from "./build/server"; // eslint-disable-line import/no-unresolved
import { getLoadContext } from "./load-context";
import { requireBasicAuthOnAdmin } from "./app/utils/basic-auth.server";

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
