import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { setupTestDatabase, cleanupTestDatabase, getTestDatabaseContext } from "./d1-test-helper";

describe("FFA Groups D1 Integration Tests", () => {
	let eventId: string;
	let tournamentId: string;
	let player1Id: string;
	let player2Id: string;
	let player3Id: string;
	let player4Id: string;

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
		player3Id = player3.id;
		player4Id = player4.id;

		// テスト用のトーナメントを作成（FFA 2-up形式）
		const tournament = await database.tournaments.createTournament(eventId, {
			name: "Test FFA Tournament",
			format: "ffa-2up",
			entryMode: "solo"
		});
		tournamentId = tournament.id;

		// 参加者を登録
		await database.tournamentParticipants.addSolo(tournamentId, player1Id);
		await database.tournamentParticipants.addSolo(tournamentId, player2Id);
		await database.tournamentParticipants.addSolo(tournamentId, player3Id);
		await database.tournamentParticipants.addSolo(tournamentId, player4Id);
	});

	afterEach(async () => {
		await cleanupTestDatabase();
	});

	test("should create and list FFA groups", async () => {
		const database = getTestDatabaseContext();

		const groupData = {
			round: 1,
			position: 1,
			participant_1_type: 'player' as const,
			participant_1_player_id: player1Id,
			participant_2_type: 'player' as const,
			participant_2_player_id: player2Id,
			participant_3_type: 'player' as const,
			participant_3_player_id: player3Id,
			participant_4_type: 'player' as const,
			participant_4_player_id: player4Id,
			status: 'pending' as const,
			winner1_player_id: null,
			winner2_player_id: null
		};

		const createdGroup = await database.ffaGroups.createFfaGroup(tournamentId, groupData);
		
		expect(createdGroup).toBeDefined();
		expect(createdGroup.tournament_id).toBe(tournamentId);
		expect(createdGroup.round).toBe(1);
		expect(createdGroup.position).toBe(1);
		expect(createdGroup.participant_1_player_id).toBe(player1Id);
		expect(createdGroup.participant_2_player_id).toBe(player2Id);
		expect(createdGroup.participant_3_player_id).toBe(player3Id);
		expect(createdGroup.participant_4_player_id).toBe(player4Id);
		expect(createdGroup.status).toBe('pending');
		expect(createdGroup.winner1_player_id).toBeNull();
		expect(createdGroup.winner2_player_id).toBeNull();

		// グループ一覧を取得
		const groups = await database.ffaGroups.listFfaGroups(tournamentId);
		
		expect(groups).toHaveLength(1);
		expect(groups[0].id).toBe(createdGroup.id);
	});

	test("should update FFA group with winners", async () => {
		const database = getTestDatabaseContext();

		const groupData = {
			round: 1,
			position: 1,
			participant_1_type: 'player' as const,
			participant_1_player_id: player1Id,
			participant_2_type: 'player' as const,
			participant_2_player_id: player2Id,
			participant_3_type: 'player' as const,
			participant_3_player_id: player3Id,
			participant_4_type: 'player' as const,
			participant_4_player_id: player4Id,
			status: 'pending' as const,
			winner1_player_id: null,
			winner2_player_id: null
		};

		const createdGroup = await database.ffaGroups.createFfaGroup(tournamentId, groupData);

		// 勝者を記録
		const updatedGroup = await database.ffaGroups.updateFfaGroup(tournamentId, createdGroup.id, {
			status: 'completed',
			winner1_player_id: player1Id,
			winner2_player_id: player2Id
		});

		expect(updatedGroup.status).toBe('completed');
		expect(updatedGroup.winner1_player_id).toBe(player1Id);
		expect(updatedGroup.winner2_player_id).toBe(player2Id);
	});

	test("should set multiple FFA groups", async () => {
		const database = getTestDatabaseContext();

		const groups = [
			{
				round: 1,
				position: 1,
				participant_1_type: 'player' as const,
				participant_1_player_id: player1Id,
				participant_2_type: 'player' as const,
				participant_2_player_id: player2Id,
				participant_3_type: 'player' as const,
				participant_3_player_id: player3Id,
				participant_4_type: 'player' as const,
				participant_4_player_id: player4Id,
				status: 'pending' as const,
				winner1_player_id: null,
				winner2_player_id: null
			},
			{
				round: 2,
				position: 1,
				participant_1_type: 'empty' as const,
				participant_1_player_id: null,
				participant_2_type: 'empty' as const,
				participant_2_player_id: null,
				participant_3_type: 'empty' as const,
				participant_3_player_id: null,
				participant_4_type: 'empty' as const,
				participant_4_player_id: null,
				status: 'pending' as const,
				winner1_player_id: null,
				winner2_player_id: null
			}
		];

		const result = await database.ffaGroups.setFfaGroups(tournamentId, groups);
		
		expect(result).toHaveLength(2);
		expect(result[0].round).toBe(1);
		expect(result[1].round).toBe(2);

		// 一覧を取得して確認
		const listedGroups = await database.ffaGroups.listFfaGroups(tournamentId);
		expect(listedGroups).toHaveLength(2);
	});

	test("should clear FFA groups", async () => {
		const database = getTestDatabaseContext();

		const groupData = {
			round: 1,
			position: 1,
			participant_1_type: 'player' as const,
			participant_1_player_id: player1Id,
			participant_2_type: 'player' as const,
			participant_2_player_id: player2Id,
			participant_3_type: 'player' as const,
			participant_3_player_id: player3Id,
			participant_4_type: 'player' as const,
			participant_4_player_id: player4Id,
			status: 'pending' as const,
			winner1_player_id: null,
			winner2_player_id: null
		};

		await database.ffaGroups.createFfaGroup(tournamentId, groupData);
		
		// グループが存在することを確認
		const groupsBefore = await database.ffaGroups.listFfaGroups(tournamentId);
		expect(groupsBefore).toHaveLength(1);

		// グループをクリア
		await database.ffaGroups.clearFfaGroups(tournamentId);

		// グループが削除されたことを確認
		const groupsAfter = await database.ffaGroups.listFfaGroups(tournamentId);
		expect(groupsAfter).toHaveLength(0);
	});

	test("should ensure FFA group exists", async () => {
		const database = getTestDatabaseContext();

		const groupData = {
			round: 1,
			position: 1,
			participant_1_type: 'player' as const,
			participant_1_player_id: player1Id,
			participant_2_type: 'player' as const,
			participant_2_player_id: player2Id,
			participant_3_type: 'player' as const,
			participant_3_player_id: player3Id,
			participant_4_type: 'player' as const,
			participant_4_player_id: player4Id,
			status: 'pending' as const,
			winner1_player_id: null,
			winner2_player_id: null
		};

		const createdGroup = await database.ffaGroups.createFfaGroup(tournamentId, groupData);

		const ensuredGroup = await database.ffaGroups.ensureFfaGroup(tournamentId, createdGroup.id);
		
		expect(ensuredGroup.id).toBe(createdGroup.id);
		expect(ensuredGroup.round).toBe(1);
		expect(ensuredGroup.position).toBe(1);
	});

	test("should throw error when ensuring non-existent group", async () => {
		const database = getTestDatabaseContext();

		await expect(
			database.ffaGroups.ensureFfaGroup(tournamentId, "non-existent-id")
		).rejects.toThrow("FFA group not found");
	});

	test("should validate player participants", async () => {
		const database = getTestDatabaseContext();

		// 異なるイベントのプレイヤーを作成
		const otherEvent = await database.events.createEvent({
			name: "Other Event",
			slug: "other-event"
		});
		const otherPlayer = await database.players.createPlayer(otherEvent.id, { name: "Other Player" });

		const groupData = {
			round: 1,
			position: 1,
			participant_1_type: 'player' as const,
			participant_1_player_id: otherPlayer.id, // 異なるイベントのプレイヤー
			participant_2_type: 'player' as const,
			participant_2_player_id: player2Id,
			participant_3_type: 'player' as const,
			participant_3_player_id: player3Id,
			participant_4_type: 'player' as const,
			participant_4_player_id: player4Id,
			status: 'pending' as const,
			winner1_player_id: null,
			winner2_player_id: null
		};

		// 異なるイベントのプレイヤーを使用するとエラーになる
		await expect(
			database.ffaGroups.createFfaGroup(tournamentId, groupData)
		).rejects.toThrow();
	});
});

