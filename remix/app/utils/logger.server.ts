import type { EnvironmentStage } from "./runtime.server";

export type DbLogEvent = "db.env" | "db.selected";

export type DbLogDetails = {
	driver?: "memory" | "d1";
	fallback?: boolean;
	hasDB?: boolean;
	useMemory?: boolean;
};

/**
 * DB接続関連のログを出力する
 * JSON一行形式で出力し、PII（個人情報）を含まない
 */
export function logDb(
	event: DbLogEvent,
	stage: EnvironmentStage,
	details: DbLogDetails = {}
): void {
	const logEntry = {
		event,
		stage,
		...details,
	};

	console.info(JSON.stringify(logEntry));
}
