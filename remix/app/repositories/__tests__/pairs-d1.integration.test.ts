import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { setupTestDatabase, cleanupTestDatabase, getTestDatabaseContext } from "./d1-test-helper";

describe("Pairs D1 Integration Tests", () => {
	let eventId: string;
	let player1Id: string;
	let player2Id: string;
	let player3Id: string;

	beforeEach(async () => {
		await setupTestDatabase();
		const database = getTestDatabaseContext();
		
		// テスト用のイベントを作成
		const event = await database.events.createEvent({
			name: "Test Event",
			slug: "test-event"
		});
		eventId = event.id;

		// テスト用のプレイヤーを作成
		const player1 = await database.players.createPlayer(eventId, { name: "Player 1" });
		const player2 = await database.players.createPlayer(eventId, { name: "Player 2" });
		const player3 = await database.players.createPlayer(eventId, { name: "Player 3" });
		
		player1Id = player1.id;
		player2Id = player2.id;
		player3Id = player3.id;
	});

	afterEach(async () => {
		await cleanupTestDatabase();
	});

	test("should create and list pairs", async () => {
		const database = getTestDatabaseContext();

		const pairData = {
			player1_id: player1Id,
			player2_id: player2Id,
			seed: 1
		};

		const createdPair = await database.pairs.createPair(eventId, pairData);
		
		expect(createdPair).toBeDefined();
		expect(createdPair.player1_id).toBe(pairData.player1_id);
		expect(createdPair.player2_id).toBe(pairData.player2_id);
		expect(createdPair.seed).toBe(pairData.seed);
		expect(createdPair.event_id).toBe(eventId);
		expect(createdPair.id).toBeDefined();
		expect(createdPair.created_at).toBeDefined();

		// ペア一覧を取得
		const pairs = await database.pairs.listPairs(eventId);
		
		expect(pairs).toHaveLength(1);
		expect(pairs[0].id).toBe(createdPair.id);
		expect(pairs[0].player1_id).toBe(pairData.player1_id);
		expect(pairs[0].player2_id).toBe(pairData.player2_id);
		expect(pairs[0].seed).toBe(pairData.seed);
	});

	test("should create pair without seed", async () => {
		const database = getTestDatabaseContext();

		const pairData = {
			player1_id: player1Id,
			player2_id: player2Id
		};

		const createdPair = await database.pairs.createPair(eventId, pairData);
		
		expect(createdPair).toBeDefined();
		expect(createdPair.player1_id).toBe(pairData.player1_id);
		expect(createdPair.player2_id).toBe(pairData.player2_id);
		expect(createdPair.seed).toBeNull();
	});

	test("should update pair", async () => {
		const database = getTestDatabaseContext();

		const pairData = {
			player1_id: player1Id,
			player2_id: player2Id,
			seed: 1
		};

		const createdPair = await database.pairs.createPair(eventId, pairData);
		
		const updateData = {
			player1_id: player1Id,
			player2_id: player3Id,
			seed: 2
		};

		const updatedPair = await database.pairs.updatePair(createdPair.id, updateData);
		
		expect(updatedPair).toBeDefined();
		expect(updatedPair.player1_id).toBe(updateData.player1_id);
		expect(updatedPair.player2_id).toBe(updateData.player2_id);
		expect(updatedPair.seed).toBe(updateData.seed);
		expect(updatedPair.id).toBe(createdPair.id);

		// 更新されたペアが正しく取得できることを確認
		const pairs = await database.pairs.listPairs(eventId);
		const foundPair = pairs.find(p => p.id === createdPair.id);
		expect(foundPair).toBeDefined();
		expect(foundPair!.player2_id).toBe(updateData.player2_id);
		expect(foundPair!.seed).toBe(updateData.seed);
	});

	test("should soft delete pair", async () => {
		const database = getTestDatabaseContext();

		const pairData = {
			player1_id: player1Id,
			player2_id: player2Id
		};

		const createdPair = await database.pairs.createPair(eventId, pairData);
		
		// ペアが存在することを確認
		const pairsBefore = await database.pairs.listPairs(eventId);
		expect(pairsBefore).toHaveLength(1);

		// ペアを論理削除
		await database.pairs.deletePair(createdPair.id);

		// ペアが一覧から消えることを確認
		const pairsAfter = await database.pairs.listPairs(eventId);
		expect(pairsAfter).toHaveLength(0);

		// ensurePairでも見つからないことを確認
		await expect(database.pairs.ensurePair(createdPair.id)).rejects.toThrow('Pair not found');
	});

	test("should handle multiple pairs", async () => {
		const database = getTestDatabaseContext();

		const pairsData = [
			{ player1_id: player1Id, player2_id: player2Id, seed: 1 },
			{ player1_id: player2Id, player2_id: player3Id, seed: 2 },
			{ player1_id: player1Id, player2_id: player3Id, seed: 3 }
		];

		// 複数のペアを作成
		const createdPairs = [];
		for (const pairData of pairsData) {
			const createdPair = await database.pairs.createPair(eventId, pairData);
			createdPairs.push(createdPair);
		}

		// 全てのペアが作成されたことを確認
		expect(createdPairs).toHaveLength(3);

		// ペア一覧を取得
		const allPairs = await database.pairs.listPairs(eventId);
		expect(allPairs).toHaveLength(3);

		// 各ペアが正しく作成されていることを確認
		for (let i = 0; i < pairsData.length; i++) {
			const pair = allPairs.find(p => p.seed === pairsData[i].seed);
			expect(pair).toBeDefined();
			expect(pair!.player1_id).toBe(pairsData[i].player1_id);
			expect(pair!.player2_id).toBe(pairsData[i].player2_id);
		}
	});

	test("should list pairs ordered by seed", async () => {
		const database = getTestDatabaseContext();

		const pairsData = [
			{ player1_id: player1Id, player2_id: player2Id, seed: 3 },
			{ player1_id: player2Id, player2_id: player3Id, seed: 1 },
			{ player1_id: player1Id, player2_id: player3Id, seed: 2 }
		];

		// ペアを作成
		for (const pairData of pairsData) {
			await database.pairs.createPair(eventId, pairData);
		}

		// ペア一覧を取得
		const pairs = await database.pairs.listPairs(eventId);
		
		// シード順に並んでいることを確認
		expect(pairs).toHaveLength(3);
		expect(pairs[0].seed).toBe(1);
		expect(pairs[1].seed).toBe(2);
		expect(pairs[2].seed).toBe(3);
	});

	test("should handle pairs from different events", async () => {
		const database = getTestDatabaseContext();

		// 別のイベントとプレイヤーを作成
		const anotherEvent = await database.events.createEvent({
			name: "Another Event",
			slug: "another-event"
		});

		const anotherPlayer1 = await database.players.createPlayer(anotherEvent.id, { name: "Another Player 1" });
		const anotherPlayer2 = await database.players.createPlayer(anotherEvent.id, { name: "Another Player 2" });

		// 最初のイベントにペアを作成
		const pair1 = await database.pairs.createPair(eventId, {
			player1_id: player1Id,
			player2_id: player2Id
		});

		// 2番目のイベントにペアを作成
		const pair2 = await database.pairs.createPair(anotherEvent.id, {
			player1_id: anotherPlayer1.id,
			player2_id: anotherPlayer2.id
		});

		// 各イベントのペア一覧を取得
		const pairs1 = await database.pairs.listPairs(eventId);
		const pairs2 = await database.pairs.listPairs(anotherEvent.id);

		// 各イベントに正しいペアが含まれていることを確認
		expect(pairs1).toHaveLength(1);
		expect(pairs1[0].id).toBe(pair1.id);
		expect(pairs1[0].player1_id).toBe(player1Id);
		expect(pairs1[0].player2_id).toBe(player2Id);

		expect(pairs2).toHaveLength(1);
		expect(pairs2[0].id).toBe(pair2.id);
		expect(pairs2[0].player1_id).toBe(anotherPlayer1.id);
		expect(pairs2[0].player2_id).toBe(anotherPlayer2.id);
	});

	test("should not list deleted pairs", async () => {
		const database = getTestDatabaseContext();

		const pair1 = await database.pairs.createPair(eventId, {
			player1_id: player1Id,
			player2_id: player2Id,
			seed: 1
		});

		const pair2 = await database.pairs.createPair(eventId, {
			player1_id: player2Id,
			player2_id: player3Id,
			seed: 2
		});

		// 2つのペアが存在することを確認
		const pairsBefore = await database.pairs.listPairs(eventId);
		expect(pairsBefore).toHaveLength(2);

		// 1つ目のペアを論理削除
		await database.pairs.deletePair(pair1.id);

		// 2つ目のペアのみが残ることを確認
		const pairsAfter = await database.pairs.listPairs(eventId);
		expect(pairsAfter).toHaveLength(1);
		expect(pairsAfter[0].id).toBe(pair2.id);
	});

	test("should not allow updating deleted pair", async () => {
		const database = getTestDatabaseContext();

		const pair = await database.pairs.createPair(eventId, {
			player1_id: player1Id,
			player2_id: player2Id
		});

		await database.pairs.deletePair(pair.id);

		// 削除済みペアの更新はエラーになる
		await expect(
			database.pairs.updatePair(pair.id, {
				player1_id: player1Id,
				player2_id: player3Id
			})
		).rejects.toThrow('Pair not found');
	});
});
