import { describe, expect, it } from "vitest";
import { computeKothState, type KothState } from "~/utils/team-battles/koth";

describe("computeKothState", () => {
	const teamAId = "team-a";
	const teamBId = "team-b";
	const slotsCount = 3;

	it("初期状態: 両チームとも1番手から開始", () => {
		const state = computeKothState(slotsCount, teamAId, teamBId, []);

		expect(state.nextMatchIndex).toBe(0);
		expect(state.aCurrentIndex).toBe(0);
		expect(state.bCurrentIndex).toBe(0);
		expect(state.aLosses).toBe(0);
		expect(state.bLosses).toBe(0);
		expect(state.finished).toBe(false);
		expect(state.winnerTeamId).toBeUndefined();
	});

	it("チームAが連勝: チームBが交代、チームAは続投", () => {
		const matches = [
			{ winner_side: "a" as const, slot_index: 0 },
			{ winner_side: "a" as const, slot_index: 1 },
		];

		const state = computeKothState(slotsCount, teamAId, teamBId, matches);

		expect(state.nextMatchIndex).toBe(2);
		expect(state.aCurrentIndex).toBe(0); // Aは続投
		expect(state.bCurrentIndex).toBe(2); // Bは2回負けたので3番手へ
		expect(state.aLosses).toBe(0);
		expect(state.bLosses).toBe(2);
		expect(state.finished).toBe(false);
	});

	it("チームBが連勝: チームAが交代、チームBは続投", () => {
		const matches = [
			{ winner_side: "b" as const, slot_index: 0 },
			{ winner_side: "b" as const, slot_index: 1 },
		];

		const state = computeKothState(slotsCount, teamAId, teamBId, matches);

		expect(state.nextMatchIndex).toBe(2);
		expect(state.aCurrentIndex).toBe(2); // Aは2回負けたので3番手へ
		expect(state.bCurrentIndex).toBe(0); // Bは続投
		expect(state.aLosses).toBe(2);
		expect(state.bLosses).toBe(0);
		expect(state.finished).toBe(false);
	});

	it("交互に勝敗: 両方交代", () => {
		const matches = [
			{ winner_side: "a" as const, slot_index: 0 },
			{ winner_side: "b" as const, slot_index: 1 },
			{ winner_side: "a" as const, slot_index: 2 },
		];

		const state = computeKothState(slotsCount, teamAId, teamBId, matches);

		expect(state.nextMatchIndex).toBe(3);
		expect(state.aCurrentIndex).toBe(1); // Aは1回負けたので2番手
		expect(state.bCurrentIndex).toBe(2); // Bは2回負けたので3番手
		expect(state.aLosses).toBe(1);
		expect(state.bLosses).toBe(2);
		expect(state.finished).toBe(false);
	});

	it("チームAが3敗（最短パターン）: チームBの勝利", () => {
		const matches = [
			{ winner_side: "b" as const, slot_index: 0 },
			{ winner_side: "b" as const, slot_index: 1 },
			{ winner_side: "b" as const, slot_index: 2 },
		];

		const state = computeKothState(slotsCount, teamAId, teamBId, matches);

		expect(state.aLosses).toBe(3);
		expect(state.bLosses).toBe(0);
		expect(state.finished).toBe(true);
		expect(state.winnerTeamId).toBe(teamBId);
	});

	it("チームBが3敗（最短パターン）: チームAの勝利", () => {
		const matches = [
			{ winner_side: "a" as const, slot_index: 0 },
			{ winner_side: "a" as const, slot_index: 1 },
			{ winner_side: "a" as const, slot_index: 2 },
		];

		const state = computeKothState(slotsCount, teamAId, teamBId, matches);

		expect(state.aLosses).toBe(0);
		expect(state.bLosses).toBe(3);
		expect(state.finished).toBe(true);
		expect(state.winnerTeamId).toBe(teamAId);
	});

	it("最長パターン: 交互に勝敗が続く", () => {
		const matches = [
			{ winner_side: "a" as const, slot_index: 0 },
			{ winner_side: "b" as const, slot_index: 1 },
			{ winner_side: "a" as const, slot_index: 2 },
			{ winner_side: "b" as const, slot_index: 3 },
			{ winner_side: "a" as const, slot_index: 4 },
		];

		const state = computeKothState(slotsCount, teamAId, teamBId, matches);

		expect(state.aCurrentIndex).toBe(2); // Aは2回負けたので3番手
		expect(state.bCurrentIndex).toBe(3); // Bは3回負けた（上限到達）
		expect(state.aLosses).toBe(2);
		expect(state.bLosses).toBe(3);
		expect(state.finished).toBe(true);
		expect(state.winnerTeamId).toBe(teamAId);
	});

	it("slot_indexがnullでも動作", () => {
		const matches = [
			{ winner_side: "a" as const, slot_index: null },
			{ winner_side: "b" as const, slot_index: undefined },
		];

		const state = computeKothState(slotsCount, teamAId, teamBId, matches);

		expect(state.nextMatchIndex).toBe(2);
		expect(state.aCurrentIndex).toBe(1);
		expect(state.bCurrentIndex).toBe(1);
		expect(state.aLosses).toBe(1);
		expect(state.bLosses).toBe(1);
	});

	it("上限到達後は処理を停止", () => {
		const matches = [
			{ winner_side: "b" as const, slot_index: 0 },
			{ winner_side: "b" as const, slot_index: 1 },
			{ winner_side: "b" as const, slot_index: 2 },
			{ winner_side: "a" as const, slot_index: 3 }, // これ以降は処理されない
			{ winner_side: "a" as const, slot_index: 4 },
		];

		const state = computeKothState(slotsCount, teamAId, teamBId, matches);

		expect(state.aLosses).toBe(3); // 最初の3試合で3敗
		expect(state.bLosses).toBe(0);
		expect(state.finished).toBe(true);
		expect(state.winnerTeamId).toBe(teamBId);
	});
});

