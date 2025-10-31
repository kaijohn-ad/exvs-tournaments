import { type PlatformProxy } from "wrangler";
import { getStage } from "./app/utils/runtime.server";
import { logDb } from "./app/utils/logger.server";

export type CloudflareContext = Omit<PlatformProxy<Env>, "dispose" | "caches" | "cf"> & {
	caches: PlatformProxy<Env>["caches"] | CacheStorage;
	cf: Request["cf"];
};

export type RemixAppLoadContext = {
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

	// 一時的なコンテキストを作成してステージを取得
	const tempContext: RemixAppLoadContext = {
		cloudflare,
		db: cloudflare.env.DB,
	};
	const stage = getStage(tempContext);
	const hasDB = !!cloudflare.env.DB;

	// 開発環境ではメモリストアを使用
	// プレビュー環境では強制的にメモリストアを使用（USE_MEMORY_STORE=falseで明示的に無効化可能）
	// 本番環境ではD1データベースが必須
	// 明示的にUSE_MEMORY_STORE=falseが設定されている場合はそれを尊重
	const explicitMemoryStore = process.env.USE_MEMORY_STORE;
	const useMemoryStore =
		explicitMemoryStore === 'true' ||
		(explicitMemoryStore !== 'false' && stage === 'preview') ||
		!hasDB ||
		(stage === 'development' && !hasDB);

	// db.env ログを出力
	logDb("db.env", stage, {
		hasDB,
		useMemory: useMemoryStore,
	});

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
