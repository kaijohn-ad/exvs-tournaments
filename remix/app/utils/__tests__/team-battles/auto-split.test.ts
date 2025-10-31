import { describe, expect, it, beforeEach } from "vitest";
import { autoSplitPlayersIntoTeams } from "~/utils/team-battles/auto-split";
import { setupTestDatabase, cleanupTestDatabase } from "~/repositories/__tests__/d1-test-helper";
import { getDatabase } from "~/repositories/database.server";
import type { DatabaseContext } from "~/repositories/database.server";

describe("autoSplitPlayersIntoTeams", () => {
	let db: DatabaseContext;
	let eventId: string;

	beforeEach(async () => {
		// クリーンアップとセットアップ
		await cleanupTestDatabase();
		const { context } = await setupTestDatabase();
		db = getDatabase(context);
		eventId = "test-event-1";

		// テスト用イベントを作成
		const event = await db.events.createEvent({ name: "Test Event", slug: "test-event" });
		eventId = event.id;
	});

	it("プレイヤーが2名の場合、1名ずつに分割される", async () => {
		// プレイヤーを作成
		const player1 = await db.players.createPlayer(eventId, { name: "プレイヤー1" });
		const player2 = await db.players.createPlayer(eventId, { name: "プレイヤー2" });

		// 固定のRNGを使用して決定性を確保
		let callCount = 0;
		const fixedRng = () => {
			callCount++;
			// 順番を入れ替える（Fisher-Yatesでインデックス1と0が交換される）
			return callCount === 1 ? 0.6 : 0.0;
		};

		const result = await autoSplitPlayersIntoTeams(db, eventId, {
			teamAName: "チームA",
			teamBName: "チームB",
			rng: fixedRng,
		});

		expect(result.teamA.name).toBe("チームA");
		expect(result.teamB.name).toBe("チームB");
		expect(result.teamAPlayerIds.length).toBe(1);
		expect(result.teamBPlayerIds.length).toBe(1);
		expect(result.teamAPlayerIds.length + result.teamBPlayerIds.length).toBe(2);
	});

	it("プレイヤーが3名の場合、2名と1名に分割される", async () => {
		// プレイヤーを作成
		const player1 = await db.players.createPlayer(eventId, { name: "プレイヤー1" });
		const player2 = await db.players.createPlayer(eventId, { name: "プレイヤー2" });
		const player3 = await db.players.createPlayer(eventId, { name: "プレイヤー3" });

		const result = await autoSplitPlayersIntoTeams(db, eventId, {
			teamAName: "チームA",
			teamBName: "チームB",
		});

		expect(result.teamAPlayerIds.length + result.teamBPlayerIds.length).toBe(3);
		// 人数差は1名以内
		expect(Math.abs(result.teamAPlayerIds.length - result.teamBPlayerIds.length)).toBeLessThanOrEqual(1);
	});

	it("プレイヤーが4名の場合、2名ずつに分割される", async () => {
		// プレイヤーを作成
		const player1 = await db.players.createPlayer(eventId, { name: "プレイヤー1" });
		const player2 = await db.players.createPlayer(eventId, { name: "プレイヤー2" });
		const player3 = await db.players.createPlayer(eventId, { name: "プレイヤー3" });
		const player4 = await db.players.createPlayer(eventId, { name: "プレイヤー4" });

		const result = await autoSplitPlayersIntoTeams(db, eventId, {
			teamAName: "チームA",
			teamBName: "チームB",
		});

		expect(result.teamAPlayerIds.length).toBe(2);
		expect(result.teamBPlayerIds.length).toBe(2);
		expect(result.teamAPlayerIds.length + result.teamBPlayerIds.length).toBe(4);
	});

	it("プレイヤーが1名未満の場合、エラーを投げる", async () => {
		await expect(
			autoSplitPlayersIntoTeams(db, eventId, {
				teamAName: "チームA",
				teamBName: "チームB",
			})
		).rejects.toThrow("チーム分けには少なくとも2名のプレイヤーが必要です。");
	});

	it("指定されたプレイヤーIDのみを使用して分割する", async () => {
		// プレイヤーを作成
		const player1 = await db.players.createPlayer(eventId, { name: "プレイヤー1" });
		const player2 = await db.players.createPlayer(eventId, { name: "プレイヤー2" });
		const player3 = await db.players.createPlayer(eventId, { name: "プレイヤー3" });

		const result = await autoSplitPlayersIntoTeams(db, eventId, {
			teamAName: "チームA",
			teamBName: "チームB",
			playerIds: [player1.id, player2.id],
		});

		expect(result.teamAPlayerIds.length + result.teamBPlayerIds.length).toBe(2);
		expect(result.teamAPlayerIds.includes(player1.id) || result.teamBPlayerIds.includes(player1.id)).toBe(true);
		expect(result.teamAPlayerIds.includes(player2.id) || result.teamBPlayerIds.includes(player2.id)).toBe(true);
		expect(result.teamAPlayerIds.includes(player3.id) || result.teamBPlayerIds.includes(player3.id)).toBe(false);
	});

	it("同じRNGを使用すると同じ結果になる（決定性）", async () => {
		// プレイヤーを作成
		const player1 = await db.players.createPlayer(eventId, { name: "プレイヤー1" });
		const player2 = await db.players.createPlayer(eventId, { name: "プレイヤー2" });
		const player3 = await db.players.createPlayer(eventId, { name: "プレイヤー3" });
		const player4 = await db.players.createPlayer(eventId, { name: "プレイヤー4" });

		// 固定のRNGを作成
		const createFixedRng = () => {
			let seed = 0;
			return () => {
				seed++;
				return (seed * 0.618) % 1; // 黄金比を使った疑似乱数
			};
		};

		const rng1 = createFixedRng();
		const rng2 = createFixedRng();

		const result1 = await autoSplitPlayersIntoTeams(db, eventId, {
			teamAName: "チームA",
			teamBName: "チームB",
			rng: rng1,
		});

		// 再度同じRNGで実行
		const rng3 = createFixedRng();
		const result2 = await autoSplitPlayersIntoTeams(db, eventId, {
			teamAName: "チームA",
			teamBName: "チームB",
			rng: rng3,
		});

		// チームAのプレイヤーIDをソートして比較
		const sorted1 = [...result1.teamAPlayerIds].sort();
		const sorted2 = [...result2.teamAPlayerIds].sort();

		expect(sorted1).toEqual(sorted2);
	});

	it("デフォルトのチーム名を使用する", async () => {
		// プレイヤーを作成
		await db.players.createPlayer(eventId, { name: "プレイヤー1" });
		await db.players.createPlayer(eventId, { name: "プレイヤー2" });

		const result = await autoSplitPlayersIntoTeams(db, eventId);

		expect(result.teamA.name).toBe("チームA");
		expect(result.teamB.name).toBe("チームB");
	});
});

