import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { AppLoadContext } from "@remix-run/cloudflare";
import { getDatabase } from "../database.server";
import { getLoadContext } from "../../../load-context";

const createD1Stub = () => {
	const statement = {
		all: vi.fn().mockResolvedValue({ results: [] as Array<Record<string, unknown>> }),
		first: vi.fn().mockResolvedValue(null),
		run: vi.fn().mockResolvedValue({ success: true, meta: { duration: 0 } }),
		bind: vi.fn(),
	};

	statement.bind.mockReturnValue(statement);

	return {
		statement,
		prepare: vi.fn().mockImplementation(() => statement),
	};
};

const createCloudflareContext = (db?: D1Database, envStage?: string) => ({
	env: {
		DB: db,
		ENVIRONMENT_STAGE: envStage,
		USE_MEMORY_STORE: undefined,
	},
});

const createContext = (db?: D1Database, envStage?: string): AppLoadContext =>
	({
		cloudflare: {
			env: {
				DB: db,
				ENVIRONMENT_STAGE: envStage,
				USE_MEMORY_STORE: undefined,
			},
		},
		db,
	}) as unknown as AppLoadContext;

describe("DB logging", () => {
	let originalConsoleInfo: typeof console.info;
	let consoleLogs: string[];

	beforeEach(() => {
		consoleLogs = [];
		originalConsoleInfo = console.info;
		console.info = vi.fn((...args: unknown[]) => {
			consoleLogs.push(args.map((arg) => String(arg)).join(" "));
		});
	});

	afterEach(() => {
		console.info = originalConsoleInfo;
	});

	describe("getLoadContext", () => {
		test("outputs db.env log in preview environment with DB", () => {
			const d1 = createD1Stub();
			const cloudflareContext = createCloudflareContext(
				d1 as unknown as D1Database,
				"preview"
			);

			getLoadContext({
				request: new Request("http://localhost"),
				context: {
					cloudflare: cloudflareContext as any,
				},
			});

			const dbEnvLog = consoleLogs.find((log) => log.includes('"event":"db.env"'));
			expect(dbEnvLog).toBeDefined();

			if (dbEnvLog) {
				const parsed = JSON.parse(dbEnvLog);
				expect(parsed.event).toBe("db.env");
				expect(parsed.stage).toBe("preview");
				expect(parsed.hasDB).toBe(true);
				expect(parsed.useMemory).toBe(false);
			}
		});

		test("outputs db.env log in production environment without DB", () => {
			const cloudflareContext = createCloudflareContext(undefined, "production");

			// Production環境でDBがない場合は例外が投げられる前にログが出力される
			expect(() => {
				getLoadContext({
					request: new Request("http://localhost"),
					context: {
						cloudflare: cloudflareContext as any,
					},
				});
			}).not.toThrow();

			const dbEnvLog = consoleLogs.find((log) => log.includes('"event":"db.env"'));
			expect(dbEnvLog).toBeDefined();

			if (dbEnvLog) {
				const parsed = JSON.parse(dbEnvLog);
				expect(parsed.event).toBe("db.env");
				expect(parsed.stage).toBe("production");
				expect(parsed.hasDB).toBe(false);
			}
		});
	});

	describe("getDatabase", () => {
		test("outputs db.selected log with d1 driver in preview environment", () => {
			const d1 = createD1Stub();
			const context = createContext(d1 as unknown as D1Database, "preview");

			// NODE_ENVをdevelopment以外に設定
			const originalNodeEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			getDatabase(context);

			process.env.NODE_ENV = originalNodeEnv;

			const dbSelectedLog = consoleLogs.find((log) => log.includes('"event":"db.selected"'));
			expect(dbSelectedLog).toBeDefined();

			if (dbSelectedLog) {
				const parsed = JSON.parse(dbSelectedLog);
				expect(parsed.event).toBe("db.selected");
				expect(parsed.stage).toBe("preview");
				expect(parsed.driver).toBe("d1");
				expect(parsed.fallback).toBe(false);
				expect(parsed.hasDB).toBe(true);
				expect(parsed.useMemory).toBe(false);
			}
		});

		test("outputs db.selected log with memory driver when useMemory is true", () => {
			const d1 = createD1Stub();
			const context = createContext(d1 as unknown as D1Database, "preview");

			getDatabase(context, { useMemory: true });

			const dbSelectedLog = consoleLogs.find((log) => log.includes('"event":"db.selected"'));
			expect(dbSelectedLog).toBeDefined();

			if (dbSelectedLog) {
				const parsed = JSON.parse(dbSelectedLog);
				expect(parsed.event).toBe("db.selected");
				expect(parsed.driver).toBe("memory");
				expect(parsed.useMemory).toBe(true);
			}
		});

		test("outputs db.selected log with fallback=true when DB is unavailable in non-production", () => {
			const context = createContext(undefined, "preview");

			// ENVIRONMENT_STAGE=previewが設定されているため、NODE_ENVは無視される
			// テストのためにNODE_ENVをdevelopment以外に設定
			const originalNodeEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			// ただし、stage=previewなのでエラーは発生しない
			getDatabase(context);

			process.env.NODE_ENV = originalNodeEnv;

			const dbSelectedLog = consoleLogs.find((log) => log.includes('"event":"db.selected"'));
			expect(dbSelectedLog).toBeDefined();

			if (dbSelectedLog) {
				const parsed = JSON.parse(dbSelectedLog);
				expect(parsed.event).toBe("db.selected");
				expect(parsed.driver).toBe("memory");
				expect(parsed.fallback).toBe(true);
				expect(parsed.hasDB).toBe(false);
				expect(parsed.useMemory).toBe(true);
			}
		});

		test("logs do not contain PII (no SQL or bindings)", () => {
			const d1 = createD1Stub();
			const context = createContext(d1 as unknown as D1Database, "preview");

			const originalNodeEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			getDatabase(context);

			process.env.NODE_ENV = originalNodeEnv;

			const allLogs = consoleLogs.join(" ");
			// SQL関連のキーワードが含まれていないことを確認（単語境界を使用）
			expect(allLogs).not.toMatch(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);
			expect(allLogs).not.toMatch(/\bbind\b|\bbinding\b/i);
			expect(allLogs).not.toMatch(/\bsql\b|\bquery\b/i);

			// ログがJSON形式であることを確認
			const dbSelectedLog = consoleLogs.find((log) => log.includes('"event":"db.selected"'));
			if (dbSelectedLog) {
				expect(() => JSON.parse(dbSelectedLog)).not.toThrow();
			}
		});
	});
});
