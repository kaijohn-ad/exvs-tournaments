import { describe, expect, test, vi } from "vitest";
import type { AppLoadContext } from "@remix-run/cloudflare";
import { loader } from "../admin.events.$eventId.tournaments.$tournamentId.bracket";

const createContext = (): AppLoadContext =>
	({
		cloudflare: {
			env: {
				DB: undefined,
			},
		},
	}) as unknown as AppLoadContext;

const mockDatabase = {
	tournaments: {
		ensureTournament: vi.fn(),
	},
	pairs: {
		listPairs: vi.fn(),
	},
	players: {
		listPlayers: vi.fn(),
	},
	bracketMatches: {
		listBracketMatches: vi.fn(),
	},
	ffaGroups: {
		listFfaGroups: vi.fn(),
	},
};

vi.mock("~/repositories/database.server", () => ({
	getDatabase: () => mockDatabase,
}));

describe("admin.events.$eventId.tournaments.$tournamentId.bracket loader", () => {
	test("returns bracket data for single-elimination tournament", async () => {
		const mockTournament = {
			id: "tournament-1",
			eventId: "event-1",
			name: "Test Tournament",
			format: "single-elimination" as const,
			seedingMode: "random" as const,
			entryMode: "pair" as const,
			createdAt: new Date().toISOString(),
		};

		const mockPairs = [
			{ id: "pair-1", event_id: "event-1", player1_id: "player-1", player2_id: "player-2", seed: null, created_at: new Date().toISOString() },
		];

		const mockPlayers = [
			{ id: "player-1", event_id: "event-1", name: "Player 1", note: null, created_at: new Date().toISOString(), deleted_at: null },
			{ id: "player-2", event_id: "event-1", name: "Player 2", note: null, created_at: new Date().toISOString(), deleted_at: null },
		];

		const mockBracketMatches = [
			{
				id: "match-1",
				tournament_id: "tournament-1",
				round: 1,
				position: 1,
				participant_a_type: "pair" as const,
				participant_a_pair_id: "pair-1",
				participant_b_type: "pair" as const,
				participant_b_pair_id: "pair-1",
				score_a: null,
				score_b: null,
				winner_side: null,
				status: "pending",
				created_at: new Date().toISOString(),
			},
		];

		mockDatabase.tournaments.ensureTournament.mockResolvedValue(mockTournament);
		mockDatabase.pairs.listPairs.mockResolvedValue(mockPairs);
		mockDatabase.players.listPlayers.mockResolvedValue(mockPlayers);
		mockDatabase.bracketMatches.listBracketMatches.mockResolvedValue(mockBracketMatches);
		mockDatabase.ffaGroups.listFfaGroups.mockResolvedValue([]);

		const result = await loader({
			params: { eventId: "event-1", tournamentId: "tournament-1" },
			context: createContext(),
			request: new Request("http://localhost"),
		});

		expect(result.status).toBe(200);
		const data = await result.json();
		expect(data.eventId).toBe("event-1");
		expect(data.tournamentId).toBe("tournament-1");
		expect(data.tournament).toEqual(mockTournament);
		expect(data.bracketMatches).toEqual(mockBracketMatches);
		expect(data.ffaGroups).toEqual([]);
	});

	test("returns FFA groups data for ffa-2up tournament", async () => {
		const mockTournament = {
			id: "tournament-1",
			eventId: "event-1",
			name: "Test FFA Tournament",
			format: "ffa-2up" as const,
			seedingMode: "random" as const,
			entryMode: "solo" as const,
			createdAt: new Date().toISOString(),
		};

		const mockPlayers = [
			{ id: "player-1", event_id: "event-1", name: "Player 1", note: null, created_at: new Date().toISOString(), deleted_at: null },
			{ id: "player-2", event_id: "event-1", name: "Player 2", note: null, created_at: new Date().toISOString(), deleted_at: null },
			{ id: "player-3", event_id: "event-1", name: "Player 3", note: null, created_at: new Date().toISOString(), deleted_at: null },
			{ id: "player-4", event_id: "event-1", name: "Player 4", note: null, created_at: new Date().toISOString(), deleted_at: null },
		];

		const mockFfaGroups = [
			{
				id: "group-1",
				tournament_id: "tournament-1",
				round: 1,
				position: 1,
				participant_1_type: "player" as const,
				participant_1_player_id: "player-1",
				participant_2_type: "player" as const,
				participant_2_player_id: "player-2",
				participant_3_type: "player" as const,
				participant_3_player_id: "player-3",
				participant_4_type: "player" as const,
				participant_4_player_id: "player-4",
				status: "pending",
				winner1_player_id: null,
				winner2_player_id: null,
				created_at: new Date().toISOString(),
			},
		];

		mockDatabase.tournaments.ensureTournament.mockResolvedValue(mockTournament);
		mockDatabase.pairs.listPairs.mockResolvedValue([]);
		mockDatabase.players.listPlayers.mockResolvedValue(mockPlayers);
		mockDatabase.bracketMatches.listBracketMatches.mockResolvedValue([]);
		mockDatabase.ffaGroups.listFfaGroups.mockResolvedValue(mockFfaGroups);

		const result = await loader({
			params: { eventId: "event-1", tournamentId: "tournament-1" },
			context: createContext(),
			request: new Request("http://localhost"),
		});

		expect(result.status).toBe(200);
		const data = await result.json();
		expect(data.tournament.format).toBe("ffa-2up");
		expect(data.ffaGroups).toEqual(mockFfaGroups);
		expect(data.bracketMatches).toEqual([]);
	});

	test("throws error when tournament not found", async () => {
		mockDatabase.tournaments.ensureTournament.mockRejectedValue(new Error("Tournament not found"));

		await expect(
			loader({
				params: { eventId: "event-1", tournamentId: "non-existent" },
				context: createContext(),
				request: new Request("http://localhost"),
			}),
		).rejects.toThrow();
	});

	test("throws error when eventId mismatch", async () => {
		const mockTournament = {
			id: "tournament-1",
			eventId: "event-2", // 異なるイベントID
			name: "Test Tournament",
			format: "single-elimination" as const,
			seedingMode: "random" as const,
			entryMode: "pair" as const,
			createdAt: new Date().toISOString(),
		};

		mockDatabase.tournaments.ensureTournament.mockResolvedValue(mockTournament);

		await expect(
			loader({
				params: { eventId: "event-1", tournamentId: "tournament-1" },
				context: createContext(),
				request: new Request("http://localhost"),
			}),
		).rejects.toThrow();
	});

	test("throws error when eventId or tournamentId is missing", async () => {
		await expect(
			loader({
				params: {},
				context: createContext(),
				request: new Request("http://localhost"),
			}),
		).rejects.toThrow();
	});
});

