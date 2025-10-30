import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { setupTestDatabase, cleanupTestDatabase, getTestDatabaseContext } from "./d1-test-helper";

describe("Tournaments D1 Integration Tests", () => {
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

	test("should create and list tournaments", async () => {
		const database = getTestDatabaseContext();

		const tournamentData = {
			name: "Test Tournament",
			format: "single-elimination" as const,
			seedingMode: "random" as const
		};

		const createdTournament = await database.tournaments.createTournament(eventId, tournamentData);
		
		expect(createdTournament).toBeDefined();
		expect(createdTournament.name).toBe(tournamentData.name);
		expect(createdTournament.format).toBe(tournamentData.format);
		expect(createdTournament.seedingMode).toBe(tournamentData.seedingMode);
		expect(createdTournament.eventId).toBe(eventId);
		expect(createdTournament.id).toBeDefined();
		expect(createdTournament.createdAt).toBeDefined();

		// トーナメント一覧を取得
		const tournaments = await database.tournaments.listTournaments(eventId);
		
		expect(tournaments).toHaveLength(1);
		expect(tournaments[0].id).toBe(createdTournament.id);
		expect(tournaments[0].name).toBe(tournamentData.name);
		expect(tournaments[0].format).toBe(tournamentData.format);
		expect(tournaments[0].seedingMode).toBe(tournamentData.seedingMode);
	});

	test("should create tournament with default values", async () => {
		const database = getTestDatabaseContext();

		const tournamentData = {
			name: "Default Tournament"
		};

		const createdTournament = await database.tournaments.createTournament(eventId, tournamentData);
		
		expect(createdTournament).toBeDefined();
		expect(createdTournament.name).toBe(tournamentData.name);
		expect(createdTournament.format).toBe("single-elimination");
		expect(createdTournament.seedingMode).toBe("random");
		expect(createdTournament.entryMode).toBe("pair");
	});

	test("should create tournament with entry mode", async () => {
		const database = getTestDatabaseContext();

		const tournamentData = {
			name: "Solo Tournament",
			entryMode: "solo" as const
		};

		const createdTournament = await database.tournaments.createTournament(eventId, tournamentData);
		
		expect(createdTournament).toBeDefined();
		expect(createdTournament.entryMode).toBe("solo");
	});

	test("should update tournament", async () => {
		const database = getTestDatabaseContext();

		const tournamentData = {
			name: "Original Tournament Name",
			format: "single-elimination" as const,
			seedingMode: "random" as const
		};

		const createdTournament = await database.tournaments.createTournament(eventId, tournamentData);
		
		const updateData = {
			name: "Updated Tournament Name",
			format: "single-elimination" as const,
			seedingMode: "manual" as const,
			entryMode: "solo" as const
		};

		const updatedTournament = await database.tournaments.updateTournament(createdTournament.id, updateData);
		
		expect(updatedTournament).toBeDefined();
		expect(updatedTournament.name).toBe(updateData.name);
		expect(updatedTournament.seedingMode).toBe(updateData.seedingMode);
		expect(updatedTournament.entryMode).toBe(updateData.entryMode);
		expect(updatedTournament.id).toBe(createdTournament.id);

		// 更新されたトーナメントが正しく取得できることを確認
		const tournaments = await database.tournaments.listTournaments(eventId);
		const foundTournament = tournaments.find(t => t.id === createdTournament.id);
		expect(foundTournament).toBeDefined();
		expect(foundTournament!.name).toBe(updateData.name);
		expect(foundTournament!.seedingMode).toBe(updateData.seedingMode);
	});

	test("should delete tournament", async () => {
		const database = getTestDatabaseContext();

		const tournamentData = {
			name: "Tournament To Delete"
		};

		const createdTournament = await database.tournaments.createTournament(eventId, tournamentData);
		
		// トーナメントが存在することを確認
		const tournamentsBefore = await database.tournaments.listTournaments(eventId);
		expect(tournamentsBefore).toHaveLength(1);

		// トーナメントを削除
		await database.tournaments.deleteTournament(createdTournament.id);

		// トーナメントが削除されたことを確認
		const tournamentsAfter = await database.tournaments.listTournaments(eventId);
		expect(tournamentsAfter).toHaveLength(0);
	});

	test("should handle multiple tournaments", async () => {
		const database = getTestDatabaseContext();

		const tournamentsData = [
			{ name: "Tournament 1", format: "single-elimination" as const, seedingMode: "random" as const },
			{ name: "Tournament 2", format: "single-elimination" as const, seedingMode: "manual" as const },
			{ name: "Tournament 3", format: "single-elimination" as const, seedingMode: "random" as const }
		];

		// 複数のトーナメントを作成
		const createdTournaments = [];
		for (const tournamentData of tournamentsData) {
			const createdTournament = await database.tournaments.createTournament(eventId, tournamentData);
			createdTournaments.push(createdTournament);
		}

		// 全てのトーナメントが作成されたことを確認
		expect(createdTournaments).toHaveLength(3);

		// トーナメント一覧を取得
		const allTournaments = await database.tournaments.listTournaments(eventId);
		expect(allTournaments).toHaveLength(3);

		// 各トーナメントが正しく作成されていることを確認
		for (let i = 0; i < tournamentsData.length; i++) {
			const tournament = allTournaments.find(t => t.name === tournamentsData[i].name);
			expect(tournament).toBeDefined();
			expect(tournament!.format).toBe(tournamentsData[i].format);
			expect(tournament!.seedingMode).toBe(tournamentsData[i].seedingMode);
		}
	});

	test("should list tournaments in alphabetical order", async () => {
		const database = getTestDatabaseContext();

		const tournamentsData = [
			{ name: "Charlie Tournament" },
			{ name: "Alice Tournament" },
			{ name: "Bob Tournament" }
		];

		// トーナメントを作成
		for (const tournamentData of tournamentsData) {
			await database.tournaments.createTournament(eventId, tournamentData);
		}

		// トーナメント一覧を取得
		const tournaments = await database.tournaments.listTournaments(eventId);
		
		// アルファベット順に並んでいることを確認
		expect(tournaments).toHaveLength(3);
		expect(tournaments[0].name).toBe("Alice Tournament");
		expect(tournaments[1].name).toBe("Bob Tournament");
		expect(tournaments[2].name).toBe("Charlie Tournament");
	});

	test("should handle tournaments from different events", async () => {
		const database = getTestDatabaseContext();

		// 別のイベントを作成
		const anotherEvent = await database.events.createEvent({
			name: "Another Event",
			slug: "another-event"
		});

		// 最初のイベントにトーナメントを作成
		const tournament1 = await database.tournaments.createTournament(eventId, {
			name: "Tournament in Event 1"
		});

		// 2番目のイベントにトーナメントを作成
		const tournament2 = await database.tournaments.createTournament(anotherEvent.id, {
			name: "Tournament in Event 2"
		});

		// 各イベントのトーナメント一覧を取得
		const tournaments1 = await database.tournaments.listTournaments(eventId);
		const tournaments2 = await database.tournaments.listTournaments(anotherEvent.id);

		// 各イベントに正しいトーナメントが含まれていることを確認
		expect(tournaments1).toHaveLength(1);
		expect(tournaments1[0].id).toBe(tournament1.id);
		expect(tournaments1[0].name).toBe("Tournament in Event 1");

		expect(tournaments2).toHaveLength(1);
		expect(tournaments2[0].id).toBe(tournament2.id);
		expect(tournaments2[0].name).toBe("Tournament in Event 2");
	});
});
