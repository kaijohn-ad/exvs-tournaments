import { describe, expect, test } from "vitest";
import { chooseDisjointPairs } from "../participants";
import type { PairRecord } from "~/repositories/pairs";

describe("chooseDisjointPairs", () => {
	test("重複プレイヤーを含まないペアを選択する", () => {
		const pairs: PairRecord[] = [
			{
				id: "pair1",
				event_id: "event1",
				player1_id: "player1",
				player2_id: "player2",
				seed: 1,
				created_at: "2024-01-01T00:00:00Z"
			},
			{
				id: "pair2",
				event_id: "event1",
				player1_id: "player3",
				player2_id: "player4",
				seed: 2,
				created_at: "2024-01-01T00:00:00Z"
			},
			{
				id: "pair3",
				event_id: "event1",
				player1_id: "player1",
				player2_id: "player5",
				seed: 3,
				created_at: "2024-01-01T00:00:00Z"
			}
		];

		const usedPlayerIds = new Set<string>();
		const existingPairIds = new Set<string>();

		const result = chooseDisjointPairs(pairs, usedPlayerIds, existingPairIds);

		expect(result).toHaveLength(2);
		expect(result[0].id).toBe("pair1");
		expect(result[1].id).toBe("pair2");
		// pair3はplayer1が重複するため除外される
	});

	test("既に使用されているプレイヤーを含むペアをスキップする", () => {
		const pairs: PairRecord[] = [
			{
				id: "pair1",
				event_id: "event1",
				player1_id: "player1",
				player2_id: "player2",
				seed: 1,
				created_at: "2024-01-01T00:00:00Z"
			},
			{
				id: "pair2",
				event_id: "event1",
				player1_id: "player1",
				player2_id: "player3",
				seed: 2,
				created_at: "2024-01-01T00:00:00Z"
			},
			{
				id: "pair3",
				event_id: "event1",
				player1_id: "player4",
				player2_id: "player5",
				seed: 3,
				created_at: "2024-01-01T00:00:00Z"
			}
		];

		const usedPlayerIds = new Set(["player1", "player2"]);
		const existingPairIds = new Set<string>();

		const result = chooseDisjointPairs(pairs, usedPlayerIds, existingPairIds);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("pair3");
		// pair1は既にplayer1/player2が使用されているため除外
		// pair2はplayer1が使用されているため除外
	});

	test("既に追加済みのペアをスキップする", () => {
		const pairs: PairRecord[] = [
			{
				id: "pair1",
				event_id: "event1",
				player1_id: "player1",
				player2_id: "player2",
				seed: 1,
				created_at: "2024-01-01T00:00:00Z"
			},
			{
				id: "pair2",
				event_id: "event1",
				player1_id: "player3",
				player2_id: "player4",
				seed: 2,
				created_at: "2024-01-01T00:00:00Z"
			}
		];

		const usedPlayerIds = new Set<string>();
		const existingPairIds = new Set(["pair1"]);

		const result = chooseDisjointPairs(pairs, usedPlayerIds, existingPairIds);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("pair2");
	});

	test("seed昇順でソート済みの配列がそのまま優先される", () => {
		const pairs: PairRecord[] = [
			{
				id: "pair3",
				event_id: "event1",
				player1_id: "player5",
				player2_id: "player6",
				seed: 3,
				created_at: "2024-01-01T00:00:00Z"
			},
			{
				id: "pair1",
				event_id: "event1",
				player1_id: "player1",
				player2_id: "player2",
				seed: 1,
				created_at: "2024-01-01T00:00:00Z"
			},
			{
				id: "pair2",
				event_id: "event1",
				player1_id: "player3",
				player2_id: "player4",
				seed: 2,
				created_at: "2024-01-01T00:00:00Z"
			}
		];

		const usedPlayerIds = new Set<string>();
		const existingPairIds = new Set<string>();

		const result = chooseDisjointPairs(pairs, usedPlayerIds, existingPairIds);

		expect(result).toHaveLength(3);
		// 入力配列の順序が維持される（seed昇順でソート済みと仮定）
		expect(result[0].id).toBe("pair3");
		expect(result[1].id).toBe("pair1");
		expect(result[2].id).toBe("pair2");
	});

	test("seedがnullのペアも処理できる", () => {
		const pairs: PairRecord[] = [
			{
				id: "pair1",
				event_id: "event1",
				player1_id: "player1",
				player2_id: "player2",
				seed: null,
				created_at: "2024-01-01T00:00:00Z"
			},
			{
				id: "pair2",
				event_id: "event1",
				player1_id: "player3",
				player2_id: "player4",
				seed: 1,
				created_at: "2024-01-01T00:00:00Z"
			}
		];

		const usedPlayerIds = new Set<string>();
		const existingPairIds = new Set<string>();

		const result = chooseDisjointPairs(pairs, usedPlayerIds, existingPairIds);

		expect(result).toHaveLength(2);
	});

	test("空の配列を処理できる", () => {
		const pairs: PairRecord[] = [];
		const usedPlayerIds = new Set<string>();
		const existingPairIds = new Set<string>();

		const result = chooseDisjointPairs(pairs, usedPlayerIds, existingPairIds);

		expect(result).toHaveLength(0);
	});
});

