import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { setupTestDatabase, cleanupTestDatabase, getTestDatabaseContext } from "./d1-test-helper";

describe("Tournament Participants D1 Integration Tests", () => {
	let eventId: string;
	let tournamentId: string;
	let pair1Id: string;
	let pair2Id: string;
	let player1Id: string;
	let player2Id: string;

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
		const player4 = await database.players.createPlayer(eventId, { name: "Player 4" });
		
		player1Id = player1.id;
		player2Id = player2.id;

		// テスト用のペアを作成
		const pair1 = await database.pairs.createPair(eventId, {
			player1_id: player1Id,
			player2_id: player2Id,
			seed: 1
		});
		const pair2 = await database.pairs.createPair(eventId, {
			player1_id: player3.id,
			player2_id: player4.id,
			seed: 2
		});
		
		pair1Id = pair1.id;
		pair2Id = pair2.id;

		// テスト用のトーナメントを作成
		const tournament = await database.tournaments.createTournament(eventId, {
			name: "Test Tournament",
			entryMode: "pair"
		});
		tournamentId = tournament.id;
	});

	afterEach(async () => {
		await cleanupTestDatabase();
	});

	test("should add and list pair participants", async () => {
		const database = getTestDatabaseContext();

		const participant = await database.tournamentParticipants.addPair(tournamentId, pair1Id, { seed: 1 });
		
		expect(participant).toBeDefined();
		expect(participant.participant_type).toBe("pair");
		expect(participant.pair_id).toBe(pair1Id);
		expect(participant.player_id).toBeNull();
		expect(participant.seed).toBe(1);
		expect(participant.status).toBe("active");

		// 参加者一覧を取得
		const participants = await database.tournamentParticipants.listParticipants(tournamentId);
		
		expect(participants).toHaveLength(1);
		expect(participants[0].id).toBe(participant.id);
		expect(participants[0].pair_id).toBe(pair1Id);
	});

	test("should add and list solo participants", async () => {
		const database = getTestDatabaseContext();

		// トーナメントを個別参加モードに変更
		await database.tournaments.updateTournament(tournamentId, {
			name: "Test Tournament",
			entryMode: "solo"
		});

		const participant = await database.tournamentParticipants.addSolo(tournamentId, player1Id);
		
		expect(participant).toBeDefined();
		expect(participant.participant_type).toBe("solo");
		expect(participant.player_id).toBe(player1Id);
		expect(participant.pair_id).toBeNull();
		expect(participant.status).toBe("active");

		// 参加者一覧を取得
		const participants = await database.tournamentParticipants.listParticipants(tournamentId);
		
		expect(participants).toHaveLength(1);
		expect(participants[0].id).toBe(participant.id);
		expect(participants[0].player_id).toBe(player1Id);
	});

	test("should prevent duplicate pair participants", async () => {
		const database = getTestDatabaseContext();

		await database.tournamentParticipants.addPair(tournamentId, pair1Id);

		// 同じペアを再度追加しようとするとエラー
		await expect(
			database.tournamentParticipants.addPair(tournamentId, pair1Id)
		).rejects.toThrow("このペアは既に参加登録されています。");
	});

	test("should prevent duplicate solo participants", async () => {
		const database = getTestDatabaseContext();

		// トーナメントを個別参加モードに変更
		await database.tournaments.updateTournament(tournamentId, {
			name: "Test Tournament",
			entryMode: "solo"
		});

		await database.tournamentParticipants.addSolo(tournamentId, player1Id);

		// 同じプレイヤーを再度追加しようとするとエラー
		await expect(
			database.tournamentParticipants.addSolo(tournamentId, player1Id)
		).rejects.toThrow("このプレイヤーは既に参加登録されています。");
	});

	test("should remove participant", async () => {
		const database = getTestDatabaseContext();

		const participant = await database.tournamentParticipants.addPair(tournamentId, pair1Id);
		
		// 参加者が存在することを確認
		const participantsBefore = await database.tournamentParticipants.listParticipants(tournamentId);
		expect(participantsBefore).toHaveLength(1);

		// 参加者を削除
		await database.tournamentParticipants.removeById(tournamentId, participant.id);

		// 参加者が削除されたことを確認
		const participantsAfter = await database.tournamentParticipants.listParticipants(tournamentId);
		expect(participantsAfter).toHaveLength(0);
	});

	test("should set seed for pair participant", async () => {
		const database = getTestDatabaseContext();

		const participant = await database.tournamentParticipants.addPair(tournamentId, pair1Id);
		
		// シードを設定
		const updated = await database.tournamentParticipants.setSeed(tournamentId, participant.id, 5);
		
		expect(updated.seed).toBe(5);

		// シードが更新されたことを確認
		const participants = await database.tournamentParticipants.listParticipants(tournamentId);
		expect(participants[0].seed).toBe(5);
	});

	test("should clear seed for pair participant", async () => {
		const database = getTestDatabaseContext();

		const participant = await database.tournamentParticipants.addPair(tournamentId, pair1Id, { seed: 3 });
		
		// シードをクリア
		const updated = await database.tournamentParticipants.setSeed(tournamentId, participant.id, null);
		
		expect(updated.seed).toBeNull();

		// シードがクリアされたことを確認
		const participants = await database.tournamentParticipants.listParticipants(tournamentId);
		expect(participants[0].seed).toBeNull();
	});

	test("should count participants", async () => {
		const database = getTestDatabaseContext();

		expect(await database.tournamentParticipants.count(tournamentId)).toBe(0);

		await database.tournamentParticipants.addPair(tournamentId, pair1Id);
		expect(await database.tournamentParticipants.count(tournamentId)).toBe(1);

		await database.tournamentParticipants.addPair(tournamentId, pair2Id);
		expect(await database.tournamentParticipants.count(tournamentId)).toBe(2);
	});

	test("should validate pair belongs to same event", async () => {
		const database = getTestDatabaseContext();

		// 別のイベントを作成
		const anotherEvent = await database.events.createEvent({
			name: "Another Event",
			slug: "another-event"
		});

		// 別のイベントのプレイヤーでペアを作成
		const playerA = await database.players.createPlayer(anotherEvent.id, { name: "Player A" });
		const playerB = await database.players.createPlayer(anotherEvent.id, { name: "Player B" });
		const anotherPair = await database.pairs.createPair(anotherEvent.id, {
			player1_id: playerA.id,
			player2_id: playerB.id
		});

		// 異なるイベントのペアを追加しようとするとエラー
		await expect(
			database.tournamentParticipants.addPair(tournamentId, anotherPair.id)
		).rejects.toThrow("ペアは同じイベントに属している必要があります。");
	});

	test("should validate player belongs to same event", async () => {
		const database = getTestDatabaseContext();

		// トーナメントを個別参加モードに変更
		await database.tournaments.updateTournament(tournamentId, {
			name: "Test Tournament",
			entryMode: "solo"
		});

		// 別のイベントを作成
		const anotherEvent = await database.events.createEvent({
			name: "Another Event",
			slug: "another-event"
		});

		// 別のイベントのプレイヤーを作成
		const anotherPlayer = await database.players.createPlayer(anotherEvent.id, { name: "Player X" });

		// 異なるイベントのプレイヤーを追加しようとするとエラー
		await expect(
			database.tournamentParticipants.addSolo(tournamentId, anotherPlayer.id)
		).rejects.toThrow("プレイヤーは同じイベントに属している必要があります。");
	});

	test("should list participants sorted by seed", async () => {
		const database = getTestDatabaseContext();

		await database.tournamentParticipants.addPair(tournamentId, pair1Id, { seed: 3 });
		await database.tournamentParticipants.addPair(tournamentId, pair2Id, { seed: 1 });
		
		// 3番目のペアを作成（シードなし）
		const player5 = await database.players.createPlayer(eventId, { name: "Player 5" });
		const player6 = await database.players.createPlayer(eventId, { name: "Player 6" });
		const pair3 = await database.pairs.createPair(eventId, {
			player1_id: player5.id,
			player2_id: player6.id
		});
		await database.tournamentParticipants.addPair(tournamentId, pair3.id, { seed: 2 });

		const participants = await database.tournamentParticipants.listParticipants(tournamentId);
		
		expect(participants).toHaveLength(3);
		expect(participants[0].seed).toBe(1);
		expect(participants[1].seed).toBe(2);
		expect(participants[2].seed).toBe(3);
	});
});

