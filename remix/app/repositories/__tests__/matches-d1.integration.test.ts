import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { setupTestDatabase, cleanupTestDatabase, getTestDatabaseContext } from "./d1-test-helper";

describe("Matches D1 Integration Tests", () => {
	let eventId: string;
	let tournamentId: string;
	let teamBattleId: string;
	let player1Id: string;
	let player2Id: string;
	let player3Id: string;
	let player4Id: string;
	let pair1Id: string;
	let pair2Id: string;

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

		// テスト用のペアを作成
		const pair1 = await database.pairs.createPair(eventId, {
			player1_id: player1Id,
			player2_id: player2Id,
			seed: 1
		});
		const pair2 = await database.pairs.createPair(eventId, {
			player1_id: player3Id,
			player2_id: player4Id,
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

		// ペアをトーナメント参加者として登録
		await database.tournamentParticipants.addPair(tournamentId, pair1Id);
		await database.tournamentParticipants.addPair(tournamentId, pair2Id);

		// テスト用のチームを作成
		const team1 = await database.teams.createTeam(eventId, { name: "Team 1" });
		const team2 = await database.teams.createTeam(eventId, { name: "Team 2" });

		// テスト用のチームバトルを作成
		const teamBattle = await database.teamBattles.createTeamBattle(eventId, {
			team_a_id: team1.id,
			team_b_id: team2.id,
			slots_count: 3
		});
		teamBattleId = teamBattle.id;
	});

	afterEach(async () => {
		await cleanupTestDatabase();
	});

	test("should create and list matches", async () => {
		const database = getTestDatabaseContext();

		const matchData = {
			context: "bracket" as const,
			context_id: tournamentId,
			side_a_type: "pair" as const,
			side_a_pair_id: pair1Id,
			side_b_type: "pair" as const,
			side_b_pair_id: pair2Id,
			score_a: 2,
			score_b: 1,
			winner_side: "a" as const,
			status: "completed" as const
		};

		const createdMatch = await database.matches.createMatch(matchData);
		
		expect(createdMatch).toBeDefined();
		expect(createdMatch.context).toBe(matchData.context);
		expect(createdMatch.context_id).toBe(matchData.context_id);
		expect(createdMatch.side_a_type).toBe(matchData.side_a_type);
		expect(createdMatch.side_a_pair_id).toBe(matchData.side_a_pair_id);
		expect(createdMatch.side_b_type).toBe(matchData.side_b_type);
		expect(createdMatch.side_b_pair_id).toBe(matchData.side_b_pair_id);
		expect(createdMatch.score_a).toBe(matchData.score_a);
		expect(createdMatch.score_b).toBe(matchData.score_b);
		expect(createdMatch.winner_side).toBe(matchData.winner_side);
		expect(createdMatch.status).toBe(matchData.status);
		expect(createdMatch.id).toBeDefined();
		expect(createdMatch.played_at).toBeDefined();

		// マッチ一覧を取得
		const matches = await database.matches.listMatches();
		
		expect(matches).toHaveLength(1);
		expect(matches[0].id).toBe(createdMatch.id);
		expect(matches[0].context).toBe(matchData.context);
		expect(matches[0].context_id).toBe(matchData.context_id);
	});

	test("should create match with adhoc players", async () => {
		const database = getTestDatabaseContext();

		const matchData = {
			context: "teamBattle" as const,
			context_id: "team-battle-1",
			slot_index: 1,
			side_a_type: "adhoc" as const,
			side_a_player1_id: player1Id,
			side_a_player2_id: player2Id,
			side_b_type: "adhoc" as const,
			side_b_player1_id: player3Id,
			side_b_player2_id: player4Id,
			score_a: 1,
			score_b: 2,
			winner_side: "b" as const,
			status: "completed" as const
		};

		const createdMatch = await database.matches.createMatch(matchData);
		
		expect(createdMatch).toBeDefined();
		expect(createdMatch.side_a_type).toBe("adhoc");
		expect(createdMatch.side_a_player1_id).toBe(player1Id);
		expect(createdMatch.side_a_player2_id).toBe(player2Id);
		expect(createdMatch.side_b_type).toBe("adhoc");
		expect(createdMatch.side_b_player1_id).toBe(player3Id);
		expect(createdMatch.side_b_player2_id).toBe(player4Id);
		expect(createdMatch.slot_index).toBe(1);
	});

	test("should list matches by context", async () => {
		const database = getTestDatabaseContext();

		// 異なるコンテキストのマッチを作成
	const bracketMatch = await database.matches.createMatch({
		context: "bracket" as const,
		context_id: tournamentId,
		side_a_type: "pair" as const,
		side_a_pair_id: pair1Id,
		side_b_type: "pair" as const,
		side_b_pair_id: pair2Id,
		score_a: 2,
		score_b: 1,
		winner_side: "a" as const,
		status: "completed" as const
	});

	const teamBattleMatch = await database.matches.createMatch({
		context: "teamBattle" as const,
		context_id: teamBattleId,
		side_a_type: "pair" as const,
		side_a_pair_id: pair1Id,
		side_b_type: "pair" as const,
		side_b_pair_id: pair2Id,
		score_a: 1,
		score_b: 2,
		winner_side: "b" as const,
		status: "completed" as const
	});

		// コンテキスト別にマッチを取得
		const bracketMatches = await database.matches.listMatches("bracket", tournamentId);
		const teamBattleMatches = await database.matches.listMatches("teamBattle", teamBattleId);

		expect(bracketMatches).toHaveLength(1);
		expect(bracketMatches[0].id).toBe(bracketMatch.id);
		expect(bracketMatches[0].context).toBe("bracket");

		expect(teamBattleMatches).toHaveLength(1);
		expect(teamBattleMatches[0].id).toBe(teamBattleMatch.id);
		expect(teamBattleMatches[0].context).toBe("teamBattle");
	});

	test("should update match", async () => {
		const database = getTestDatabaseContext();

	const matchData = {
		context: "bracket" as const,
		context_id: tournamentId,
		side_a_type: "pair" as const,
		side_a_pair_id: pair1Id,
		side_b_type: "pair" as const,
		side_b_pair_id: pair2Id,
		score_a: 2,
		score_b: 1,
		winner_side: "a" as const,
		status: "completed" as const
	};

		const createdMatch = await database.matches.createMatch(matchData);
		
	const updateData = {
		...matchData,
		score_a: 3,
		score_b: 0,
		winner_side: "a" as const,
		status: "completed" as const
	};

		const updatedMatch = await database.matches.updateMatch(createdMatch.id, updateData);
		
		expect(updatedMatch).toBeDefined();
		expect(updatedMatch.score_a).toBe(updateData.score_a);
		expect(updatedMatch.score_b).toBe(updateData.score_b);
		expect(updatedMatch.id).toBe(createdMatch.id);

		// 更新されたマッチが正しく取得できることを確認
		const matches = await database.matches.listMatches();
		const foundMatch = matches.find(m => m.id === createdMatch.id);
		expect(foundMatch).toBeDefined();
		expect(foundMatch!.score_a).toBe(updateData.score_a);
		expect(foundMatch!.score_b).toBe(updateData.score_b);
	});

	test("should delete match", async () => {
		const database = getTestDatabaseContext();

	const matchData = {
		context: "bracket" as const,
		context_id: tournamentId,
		side_a_type: "pair" as const,
		side_a_pair_id: pair1Id,
		side_b_type: "pair" as const,
		side_b_pair_id: pair2Id,
		score_a: 2,
		score_b: 1,
		winner_side: "a" as const,
		status: "completed" as const
	};

		const createdMatch = await database.matches.createMatch(matchData);
		
		// マッチが存在することを確認
		const matchesBefore = await database.matches.listMatches();
		expect(matchesBefore).toHaveLength(1);

		// マッチを削除
		await database.matches.deleteMatch(createdMatch.id);

		// マッチが削除されたことを確認
		const matchesAfter = await database.matches.listMatches();
		expect(matchesAfter).toHaveLength(0);
	});

	test("should handle multiple matches", async () => {
		const database = getTestDatabaseContext();

		const matchesData = [
			{
				context: "bracket" as const,
				context_id: tournamentId,
				side_a_type: "pair" as const,
				side_a_pair_id: pair1Id,
				side_b_type: "pair" as const,
				side_b_pair_id: pair2Id,
				score_a: 2,
				score_b: 1,
				winner_side: "a" as const,
				status: "completed" as const
			},
			{
				context: "teamBattle" as const,
				context_id: teamBattleId,
				side_a_type: "adhoc" as const,
				side_a_player1_id: player1Id,
				side_a_player2_id: player2Id,
				side_b_type: "adhoc" as const,
				side_b_player1_id: player3Id,
				side_b_player2_id: player4Id,
				score_a: 1,
				score_b: 2,
				winner_side: "b" as const,
				status: "completed" as const
			}
		];

		// 複数のマッチを作成
		const createdMatches = [];
		for (const matchData of matchesData) {
			const createdMatch = await database.matches.createMatch(matchData);
			createdMatches.push(createdMatch);
		}

		// 全てのマッチが作成されたことを確認
		expect(createdMatches).toHaveLength(2);

		// マッチ一覧を取得
		const allMatches = await database.matches.listMatches();
		expect(allMatches).toHaveLength(2);

		// 各マッチが正しく作成されていることを確認
		for (let i = 0; i < matchesData.length; i++) {
			const match = allMatches.find(m => m.context === matchesData[i].context);
			expect(match).toBeDefined();
			expect(match!.context_id).toBe(matchesData[i].context_id);
		}
	});

	test("should list matches ordered by played_at desc", async () => {
		const database = getTestDatabaseContext();

		// 異なる時間でマッチを作成
	const match1 = await database.matches.createMatch({
		context: "bracket" as const,
		context_id: tournamentId,
		side_a_type: "pair" as const,
		side_a_pair_id: pair1Id,
		side_b_type: "pair" as const,
		side_b_pair_id: pair2Id,
		score_a: 2,
		score_b: 1,
		winner_side: "a" as const,
		status: "completed" as const,
		played_at: "2024-01-01T10:00:00Z"
	});

		// 少し待ってから次のマッチを作成
		await new Promise(resolve => setTimeout(resolve, 10));

	const match2 = await database.matches.createMatch({
		context: "bracket" as const,
		context_id: tournamentId,
		side_a_type: "pair" as const,
		side_a_pair_id: pair1Id,
		side_b_type: "pair" as const,
		side_b_pair_id: pair2Id,
		score_a: 1,
		score_b: 2,
		winner_side: "b" as const,
		status: "completed" as const
	});

		// マッチ一覧を取得
		const matches = await database.matches.listMatches();
		
		// 新しい順に並んでいることを確認（played_at DESC）
		expect(matches).toHaveLength(2);
		expect(matches[0].id).toBe(match2.id); // より新しいマッチ
		expect(matches[1].id).toBe(match1.id); // より古いマッチ
	});
});
