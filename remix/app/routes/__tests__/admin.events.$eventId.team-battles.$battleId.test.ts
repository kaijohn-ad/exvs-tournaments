import { describe, expect, test, vi, beforeEach } from "vitest";
import type { AppLoadContext } from "@remix-run/cloudflare";
import { action } from "../admin.events.$eventId.team-battles.$battleId";

const createContext = (): AppLoadContext =>
	({
		cloudflare: {
			env: {
				DB: undefined,
			},
		},
	}) as unknown as AppLoadContext;

const mockDatabase = {
	teamBattles: {
		ensureTeamBattle: vi.fn(),
		updateTeamBattle: vi.fn(),
	},
	teamBattleSlots: {
		listSlotsByBattle: vi.fn(),
	},
	matches: {
		listMatches: vi.fn(),
		createMatch: vi.fn(),
		deleteMatch: vi.fn(),
	},
	players: {
		listPlayers: vi.fn(),
	},
	pairs: {
		ensurePair: vi.fn(),
		listPairs: vi.fn(),
	},
	playerStats: {
		incrementPlayerStats: vi.fn(),
	},
};

vi.mock("~/repositories/database.server", () => ({
	getDatabase: () => mockDatabase,
}));

describe("admin.events.$eventId.team-battles.$battleId action - KOTH", () => {
	const eventId = "event-1";
	const battleId = "battle-1";
	const teamAId = "team-a";
	const teamBId = "team-b";
	const slotsCount = 3;

	const mockKothBattle = {
		id: battleId,
		event_id: eventId,
		team_a_id: teamAId,
		team_b_id: teamBId,
		slots_count: slotsCount,
		format: "koth",
		allow_double_appearance_per_team: true,
		tiebreak: "off",
		status: "pending",
		result: null,
	};

	const mockSlotA0 = {
		id: "slot-a-0",
		team_battle_id: battleId,
		team_id: teamAId,
		slot_index: 0,
		assignment_type: "pair" as const,
		pair_id: "pair-a-0",
		player1_id: null,
		player2_id: null,
	};

	const mockSlotB0 = {
		id: "slot-b-0",
		team_battle_id: battleId,
		team_id: teamBId,
		slot_index: 0,
		assignment_type: "pair" as const,
		pair_id: "pair-b-0",
		player1_id: null,
		player2_id: null,
	};

	const mockPairA0 = {
		id: "pair-a-0",
		event_id: eventId,
		player1_id: "player-a1",
		player2_id: "player-a2",
		seed: null,
		created_at: new Date().toISOString(),
	};

	const mockPairB0 = {
		id: "pair-b-0",
		event_id: eventId,
		player1_id: "player-b1",
		player2_id: "player-b2",
		seed: null,
		created_at: new Date().toISOString(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("recordKothMatch", () => {
		test("正常系: 初戦の試合を記録", async () => {
			mockDatabase.teamBattles.ensureTeamBattle.mockResolvedValue(mockKothBattle);
			mockDatabase.matches.listMatches.mockResolvedValue([]);
			mockDatabase.teamBattleSlots.listSlotsByBattle.mockResolvedValue([
				mockSlotA0,
				mockSlotB0,
			]);
			mockDatabase.pairs.ensurePair
				.mockResolvedValueOnce(mockPairA0)
				.mockResolvedValueOnce(mockPairB0);
			mockDatabase.matches.createMatch.mockResolvedValue({
				id: "match-1",
				context: "teamBattle",
				context_id: battleId,
				slot_index: 0,
				side_a_type: "pair",
				side_a_pair_id: "pair-a-0",
				side_b_type: "pair",
				side_b_pair_id: "pair-b-0",
				score_a: 3,
				score_b: 1,
				winner_side: "a",
				status: "completed",
				played_at: new Date().toISOString(),
			});
			mockDatabase.playerStats.incrementPlayerStats.mockResolvedValue(undefined);
			mockDatabase.matches.listMatches.mockResolvedValueOnce([]).mockResolvedValueOnce([
				{
					id: "match-1",
					context: "teamBattle",
					context_id: battleId,
					slot_index: 0,
					score_a: 3,
					score_b: 1,
					winner_side: "a",
				},
			]);
			mockDatabase.teamBattles.updateTeamBattle.mockResolvedValue({
				...mockKothBattle,
				status: "in_progress",
			});

			const formData = new FormData();
			formData.append("_intent", "recordKothMatch");
			formData.append("scoreA", "3");
			formData.append("scoreB", "1");
			formData.append("winnerTeamId", teamAId);

			const result = await action({
				params: { eventId, battleId },
				context: createContext(),
				request: new Request("http://localhost", {
					method: "POST",
					body: formData,
				}),
			});

			expect(result.status).toBe(200);
			const data = await result.json();
			expect(data.type).toBe("success");
			expect(data.message).toContain("試合1の結果を記録しました");

			expect(mockDatabase.matches.createMatch).toHaveBeenCalledWith(
				expect.objectContaining({
					context: "teamBattle",
					context_id: battleId,
					slot_index: 0,
					score_a: 3,
					score_b: 1,
					winner_side: "a",
				}),
			);

			expect(mockDatabase.teamBattles.updateTeamBattle).toHaveBeenCalledWith(
				eventId,
				battleId,
				expect.objectContaining({
					status: "in_progress",
				}),
			);
		});

		test("自動終了: チームBが3敗で自動終了", async () => {
			const battle = { ...mockKothBattle, status: "in_progress" };
			const existingMatches = [
				{ winner_side: "a" as const, slot_index: 0 },
				{ winner_side: "a" as const, slot_index: 1 },
			];

			mockDatabase.teamBattles.ensureTeamBattle.mockResolvedValue(battle);
			mockDatabase.matches.listMatches
				.mockResolvedValueOnce(
					existingMatches.map((m, idx) => ({
						id: `match-${idx + 1}`,
						context: "teamBattle",
						context_id: battleId,
						slot_index: m.slot_index,
						score_a: 3,
						score_b: 1,
						winner_side: m.winner_side,
						status: "completed",
						played_at: new Date().toISOString(),
					})),
				)
				.mockResolvedValueOnce([
					...existingMatches.map((m, idx) => ({
						id: `match-${idx + 1}`,
						context: "teamBattle",
						context_id: battleId,
						slot_index: m.slot_index,
						score_a: 3,
						score_b: 1,
						winner_side: m.winner_side,
						status: "completed",
						played_at: new Date().toISOString(),
					})),
					{
						id: "match-3",
						context: "teamBattle",
						context_id: battleId,
						slot_index: 2,
						score_a: 3,
						score_b: 1,
						winner_side: "a" as const,
						status: "completed",
						played_at: new Date().toISOString(),
					},
				]);

			const slotA0 = { ...mockSlotA0, slot_index: 0 };
			const slotB2 = { ...mockSlotB0, slot_index: 2 };

			mockDatabase.teamBattleSlots.listSlotsByBattle.mockResolvedValue([slotA0, slotB2]);
			mockDatabase.pairs.ensurePair
				.mockResolvedValueOnce(mockPairA0)
				.mockResolvedValueOnce(mockPairB0);
			mockDatabase.matches.createMatch.mockResolvedValue({
				id: "match-3",
				context: "teamBattle",
				context_id: battleId,
				slot_index: 2,
				score_a: 3,
				score_b: 1,
				winner_side: "a",
				status: "completed",
				played_at: new Date().toISOString(),
			});
			mockDatabase.playerStats.incrementPlayerStats.mockResolvedValue(undefined);
			mockDatabase.teamBattles.updateTeamBattle.mockResolvedValue({
				...battle,
				status: "completed",
				result: "team_a_win",
			});

			const formData = new FormData();
			formData.append("_intent", "recordKothMatch");
			formData.append("scoreA", "3");
			formData.append("scoreB", "1");
			formData.append("winnerTeamId", teamAId);

			const result = await action({
				params: { eventId, battleId },
				context: createContext(),
				request: new Request("http://localhost", {
					method: "POST",
					body: formData,
				}),
			});

			expect(result.status).toBe(200);
			const data = await result.json();
			expect(data.type).toBe("success");
			expect(data.message).toContain("団体戦終了");

			expect(mockDatabase.teamBattles.updateTeamBattle).toHaveBeenCalledWith(
				eventId,
				battleId,
				expect.objectContaining({
					status: "completed",
					result: "team_a_win",
				}),
			);
		});

		test("エラー: 形式がkothでない", async () => {
			const wasedaBattle = { ...mockKothBattle, format: "waseda" };
			mockDatabase.teamBattles.ensureTeamBattle.mockResolvedValue(wasedaBattle);

			const formData = new FormData();
			formData.append("_intent", "recordKothMatch");
			formData.append("scoreA", "3");
			formData.append("scoreB", "1");
			formData.append("winnerTeamId", teamAId);

			const result = await action({
				params: { eventId, battleId },
				context: createContext(),
				request: new Request("http://localhost", {
					method: "POST",
					body: formData,
				}),
			});

			expect(result.status).toBe(400);
			const data = await result.json();
			expect(data.type).toBe("error");
			expect(data.message).toContain("勝ち抜き戦ではありません");
		});

		test("エラー: スコアが不正", async () => {
			mockDatabase.teamBattles.ensureTeamBattle.mockResolvedValue(mockKothBattle);

			const formData = new FormData();
			formData.append("_intent", "recordKothMatch");
			formData.append("scoreA", "-1");
			formData.append("scoreB", "1");

			const result = await action({
				params: { eventId, battleId },
				context: createContext(),
				request: new Request("http://localhost", {
					method: "POST",
					body: formData,
				}),
			});

			expect(result.status).toBe(400);
			const data = await result.json();
			expect(data.type).toBe("error");
			expect(data.message).toContain("スコアは0以上の整数");
		});

		test("エラー: ラインナップ未設定", async () => {
			mockDatabase.teamBattles.ensureTeamBattle.mockResolvedValue(mockKothBattle);
			mockDatabase.matches.listMatches.mockResolvedValue([]);
			mockDatabase.teamBattleSlots.listSlotsByBattle.mockResolvedValue([]);

			const formData = new FormData();
			formData.append("_intent", "recordKothMatch");
			formData.append("scoreA", "3");
			formData.append("scoreB", "1");
			formData.append("winnerTeamId", teamAId);

			const result = await action({
				params: { eventId, battleId },
				context: createContext(),
				request: new Request("http://localhost", {
					method: "POST",
					body: formData,
				}),
			});

			expect(result.status).toBe(400);
			const data = await result.json();
			expect(data.type).toBe("error");
			expect(data.message).toContain("ラインナップが設定されていません");
		});
	});

	describe("deleteKothMatch", () => {
		test("正常系: 最後の試合を削除", async () => {
			const battle = { ...mockKothBattle, status: "in_progress" };
			const matches = [
				{
					id: "match-1",
					context: "teamBattle" as const,
					context_id: battleId,
					slot_index: 0,
					score_a: 3,
					score_b: 1,
					winner_side: "a" as const,
					status: "completed",
					played_at: new Date().toISOString(),
				},
			];

			mockDatabase.teamBattles.ensureTeamBattle.mockResolvedValue(battle);
			mockDatabase.matches.listMatches.mockResolvedValue(matches);
			mockDatabase.matches.deleteMatch.mockResolvedValue(undefined);
			mockDatabase.teamBattles.updateTeamBattle.mockResolvedValue({
				...battle,
				status: "pending",
				result: null,
			});

			const formData = new FormData();
			formData.append("_intent", "deleteKothMatch");
			formData.append("matchId", "match-1");

			const result = await action({
				params: { eventId, battleId },
				context: createContext(),
				request: new Request("http://localhost", {
					method: "POST",
					body: formData,
				}),
			});

			expect(result.status).toBe(200);
			const data = await result.json();
			expect(data.type).toBe("success");
			expect(data.message).toContain("最後の試合結果を削除しました");

			expect(mockDatabase.matches.deleteMatch).toHaveBeenCalledWith("match-1");
			expect(mockDatabase.teamBattles.updateTeamBattle).toHaveBeenCalledWith(
				eventId,
				battleId,
				expect.objectContaining({
					status: "pending",
				}),
			);
		});

		test("エラー: 最後の試合でない", async () => {
			const battle = { ...mockKothBattle, status: "in_progress" };
			const matches = [
				{
					id: "match-1",
					context: "teamBattle" as const,
					context_id: battleId,
					slot_index: 0,
					score_a: 3,
					score_b: 1,
					winner_side: "a" as const,
					status: "completed",
					played_at: new Date().toISOString(),
				},
				{
					id: "match-2",
					context: "teamBattle" as const,
					context_id: battleId,
					slot_index: 1,
					score_a: 2,
					score_b: 3,
					winner_side: "b" as const,
					status: "completed",
					played_at: new Date().toISOString(),
				},
			];

			mockDatabase.teamBattles.ensureTeamBattle.mockResolvedValue(battle);
			mockDatabase.matches.listMatches.mockResolvedValue(matches);

			const formData = new FormData();
			formData.append("_intent", "deleteKothMatch");
			formData.append("matchId", "match-1");

			const result = await action({
				params: { eventId, battleId },
				context: createContext(),
				request: new Request("http://localhost", {
					method: "POST",
					body: formData,
				}),
			});

			expect(result.status).toBe(400);
			const data = await result.json();
			expect(data.type).toBe("error");
			expect(data.message).toContain("最後の試合のみ削除できます");
		});

		test("エラー: 形式がkothでない", async () => {
			const wasedaBattle = { ...mockKothBattle, format: "waseda" };
			mockDatabase.teamBattles.ensureTeamBattle.mockResolvedValue(wasedaBattle);

			const formData = new FormData();
			formData.append("_intent", "deleteKothMatch");
			formData.append("matchId", "match-1");

			const result = await action({
				params: { eventId, battleId },
				context: createContext(),
				request: new Request("http://localhost", {
					method: "POST",
					body: formData,
				}),
			});

			expect(result.status).toBe(400);
			const data = await result.json();
			expect(data.type).toBe("error");
			expect(data.message).toContain("勝ち抜き戦ではありません");
		});
	});
});

