import { describe, expect, test, vi } from "vitest";
import type { AppLoadContext } from "@remix-run/cloudflare";
import { getDatabase } from "../database.server";

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

const createContext = (db?: D1Database): AppLoadContext =>
	({
		cloudflare: {
			env: {
				DB: db,
			},
		},
		db,
	}) as unknown as AppLoadContext;

describe("getDatabase", () => {
	test("returns memory repositories when no D1 binding is available", async () => {
		const context = createContext();
		const database = getDatabase(context);

		const created = await database.events.createEvent({ name: "Memory Event" });
		const events = await database.events.listEvents();

		expect(created).toBeDefined();
		expect(events.find((event) => event.id === created.id)).toBeTruthy();
	});

	test("returns D1-backed repositories when binding is available", async () => {
		const d1 = createD1Stub();
		const context = createContext(d1 as unknown as D1Database);
		const database = getDatabase(context);

		await database.events.listEvents();

		expect(d1.prepare).toHaveBeenCalledTimes(1);
		expect(d1.statement.all).toHaveBeenCalledTimes(1);
	});

	test("forces memory repositories when useMemory option is set", async () => {
		const d1 = createD1Stub();
		const context = createContext(d1 as unknown as D1Database);
		const database = getDatabase(context, { useMemory: true });

		await database.events.createEvent({ name: "Forced Memory Event" });

		expect(d1.prepare).not.toHaveBeenCalled();
	});
});
