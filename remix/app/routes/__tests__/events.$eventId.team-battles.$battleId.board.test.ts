import { describe, it, expect, beforeEach } from "vitest";
import { loader } from "../events.$eventId.team-battles.$battleId.board";
import * as eventsMemory from "~/repositories/events";
import * as tournamentsMemory from "~/repositories/tournaments";
import * as teamBattlesMemory from "~/repositories/team-battles";
import * as teamsMemory from "~/repositories/teams";
import * as teamBattleSlotsMemory from "~/repositories/team-battle-slots";
import * as matchesMemory from "~/repositories/matches";
import * as playersMemory from "~/repositories/players";
import * as pairsMemory from "~/repositories/pairs";

const mockContext = {
	env: {},
	cf: {},
	ctx: {},
	waitUntil: () => {},
	passThroughOnException: () => {},
	cloudflare: {
		ctx: {},
		env: {},
	},
	db: {},
} as any;

describe("team battle board route", () => {
	beforeEach(() => {
		eventsMemory.__resetForTests();
		tournamentsMemory.__resetForTests();
		teamBattlesMemory.__resetForTests();
		teamsMemory.__resetForTests();
		teamBattleSlotsMemory.__resetForTests();
		matchesMemory.__resetForTests();
		playersMemory.__resetForTests();
		pairsMemory.__resetForTests();
	});

	it("returns battle data with all required fields", async () => {
		const event = eventsMemory.createEvent({ name: "Test Event" });
		const teamA = teamsMemory.createTeam(event.id, { name: "チームA" });
		const teamB = teamsMemory.createTeam(event.id, { name: "チームB" });
		const battle = teamBattlesMemory.createTeamBattle(event.id, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3,
		});

		const result = await loader({
			context: mockContext,
			params: { eventId: event.id, battleId: battle.id },
			request: new Request(`http://localhost/events/${event.id}/team-battles/${battle.id}/board`),
		});

		expect(result).toBeInstanceOf(Response);
		const data = await result.json();

		expect(data.event).toBeDefined();
		expect(data.event.id).toBe(event.id);
		expect(data.battle).toBeDefined();
		expect(data.battle.id).toBe(battle.id);
		expect(data.teams).toBeDefined();
		expect(Array.isArray(data.teams)).toBe(true);
		expect(data.slots).toBeDefined();
		expect(Array.isArray(data.slots)).toBe(true);
		expect(data.matches).toBeDefined();
		expect(Array.isArray(data.matches)).toBe(true);
		expect(data.players).toBeDefined();
		expect(Array.isArray(data.players)).toBe(true);
		expect(data.pairs).toBeDefined();
		expect(Array.isArray(data.pairs)).toBe(true);
		expect(data.loadedAt).toBeDefined();
		expect(typeof data.loadedAt).toBe("string");
	});

	it("returns 404 when battle does not exist", async () => {
		const event = eventsMemory.createEvent({ name: "Test Event" });

		await expect(
			loader({
				context: mockContext,
				params: { eventId: event.id, battleId: "non-existent-battle-id" },
				request: new Request(`http://localhost/events/${event.id}/team-battles/non-existent-battle-id/board`),
			})
		).rejects.toThrow();

		try {
			await loader({
				context: mockContext,
				params: { eventId: event.id, battleId: "non-existent-battle-id" },
				request: new Request(`http://localhost/events/${event.id}/team-battles/non-existent-battle-id/board`),
			});
			expect.fail("Should have thrown an error");
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			const response = error as Response;
			expect(response.status).toBe(404);
			const text = await response.text();
			expect(text).toBe("指定した団体戦が見つかりません。");
		}
	});

	it("returns 400 when eventId is missing", async () => {
		await expect(
			loader({
				context: mockContext,
				params: { battleId: "some-battle-id" },
				request: new Request("http://localhost/events//team-battles/some-battle-id/board"),
			} as any)
		).rejects.toThrow();

		try {
			await loader({
				context: mockContext,
				params: { battleId: "some-battle-id" },
				request: new Request("http://localhost/events//team-battles/some-battle-id/board"),
			} as any);
			expect.fail("Should have thrown an error");
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			const response = error as Response;
			expect(response.status).toBe(400);
			const text = await response.text();
			expect(text).toBe("イベントIDまたは団体戦IDが見つかりません。");
		}
	});

	it("returns 400 when battleId is missing", async () => {
		const event = eventsMemory.createEvent({ name: "Test Event" });

		await expect(
			loader({
				context: mockContext,
				params: { eventId: event.id },
				request: new Request(`http://localhost/events/${event.id}/team-battles//board`),
			} as any)
		).rejects.toThrow();

		try {
			await loader({
				context: mockContext,
				params: { eventId: event.id },
				request: new Request(`http://localhost/events/${event.id}/team-battles//board`),
			} as any);
			expect.fail("Should have thrown an error");
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			const response = error as Response;
			expect(response.status).toBe(400);
			const text = await response.text();
			expect(text).toBe("イベントIDまたは団体戦IDが見つかりません。");
		}
	});
});

