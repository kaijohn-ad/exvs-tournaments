import { describe, expect, test, vi } from "vitest";
import type { AppLoadContext } from "@remix-run/cloudflare";
import { loader, action } from "../admin.events.$eventId.tournaments.$tournamentId.bracket";

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
		ensurePair: vi.fn(),
	},
	players: {
		listPlayers: vi.fn(),
	},
	bracketMatches: {
		listBracketMatches: vi.fn(),
		ensureBracketMatch: vi.fn(),
		updateBracketMatch: vi.fn(),
	},
	ffaGroups: {
		listFfaGroups: vi.fn(),
	},
	matches: {
		listMatches: vi.fn(),
		createMatch: vi.fn(),
	},
	playerStats: {
		incrementPlayerStats: vi.fn(),
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

	test("returns bracket data for double-elimination tournament", async () => {
		const mockTournament = {
			id: "tournament-1",
			eventId: "event-1",
			name: "Test Double Elimination Tournament",
			format: "double-elimination" as const,
			seedingMode: "random" as const,
			entryMode: "pair" as const,
			grandFinalsFormat: "single" as const,
			createdAt: new Date().toISOString(),
		};

		const mockPairs = [
			{ id: "pair-1", event_id: "event-1", player1_id: "player-1", player2_id: "player-2", seed: null, created_at: new Date().toISOString() },
			{ id: "pair-2", event_id: "event-1", player1_id: "player-3", player2_id: "player-4", seed: null, created_at: new Date().toISOString() },
		];

		const mockPlayers = [
			{ id: "player-1", event_id: "event-1", name: "Player 1", note: null, created_at: new Date().toISOString(), deleted_at: null },
			{ id: "player-2", event_id: "event-1", name: "Player 2", note: null, created_at: new Date().toISOString(), deleted_at: null },
			{ id: "player-3", event_id: "event-1", name: "Player 3", note: null, created_at: new Date().toISOString(), deleted_at: null },
			{ id: "player-4", event_id: "event-1", name: "Player 4", note: null, created_at: new Date().toISOString(), deleted_at: null },
		];

		const mockBracketMatches = [
			{
				id: "match-w1",
				tournament_id: "tournament-1",
				round: 1,
				position: 1,
				bracket: "winners" as const,
				participant_a_type: "pair" as const,
				participant_a_pair_id: "pair-1",
				participant_b_type: "pair" as const,
				participant_b_pair_id: "pair-2",
				score_a: null,
				score_b: null,
				winner_side: null,
				status: "pending",
				created_at: new Date().toISOString(),
			},
			{
				id: "match-gf1",
				tournament_id: "tournament-1",
				round: 1,
				position: 1,
				bracket: "grand-finals" as const,
				participant_a_type: "empty" as const,
				participant_a_pair_id: null,
				participant_b_type: "empty" as const,
				participant_b_pair_id: null,
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
		expect(data.tournament.format).toBe("double-elimination");
		expect(data.bracketMatches).toEqual(mockBracketMatches);
		expect(data.ffaGroups).toEqual([]);
	});
});

describe("admin.events.$eventId.tournaments.$tournamentId.bracket action", () => {
	test("propagates winner to next round in winners bracket for double-elimination", async () => {
		const mockTournament = {
			id: "tournament-1",
			eventId: "event-1",
			name: "Test Double Elimination Tournament",
			format: "double-elimination" as const,
			seedingMode: "random" as const,
			entryMode: "pair" as const,
			grandFinalsFormat: "single" as const,
			createdAt: new Date().toISOString(),
		};

		const mockMatch = {
			id: "match-w1",
			tournament_id: "tournament-1",
			round: 1,
			position: 1,
			bracket: "winners" as const,
			participant_a_type: "pair" as const,
			participant_a_pair_id: "pair-1",
			participant_b_type: "pair" as const,
			participant_b_pair_id: "pair-2",
			score_a: null,
			score_b: null,
			winner_side: null,
			status: "pending",
			created_at: new Date().toISOString(),
		};

		const mockNextWinnersMatch = {
			id: "match-w2",
			tournament_id: "tournament-1",
			round: 2,
			position: 1,
			bracket: "winners" as const,
			participant_a_type: "empty" as const,
			participant_a_pair_id: null,
			participant_b_type: "empty" as const,
			participant_b_pair_id: null,
			score_a: null,
			score_b: null,
			winner_side: null,
			status: "pending",
			created_at: new Date().toISOString(),
		};

		const mockLosersMatch = {
			id: "match-l1",
			tournament_id: "tournament-1",
			round: 1,
			position: 1,
			bracket: "losers" as const,
			participant_a_type: "empty" as const,
			participant_a_pair_id: null,
			participant_b_type: "empty" as const,
			participant_b_pair_id: null,
			score_a: null,
			score_b: null,
			winner_side: null,
			status: "pending",
			created_at: new Date().toISOString(),
		};

		const mockPair1 = {
			id: "pair-1",
			event_id: "event-1",
			player1_id: "player-1",
			player2_id: "player-2",
			seed: null,
			created_at: new Date().toISOString(),
		};

		const mockPair2 = {
			id: "pair-2",
			event_id: "event-1",
			player1_id: "player-3",
			player2_id: "player-4",
			seed: null,
			created_at: new Date().toISOString(),
		};

		mockDatabase.tournaments.ensureTournament.mockResolvedValue(mockTournament);
		mockDatabase.bracketMatches.ensureBracketMatch.mockResolvedValue(mockMatch);
		mockDatabase.bracketMatches.listBracketMatches.mockResolvedValue([
			mockMatch,
			mockNextWinnersMatch,
			mockLosersMatch,
		]);
		mockDatabase.pairs.ensurePair
			.mockResolvedValueOnce(mockPair1)
			.mockResolvedValueOnce(mockPair2);
		mockDatabase.matches.listMatches.mockResolvedValue([]);
		mockDatabase.matches.createMatch.mockResolvedValue(undefined);
		mockDatabase.playerStats.incrementPlayerStats.mockResolvedValue(undefined);

		const formData = new FormData();
		formData.append("_intent", "record");
		formData.append("matchId", "match-w1");
		formData.append("scoreA", "3");
		formData.append("scoreB", "1");
		formData.append("winnerSide", "a");

		const result = await action({
			params: { eventId: "event-1", tournamentId: "tournament-1" },
			context: createContext(),
			request: new Request("http://localhost", {
				method: "POST",
				body: formData,
			}),
		});

		expect(result.status).toBe(200);
		const data = await result.json();
		expect(data).not.toBeNull();
		if (!data) throw new Error("data is null");
		expect(data.type).toBe("success");

		// Winner should be propagated to next winners match
		expect(mockDatabase.bracketMatches.updateBracketMatch).toHaveBeenCalledWith(
			"tournament-1",
			"match-w2",
			expect.objectContaining({
				participant_a_type: "pair",
				participant_a_pair_id: "pair-1",
			})
		);

		// Loser should be propagated to losers bracket
		expect(mockDatabase.bracketMatches.updateBracketMatch).toHaveBeenCalledWith(
			"tournament-1",
			"match-l1",
			expect.objectContaining({
				participant_b_type: "pair",
				participant_b_pair_id: "pair-2",
			})
		);
	});

	test("propagates winner to grand finals when losers bracket final is won (4 pairs)", async () => {
		const mockTournament = {
			id: "tournament-1",
			eventId: "event-1",
			name: "Test Double Elimination Tournament",
			format: "double-elimination" as const,
			seedingMode: "random" as const,
			entryMode: "pair" as const,
			grandFinalsFormat: "single" as const,
			createdAt: new Date().toISOString(),
		};

		const mockLosersFinalMatch = {
			id: "match-lfinal",
			tournament_id: "tournament-1",
			round: 2, // Final round of losers bracket (for 4 pairs)
			position: 1,
			bracket: "losers" as const,
			participant_a_type: "pair" as const,
			participant_a_pair_id: "pair-3",
			participant_b_type: "pair" as const,
			participant_b_pair_id: "pair-4",
			score_a: null,
			score_b: null,
			winner_side: null,
			status: "pending",
			created_at: new Date().toISOString(),
		};

		const mockGrandFinalsMatch = {
			id: "match-gf1",
			tournament_id: "tournament-1",
			round: 1,
			position: 1,
			bracket: "grand-finals" as const,
			participant_a_type: "pair" as const,
			participant_a_pair_id: "pair-1", // Winners champion
			participant_b_type: "empty" as const,
			participant_b_pair_id: null,
			score_a: null,
			score_b: null,
			winner_side: null,
			status: "pending",
			created_at: new Date().toISOString(),
		};

		const mockPair3 = {
			id: "pair-3",
			event_id: "event-1",
			player1_id: "player-5",
			player2_id: "player-6",
			seed: null,
			created_at: new Date().toISOString(),
		};

		const mockPair4 = {
			id: "pair-4",
			event_id: "event-1",
			player1_id: "player-7",
			player2_id: "player-8",
			seed: null,
			created_at: new Date().toISOString(),
		};

		mockDatabase.tournaments.ensureTournament.mockResolvedValue(mockTournament);
		mockDatabase.bracketMatches.ensureBracketMatch.mockResolvedValue(mockLosersFinalMatch);
		mockDatabase.bracketMatches.listBracketMatches.mockResolvedValue([
			mockLosersFinalMatch,
			mockGrandFinalsMatch,
		]);
		mockDatabase.pairs.ensurePair
			.mockResolvedValueOnce(mockPair3)
			.mockResolvedValueOnce(mockPair4);
		mockDatabase.matches.listMatches.mockResolvedValue([]);
		mockDatabase.matches.createMatch.mockResolvedValue(undefined);
		mockDatabase.playerStats.incrementPlayerStats.mockResolvedValue(undefined);

		const formData = new FormData();
		formData.append("_intent", "record");
		formData.append("matchId", "match-lfinal");
		formData.append("scoreA", "3");
		formData.append("scoreB", "1");
		formData.append("winnerSide", "a");

		const result = await action({
			params: { eventId: "event-1", tournamentId: "tournament-1" },
			context: createContext(),
			request: new Request("http://localhost", {
				method: "POST",
				body: formData,
			}),
		});

		expect(result.status).toBe(200);
		const data = await result.json();
		expect(data).not.toBeNull();
		if (!data) throw new Error("data is null");
		expect(data.type).toBe("success");

		// Losers champion should be propagated to grand finals
		expect(mockDatabase.bracketMatches.updateBracketMatch).toHaveBeenCalledWith(
			"tournament-1",
			"match-gf1",
			expect.objectContaining({
				participant_b_type: "pair",
				participant_b_pair_id: "pair-3",
			})
		);
	});

	test("propagates Winners Round 2 loser to Losers Round 2 for 4 pairs", async () => {
		const mockTournament = {
			id: "tournament-1",
			eventId: "event-1",
			name: "Test Double Elimination Tournament",
			format: "double-elimination" as const,
			seedingMode: "random" as const,
			entryMode: "pair" as const,
			grandFinalsFormat: "single" as const,
			createdAt: new Date().toISOString(),
		};

		const mockWinnersRound2Match = {
			id: "match-w2",
			tournament_id: "tournament-1",
			round: 2,
			position: 1,
			bracket: "winners" as const,
			participant_a_type: "pair" as const,
			participant_a_pair_id: "pair-1",
			participant_b_type: "pair" as const,
			participant_b_pair_id: "pair-2",
			score_a: null,
			score_b: null,
			winner_side: null,
			status: "pending",
			created_at: new Date().toISOString(),
		};

		const mockLosersRound2Match = {
			id: "match-l2",
			tournament_id: "tournament-1",
			round: 2,
			position: 1,
			bracket: "losers" as const,
			participant_a_type: "pair" as const,
			participant_a_pair_id: "pair-3", // From Losers Round 1
			participant_b_type: "pair" as const,
			participant_b_pair_id: null, // Will be filled by Winners Round 2 loser
			score_a: null,
			score_b: null,
			winner_side: null,
			status: "pending",
			created_at: new Date().toISOString(),
		};

		const mockGrandFinalsMatch = {
			id: "match-gf1",
			tournament_id: "tournament-1",
			round: 1,
			position: 1,
			bracket: "grand-finals" as const,
			participant_a_type: "pair" as const,
			participant_a_pair_id: null,
			participant_b_type: "pair" as const,
			participant_b_pair_id: null,
			score_a: null,
			score_b: null,
			winner_side: null,
			status: "pending",
			created_at: new Date().toISOString(),
		};

		const mockPair1 = {
			id: "pair-1",
			event_id: "event-1",
			player1_id: "player-1",
			player2_id: "player-2",
			seed: null,
			created_at: new Date().toISOString(),
		};

		const mockPair2 = {
			id: "pair-2",
			event_id: "event-1",
			player1_id: "player-3",
			player2_id: "player-4",
			seed: null,
			created_at: new Date().toISOString(),
		};

		mockDatabase.tournaments.ensureTournament.mockResolvedValue(mockTournament);
		mockDatabase.bracketMatches.ensureBracketMatch.mockResolvedValue(mockWinnersRound2Match);
		mockDatabase.bracketMatches.listBracketMatches.mockResolvedValue([
			mockWinnersRound2Match,
			mockLosersRound2Match,
			mockGrandFinalsMatch,
		]);
		mockDatabase.pairs.ensurePair
			.mockResolvedValueOnce(mockPair1)
			.mockResolvedValueOnce(mockPair2);
		mockDatabase.matches.listMatches.mockResolvedValue([]);
		mockDatabase.matches.createMatch.mockResolvedValue(undefined);
		mockDatabase.playerStats.incrementPlayerStats.mockResolvedValue(undefined);

		const formData = new FormData();
		formData.append("_intent", "record");
		formData.append("matchId", "match-w2");
		formData.append("scoreA", "3");
		formData.append("scoreB", "1");
		formData.append("winnerSide", "a");

		const result = await action({
			params: { eventId: "event-1", tournamentId: "tournament-1" },
			context: createContext(),
			request: new Request("http://localhost", {
				method: "POST",
				body: formData,
			}),
		});

		expect(result.status).toBe(200);
		const data = await result.json();
		expect(data).not.toBeNull();
		if (!data) throw new Error("data is null");
		expect(data.type).toBe("success");

		// Winner should be propagated to Grand Finals
		expect(mockDatabase.bracketMatches.updateBracketMatch).toHaveBeenCalledWith(
			"tournament-1",
			"match-gf1",
			expect.objectContaining({
				participant_a_type: "pair",
				participant_a_pair_id: "pair-1",
			})
		);

		// Loser should be propagated to Losers Round 2
		expect(mockDatabase.bracketMatches.updateBracketMatch).toHaveBeenCalledWith(
			"tournament-1",
			"match-l2",
			expect.objectContaining({
				participant_b_type: "pair",
				participant_b_pair_id: "pair-2",
			})
		);
	});
});

