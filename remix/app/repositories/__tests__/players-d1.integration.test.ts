import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { setupTestDatabase, cleanupTestDatabase, getTestDatabaseContext } from "./d1-test-helper";

describe("Players D1 Integration Tests", () => {
	let eventId: string;

	beforeEach(async () => {
		await setupTestDatabase();
		const database = getTestDatabaseContext();
		
		// テスト用のイベントを作成
		const event = await database.events.createEvent({
			name: "Test Event",
			slug: "test-event"
		});
		eventId = event.id;
	});

	afterEach(async () => {
		await cleanupTestDatabase();
	});

	test("should create and list players", async () => {
		const database = getTestDatabaseContext();

		const playerData = {
			name: "Test Player",
			note: "Test note"
		};

		const createdPlayer = await database.players.createPlayer(eventId, playerData);
		
		expect(createdPlayer).toBeDefined();
		expect(createdPlayer.name).toBe(playerData.name);
		expect(createdPlayer.note).toBe(playerData.note);
		expect(createdPlayer.event_id).toBe(eventId);
		expect(createdPlayer.id).toBeDefined();
		expect(createdPlayer.created_at).toBeDefined();

		// プレイヤー一覧を取得
		const players = await database.players.listPlayers(eventId);
		
		expect(players).toHaveLength(1);
		expect(players[0].id).toBe(createdPlayer.id);
		expect(players[0].name).toBe(playerData.name);
		expect(players[0].note).toBe(playerData.note);
	});

	test("should create player without note", async () => {
		const database = getTestDatabaseContext();

		const playerData = {
			name: "Player Without Note"
		};

		const createdPlayer = await database.players.createPlayer(eventId, playerData);
		
		expect(createdPlayer).toBeDefined();
		expect(createdPlayer.name).toBe(playerData.name);
		expect(createdPlayer.note).toBeNull();
	});

	test("should update player", async () => {
		const database = getTestDatabaseContext();

		const playerData = {
			name: "Original Player Name",
			note: "Original note"
		};

		const createdPlayer = await database.players.createPlayer(eventId, playerData);
		
		const updateData = {
			name: "Updated Player Name",
			note: "Updated note"
		};

		const updatedPlayer = await database.players.updatePlayer(createdPlayer.id, updateData);
		
		expect(updatedPlayer).toBeDefined();
		expect(updatedPlayer.name).toBe(updateData.name);
		expect(updatedPlayer.note).toBe(updateData.note);
		expect(updatedPlayer.id).toBe(createdPlayer.id);

		// 更新されたプレイヤーが正しく取得できることを確認
		const players = await database.players.listPlayers(eventId);
		const foundPlayer = players.find(p => p.id === createdPlayer.id);
		expect(foundPlayer).toBeDefined();
		expect(foundPlayer!.name).toBe(updateData.name);
	});

	test("should delete player", async () => {
		const database = getTestDatabaseContext();

		const playerData = {
			name: "Player To Delete",
			note: "Delete me"
		};

		const createdPlayer = await database.players.createPlayer(eventId, playerData);
		
		// プレイヤーが存在することを確認
		const playersBefore = await database.players.listPlayers(eventId);
		expect(playersBefore).toHaveLength(1);

		// プレイヤーを削除
		await database.players.deletePlayer(createdPlayer.id);

		// プレイヤーが削除されたことを確認
		const playersAfter = await database.players.listPlayers(eventId);
		expect(playersAfter).toHaveLength(0);
	});

	test("should handle multiple players", async () => {
		const database = getTestDatabaseContext();

		const playersData = [
			{ name: "Player 1", note: "Note 1" },
			{ name: "Player 2", note: "Note 2" },
			{ name: "Player 3", note: "Note 3" }
		];

		// 複数のプレイヤーを作成
		const createdPlayers = [];
		for (const playerData of playersData) {
			const createdPlayer = await database.players.createPlayer(eventId, playerData);
			createdPlayers.push(createdPlayer);
		}

		// 全てのプレイヤーが作成されたことを確認
		expect(createdPlayers).toHaveLength(3);

		// プレイヤー一覧を取得
		const allPlayers = await database.players.listPlayers(eventId);
		expect(allPlayers).toHaveLength(3);

		// 各プレイヤーが正しく作成されていることを確認
		for (let i = 0; i < playersData.length; i++) {
			const player = allPlayers.find(p => p.name === playersData[i].name);
			expect(player).toBeDefined();
			expect(player!.note).toBe(playersData[i].note);
		}
	});

	test("should list players in alphabetical order", async () => {
		const database = getTestDatabaseContext();

		const playersData = [
			{ name: "Charlie", note: "C" },
			{ name: "Alice", note: "A" },
			{ name: "Bob", note: "B" }
		];

		// プレイヤーを作成
		for (const playerData of playersData) {
			await database.players.createPlayer(eventId, playerData);
		}

		// プレイヤー一覧を取得
		const players = await database.players.listPlayers(eventId);
		
		// アルファベット順に並んでいることを確認
		expect(players).toHaveLength(3);
		expect(players[0].name).toBe("Alice");
		expect(players[1].name).toBe("Bob");
		expect(players[2].name).toBe("Charlie");
	});

	test("should handle players from different events", async () => {
		const database = getTestDatabaseContext();

		// 別のイベントを作成
		const anotherEvent = await database.events.createEvent({
			name: "Another Event",
			slug: "another-event"
		});

		// 最初のイベントにプレイヤーを作成
		const player1 = await database.players.createPlayer(eventId, {
			name: "Player in Event 1"
		});

		// 2番目のイベントにプレイヤーを作成
		const player2 = await database.players.createPlayer(anotherEvent.id, {
			name: "Player in Event 2"
		});

		// 各イベントのプレイヤー一覧を取得
		const players1 = await database.players.listPlayers(eventId);
		const players2 = await database.players.listPlayers(anotherEvent.id);

		// 各イベントに正しいプレイヤーが含まれていることを確認
		expect(players1).toHaveLength(1);
		expect(players1[0].id).toBe(player1.id);
		expect(players1[0].name).toBe("Player in Event 1");

		expect(players2).toHaveLength(1);
		expect(players2[0].id).toBe(player2.id);
		expect(players2[0].name).toBe("Player in Event 2");
	});
});
