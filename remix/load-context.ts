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

	return {
		cloudflare,
		db: cloudflare.env.DB,
	};
}
