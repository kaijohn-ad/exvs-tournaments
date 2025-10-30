import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { setupTestDatabase, cleanupTestDatabase, getTestDatabaseContext } from "./d1-test-helper";
import { getDatabase } from "../database.server";
import type { AppLoadContext } from "@remix-run/cloudflare";
import type { CloudflareContext } from "../../../load-context";

const createAppContext = (db?: D1Database): AppLoadContext => {
	const cloudflare: CloudflareContext = {
		env: {
			DB: (db ?? (undefined as unknown as D1Database)),
		} as Env,
		ctx: {
			waitUntil: () => {},
			passThroughOnException: () => {},
			props: {},
		},
		caches: (globalThis as unknown as { caches?: CacheStorage }).caches || ({} as CacheStorage),
		cf: {} as Request["cf"],
	};

	return {
		cloudflare,
		db,
	} as AppLoadContext;
};

describe("Database Factory D1 Integration Tests", () => {
	let testDb: D1Database;
	let testContext: AppLoadContext;

	beforeEach(async () => {
		const setup = await setupTestDatabase();
		testDb = setup.db;
		testContext = setup.context;
	});

	afterEach(async () => {
		await cleanupTestDatabase();
	});

	test("should use D1 database when binding is available", async () => {
		const database = getDatabase(testContext);

		// イベントを作成してD1データベースが使用されていることを確認
		const event = await database.events.createEvent({
			name: "Test Event",
			slug: "test-event"
		});

		expect(event).toBeDefined();
		expect(event.name).toBe("Test Event");
		expect(event.slug).toBe("test-event");

		// イベント一覧を取得
		const events = await database.events.listEvents();
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(event.id);
	});

	test("should fallback to memory database when D1 binding is unavailable", async () => {
		// D1バインディングなしのコンテキストを作成
	const contextWithoutD1 = createAppContext();

		const database = getDatabase(contextWithoutD1);

		// メモリデータベースが使用されていることを確認
		const event = await database.events.createEvent({
			name: "Memory Event",
			slug: "memory-event"
		});

		expect(event).toBeDefined();
		expect(event.name).toBe("Memory Event");

		// メモリデータベースでも正常に動作することを確認
		const events = await database.events.listEvents();
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(event.id);
	});

	test("should force memory database when useMemory option is set", async () => {
		const database = getDatabase(testContext, { useMemory: true });

		// メモリデータベースが使用されていることを確認
		const event = await database.events.createEvent({
			name: "Forced Memory Event",
			slug: "forced-memory-event"
		});

		expect(event).toBeDefined();
		expect(event.name).toBe("Forced Memory Event");

		// メモリデータベースでも正常に動作することを確認
		const events = await database.events.listEvents();
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(event.id);
	});

	test("should handle all repository types with D1", async () => {
		const database = getDatabase(testContext);

		// イベントを作成
		const event = await database.events.createEvent({
			name: "Integration Test Event",
			slug: "integration-test-event"
		});

		// プレイヤーを作成
		const player1 = await database.players.createPlayer(event.id, { name: "Player 1" });
		const player2 = await database.players.createPlayer(event.id, { name: "Player 2" });

		// ペアを作成
		const pair = await database.pairs.createPair(event.id, {
			player1_id: player1.id,
			player2_id: player2.id,
			seed: 1
		});

		// トーナメントを作成
		const tournament = await database.tournaments.createTournament(event.id, {
			name: "Test Tournament"
		});

		// チームを作成
		const team = await database.teams.createTeam(event.id, { name: "Test Team" });

		// チームメンバーを追加
		await database.teams.addTeamMember(team.id, player1.id);

		// チームバトルを作成
		const teamBattle = await database.teamBattles.createTeamBattle(event.id, {
			team_a_id: team.id,
			team_b_id: team.id,
			slots_count: 3
		});

		// チームバトルスロットを作成
		const slot = await database.teamBattleSlots.createTeamBattleSlot({
			team_battle_id: teamBattle.id,
			team_id: team.id,
			slot_index: 1,
			assignment_type: "pair",
			pair_id: pair.id
		});

		// マッチを作成
		const match = await database.matches.createMatch({
			context: "bracket",
			context_id: tournament.id,
			side_a_type: "pair",
			side_a_pair_id: pair.id,
			side_b_type: "pair",
			side_b_pair_id: pair.id,
			score_a: 2,
			score_b: 1,
			winner_side: "a",
			status: "completed"
		});

		// ブラケットマッチを作成
		const bracketMatch = await database.bracketMatches.createBracketMatch(tournament.id, {
			round: 1,
			position: 1,
			participant_a_type: "pair",
			participant_a_pair_id: pair.id,
			participant_b_type: "pair",
			participant_b_pair_id: pair.id
		});

		// プレイヤー統計を作成
		const playerStats = await database.playerStats.createPlayerStats({
			scope: "event",
			scope_id: event.id,
			player_id: player1.id,
			wins: 1,
			losses: 0
		});

		// 全てのリポジトリが正常に動作することを確認
		expect(event).toBeDefined();
		expect(player1).toBeDefined();
		expect(player2).toBeDefined();
		expect(pair).toBeDefined();
		expect(tournament).toBeDefined();
		expect(team).toBeDefined();
		expect(teamBattle).toBeDefined();
		expect(slot).toBeDefined();
		expect(match).toBeDefined();
		expect(bracketMatch).toBeDefined();
		expect(playerStats).toBeDefined();

		// 各リポジトリの一覧取得が正常に動作することを確認
		const events = await database.events.listEvents();
		const players = await database.players.listPlayers(event.id);
		const pairs = await database.pairs.listPairs(event.id);
		const tournaments = await database.tournaments.listTournaments(event.id);
		const teams = await database.teams.listTeams(event.id);
		const teamBattles = await database.teamBattles.listTeamBattles(event.id);
		const slots = await database.teamBattleSlots.listTeamBattleSlots(teamBattle.id);
		const matches = await database.matches.listMatches();
		const bracketMatches = await database.bracketMatches.listBracketMatches(tournament.id);
		const stats = await database.playerStats.listPlayerStats("event", event.id);

		expect(events).toHaveLength(1);
		expect(players).toHaveLength(2);
		expect(pairs).toHaveLength(1);
		expect(tournaments).toHaveLength(1);
		expect(teams).toHaveLength(1);
		expect(teamBattles).toHaveLength(1);
		expect(slots).toHaveLength(1);
		expect(matches).toHaveLength(1);
		expect(bracketMatches).toHaveLength(1);
		expect(stats).toHaveLength(1);
	});

	test("should handle database operations with transactions", async () => {
		const database = getDatabase(testContext);

		// イベントを作成
		const event = await database.events.createEvent({
			name: "Transaction Test Event",
			slug: "transaction-test-event"
		});

		// 複数のプレイヤーを作成
		const players = [];
		for (let i = 1; i <= 5; i++) {
			const player = await database.players.createPlayer(event.id, {
				name: `Player ${i}`
			});
			players.push(player);
		}

		// 複数のペアを作成
		const pairs = [];
		for (let i = 0; i < players.length - 1; i += 2) {
			const pair = await database.pairs.createPair(event.id, {
				player1_id: players[i].id,
				player2_id: players[i + 1].id,
				seed: Math.floor(i / 2) + 1
			});
			pairs.push(pair);
		}

		// 複数のマッチを作成
		const matches = [];
		for (let i = 0; i < pairs.length; i++) {
			const match = await database.matches.createMatch({
				context: "bracket",
				context_id: "tournament-1",
				side_a_type: "pair",
				side_a_pair_id: pairs[i].id,
				side_b_type: "pair",
				side_b_pair_id: pairs[i].id,
				score_a: Math.floor(Math.random() * 3) + 1,
				score_b: Math.floor(Math.random() * 3) + 1,
				winner_side: Math.random() > 0.5 ? "a" : "b",
				status: "completed"
			});
			matches.push(match);
		}

		// 全ての操作が正常に完了したことを確認
		const allEvents = await database.events.listEvents();
		const allPlayers = await database.players.listPlayers(event.id);
		const allPairs = await database.pairs.listPairs(event.id);
		const allMatches = await database.matches.listMatches();

		expect(allEvents).toHaveLength(1);
		expect(allPlayers).toHaveLength(5);
		expect(allPairs).toHaveLength(2);
		expect(allMatches).toHaveLength(2);
	});

	test("should handle error cases gracefully", async () => {
		const database = getDatabase(testContext);
    // 明示的にイベントを作成してスコープ内で参照できるようにする
    const localEvent = await database.events.createEvent({ name: "Err Case Event", slug: "err-case-event" });

		// 存在しないイベントIDでプレイヤーを作成しようとする
		await expect(
			database.players.createPlayer("non-existent-event-id", { name: "Test Player" })
		).rejects.toThrow();

		// 存在しないプレイヤーIDでペアを作成しようとする
    await expect(
        database.pairs.createPair(localEvent.id, {
				player1_id: "non-existent-player-1",
				player2_id: "non-existent-player-2"
			})
		).rejects.toThrow();

		// 存在しないペアIDでマッチを作成しようとする
		await expect(
			database.matches.createMatch({
				context: "bracket",
				context_id: "tournament-1",
				side_a_type: "pair",
				side_a_pair_id: "non-existent-pair-id",
				side_b_type: "pair",
				side_b_pair_id: "non-existent-pair-id",
				score_a: 2,
				score_b: 1,
				winner_side: "a",
				status: "completed"
			})
		).rejects.toThrow();
	});
});
