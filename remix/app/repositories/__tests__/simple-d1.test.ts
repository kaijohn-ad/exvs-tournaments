import { describe, expect, test } from "vitest";
import { generateUUID } from "~/utils/uuid";
import { getDatabase } from "../database.server";
import type { AppLoadContext } from "@remix-run/cloudflare";
import type { CloudflareContext } from "../../../load-context";

// 簡単なモックD1データベース
const createSimpleMockDb = () => {
	const data = new Map<string, any[]>();
	
	return {
		prepare: (sql: string) => {
			const statement = {
				all: async () => {
					const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
					if (!tableName) return { results: [] };
					
					const tableData = data.get(tableName) || [];
					return { results: tableData };
				},
				first: async () => {
					const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
					if (!tableName) return null;
					
					const tableData = data.get(tableName) || [];
					return tableData.length > 0 ? tableData[0] : null;
				},
				bind: (...params: any[]) => ({
					all: async () => {
						const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
						if (!tableName) return { results: [] };
						
						const tableData = data.get(tableName) || [];
						return { results: tableData };
					},
					first: async () => {
						const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
						if (!tableName) return null;
						
						const tableData = data.get(tableName) || [];
						return tableData.length > 0 ? tableData[0] : null;
					},
					run: async () => {
						const tableName = sql.match(/INSERT\s+INTO\s+(\w+)/i)?.[1];
						if (tableName) {
							const now = new Date().toISOString();
							const recordId = (params[0] as string | undefined) || generateUUID();
							let record: any = { id: recordId, created_at: now };
							
							if (tableName === 'events') {
								record = {
									id: recordId,
									name: params[1] ?? '',
									slug: params[2] ?? null,
									created_at: params[3] ?? now
								};
							} else if (tableName === 'players') {
								record = {
									id: recordId,
									event_id: params[1] ?? '',
									name: params[2] ?? '',
									note: params[3] ?? null,
									created_at: params[4] ?? now
								};
							}
							
							if (!data.has(tableName)) {
								data.set(tableName, []);
							}
							data.get(tableName)!.push(record);
							
							// 作成されたレコードのIDを返す
							return { success: true, meta: { duration: 0, changes: 1, last_row_id: record.id } };
						}
						
						return { success: true, meta: { duration: 0 } };
					}
				})
			};
			return statement;
		}
	};
};

const createAppContext = (db?: D1Database): AppLoadContext => {
	const cloudflare: CloudflareContext = {
		env: {
			DB: (db ?? (undefined as unknown as D1Database)),
		} as Env,
		ctx: {
			waitUntil: () => {},
			passThroughOnException: () => {},
			props: {},
		},
		caches: (globalThis as unknown as { caches?: CacheStorage }).caches || ({} as CacheStorage),
		cf: {} as Request["cf"],
	};

	return {
		cloudflare,
		db,
	} as AppLoadContext;
};

describe("Simple D1 Integration Tests", () => {
	test("should create and list events with memory database", async () => {
		// メモリデータベースを使用
	const context = createAppContext();

		const database = getDatabase(context);

		// イベントを作成
		const event = await database.events.createEvent({
			name: "Test Event",
			slug: "test-event"
		});

		expect(event).toBeDefined();
		expect(event.name).toBe("Test Event");
		expect(event.slug).toBe("test-event");
		expect(event.id).toBeDefined();
		expect(event.createdAt).toBeDefined();

		// イベント一覧を取得
		const events = await database.events.listEvents();
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(event.id);
		expect(events[0].name).toBe("Test Event");
	});

	test("should create and list players with memory database", async () => {
		// メモリデータベースを使用
	const context = createAppContext();

		const database = getDatabase(context);

		// イベントを作成
		const event = await database.events.createEvent({
			name: "Test Event",
			slug: "test-event"
		});

		// プレイヤーを作成
		const player = await database.players.createPlayer(event.id, {
			name: "Test Player",
			note: "Test note"
		});

		expect(player).toBeDefined();
		expect(player.name).toBe("Test Player");
		expect(player.note).toBe("Test note");
		expect(player.id).toBeDefined();

		// プレイヤー一覧を取得
		const players = await database.players.listPlayers(event.id);
		expect(players).toHaveLength(1);
		expect(players[0].id).toBe(player.id);
		expect(players[0].name).toBe("Test Player");
	});

	test("should handle database factory with D1 binding", async () => {
		// D1バインディングありのコンテキスト
	const mockDb = createSimpleMockDb();
	const context = createAppContext(mockDb as unknown as D1Database);

		const database = getDatabase(context);

		// イベントを作成
		const event = await database.events.createEvent({
			name: "D1 Test Event",
			slug: "d1-test-event"
		});

		expect(event).toBeDefined();
		expect(event.name).toBe("D1 Test Event");
		expect(event.slug).toBe("d1-test-event");
		expect(event.id).toBeDefined();
		expect(event.createdAt).toBeDefined();

		// イベント一覧を取得
		const events = await database.events.listEvents();
		expect(events).toHaveLength(1);
		expect(events[0].name).toBe("D1 Test Event");
		expect(events[0].slug).toBe("d1-test-event");
		expect(events[0].id).toBeDefined();
	});

	test("should force memory database when useMemory option is set", async () => {
		// D1バインディングありだが、useMemoryオプションで強制的にメモリを使用
	const mockDb = createSimpleMockDb();
	const context = createAppContext(mockDb as unknown as D1Database);

		const database = getDatabase(context, { useMemory: true });

		// イベントを作成
		const event = await database.events.createEvent({
			name: "Memory Test Event",
			slug: "memory-test-event"
		});

		expect(event).toBeDefined();
		expect(event.name).toBe("Memory Test Event");
		expect(event.slug).toBe("memory-test-event");
		expect(event.id).toBeDefined();
		expect(event.createdAt).toBeDefined();

		// イベント一覧を取得
		const events = await database.events.listEvents();
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(event.id);
		expect(events[0].name).toBe("Memory Test Event");
	});
});
