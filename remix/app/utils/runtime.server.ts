import type { AppLoadContext } from "@remix-run/cloudflare";

export type EnvironmentStage = "production" | "preview" | "development";

/**
 * 現在の環境ステージを取得する
 * 優先度: context.cloudflare.env.ENVIRONMENT_STAGE → process.env.ENVIRONMENT_STAGE → NODE_ENV ベース
 */
export function getStage(context?: AppLoadContext): EnvironmentStage {
	// Cloudflare環境変数から取得を試みる
	if (context?.cloudflare?.env?.ENVIRONMENT_STAGE) {
		const stage = context.cloudflare.env.ENVIRONMENT_STAGE as string;
		if (stage === "production" || stage === "preview") {
			return stage;
		}
	}

	// process.envから取得を試みる
	if (process.env.ENVIRONMENT_STAGE) {
		const stage = process.env.ENVIRONMENT_STAGE;
		if (stage === "production" || stage === "preview") {
			return stage;
		}
	}

	// NODE_ENVベースで判定
	if (process.env.NODE_ENV === "production") {
		return "production";
	}

	return "development";
}

/**
 * Preview環境かどうかを判定する
 */
export function isPreview(context?: AppLoadContext): boolean {
	return getStage(context) === "preview";
}

/**
 * Production環境かどうかを判定する
 */
export function isProduction(context?: AppLoadContext): boolean {
	return getStage(context) === "production";
}
