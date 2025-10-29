import { describe, expect, test, vi } from "vitest";
import type { AppLoadContext } from "@remix-run/cloudflare";
import { loader } from "../admin.events.$eventId.stats";

const createContext = (): AppLoadContext =>
	({
		cloudflare: {
			env: {
				DB: undefined,
			},
		},
	}) as unknown as AppLoadContext;

const mockDatabase = {
	playerStats: {
		listPlayerStats: vi.fn(),
	},
	players: {
		listPlayers: vi.fn(),
	},
};

vi.mock("~/repositories/database.server", () => ({
	getDatabase: () => mockDatabase,
}));

describe("admin.events.$eventId.stats loader", () => {
	test("returns empty stats when no data exists", async () => {
		mockDatabase.playerStats.listPlayerStats.mockResolvedValue([]);
		mockDatabase.players.listPlayers.mockResolvedValue([]);

		const result = await loader({
			params: { eventId: "test-event-id" },
			context: createContext(),
			request: new Request("http://localhost"),
		});

		expect(result.status).toBe(200);
		const data = await result.json();
		expect(data.eventId).toBe("test-event-id");
		expect(data.stats).toEqual([]);
	});

	test("returns sorted stats with player names", async () => {
		const mockPlayerStats = [
			{
				player_id: "player-1",
				wins: 3,
				losses: 1,
				scope: "event",
				scope_id: "test-event-id",
			},
			{
				player_id: "player-2",
				wins: 2,
				losses: 2,
				scope: "event",
				scope_id: "test-event-id",
			},
			{
				player_id: "player-3",
				wins: 3,
				losses: 0,
				scope: "event",
				scope_id: "test-event-id",
			},
		];

		const mockPlayers = [
			{ id: "player-1", name: "Player One" },
			{ id: "player-2", name: "Player Two" },
			{ id: "player-3", name: "Player Three" },
		];

		mockDatabase.playerStats.listPlayerStats.mockResolvedValue(mockPlayerStats);
		mockDatabase.players.listPlayers.mockResolvedValue(mockPlayers);

		const result = await loader({
			params: { eventId: "test-event-id" },
			context: createContext(),
			request: new Request("http://localhost"),
		});

		expect(result.status).toBe(200);
		const data = await result.json();
		expect(data.eventId).toBe("test-event-id");
		expect(data.stats).toHaveLength(3);

		// 勝利数でソートされていることを確認（player-3が3勝0敗で1位、player-1が3勝1敗で2位）
		expect(data.stats[0].playerName).toBe("Player Three");
		expect(data.stats[0].wins).toBe(3);
		expect(data.stats[0].losses).toBe(0);
		expect(data.stats[0].totalGames).toBe(3);
		expect(data.stats[0].winRate).toBe("100.0");

		expect(data.stats[1].playerName).toBe("Player One");
		expect(data.stats[1].wins).toBe(3);
		expect(data.stats[1].losses).toBe(1);
		expect(data.stats[1].totalGames).toBe(4);
		expect(data.stats[1].winRate).toBe("75.0");

		expect(data.stats[2].playerName).toBe("Player Two");
		expect(data.stats[2].wins).toBe(2);
		expect(data.stats[2].losses).toBe(2);
		expect(data.stats[2].totalGames).toBe(4);
		expect(data.stats[2].winRate).toBe("50.0");
	});

	test("handles unknown player names", async () => {
		const mockPlayerStats = [
			{
				player_id: "unknown-player",
				wins: 1,
				losses: 1,
				scope: "event",
				scope_id: "test-event-id",
			},
		];

		mockDatabase.playerStats.listPlayerStats.mockResolvedValue(mockPlayerStats);
		mockDatabase.players.listPlayers.mockResolvedValue([]);

		const result = await loader({
			params: { eventId: "test-event-id" },
			context: createContext(),
			request: new Request("http://localhost"),
		});

		expect(result.status).toBe(200);
		const data = await result.json();
		expect(data.stats[0].playerName).toBe("(Unknown)");
	});

	test("calculates win rate correctly for zero games", async () => {
		const mockPlayerStats = [
			{
				player_id: "player-1",
				wins: 0,
				losses: 0,
				scope: "event",
				scope_id: "test-event-id",
			},
		];

		const mockPlayers = [{ id: "player-1", name: "Player One" }];

		mockDatabase.playerStats.listPlayerStats.mockResolvedValue(mockPlayerStats);
		mockDatabase.players.listPlayers.mockResolvedValue(mockPlayers);

		const result = await loader({
			params: { eventId: "test-event-id" },
			context: createContext(),
			request: new Request("http://localhost"),
		});

		expect(result.status).toBe(200);
		const data = await result.json();
		expect(data.stats[0].winRate).toBe("0.0");
	});

	test("throws error when eventId is missing", async () => {
		await expect(
			loader({
				params: {},
				context: createContext(),
				request: new Request("http://localhost"),
			}),
		).rejects.toThrow();
	});
});
