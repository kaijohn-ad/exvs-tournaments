import { type PlatformProxy } from "wrangler";

type CloudflareContext = Omit<PlatformProxy<Env>, "dispose" | "caches" | "cf"> & {
	caches: PlatformProxy<Env>["caches"] | CacheStorage;
	cf: Request["cf"];
};

type RemixAppLoadContext = {
	cloudflare: CloudflareContext;
	db: D1Database;
};

type GetLoadContextArgs = {
	request: Request;
	context: {
		cloudflare: CloudflareContext;
	};
};

declare module "@remix-run/cloudflare" {
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface AppLoadContext extends RemixAppLoadContext {
		// This will merge the result of `getLoadContext` into the `AppLoadContext`
	}
}

export function getLoadContext({ context }: GetLoadContextArgs): RemixAppLoadContext {
	const { cloudflare } = context;

	// 開発環境ではメモリストアを使用
	const useMemoryStore = process.env.USE_MEMORY_STORE === 'true' || !cloudflare.env.DB;

	// 本番環境でのデータベース接続をログ出力
	if (process.env.NODE_ENV === 'production') {
		console.log("[load-context] Production environment detected", {
			hasDB: !!cloudflare.env.DB,
			useMemoryStore,
			envKeys: cloudflare.env ? Object.keys(cloudflare.env) : "undefined"
		});
	}

	return {
		cloudflare: {
			...cloudflare,
			env: {
				...cloudflare.env,
				USE_MEMORY_STORE: useMemoryStore ? 'true' : 'false',
			},
		},
		db: cloudflare.env.DB,
	};
}
