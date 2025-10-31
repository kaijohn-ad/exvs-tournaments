import { describe, it, expect, beforeEach } from "vitest";
import { loader } from "../events._index";
import * as eventsMemory from "~/repositories/events";
import * as tournamentsMemory from "~/repositories/tournaments";
import * as teamBattlesMemory from "~/repositories/team-battles";
import * as teamsMemory from "~/repositories/teams";

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

describe("events index route", () => {
	beforeEach(() => {
		eventsMemory.__resetForTests();
		tournamentsMemory.__resetForTests();
		teamBattlesMemory.__resetForTests();
		teamsMemory.__resetForTests();
	});

	it("returns empty events array when no events exist", async () => {
		const result = await loader({
			context: mockContext,
			params: {},
			request: new Request("http://localhost/events"),
		});
		const data = await result.json();

		expect(data.events).toEqual([]);
	});

	it("returns events with tournaments, teamBattles, and teams", async () => {
		const event = eventsMemory.createEvent({ name: "Test Event" });
		const tournament1 = tournamentsMemory.createTournament(event.id, { name: "Tournament 1" });
		const tournament2 = tournamentsMemory.createTournament(event.id, { name: "Tournament 2" });

		const teamA = teamsMemory.createTeam(event.id, { name: "チームA" });
		const teamB = teamsMemory.createTeam(event.id, { name: "チームB" });
		const battle = teamBattlesMemory.createTeamBattle(event.id, {
			team_a_id: teamA.id,
			team_b_id: teamB.id,
			slots_count: 3,
		});

		const result = await loader({
			context: mockContext,
			params: {},
			request: new Request("http://localhost/events"),
		});

		expect(result).toBeInstanceOf(Response);
		const data = await result.json();

		expect(data.events).toHaveLength(1);
		expect(data.events[0].id).toBe(event.id);
		expect(data.events[0].tournaments).toHaveLength(2);
		expect(data.events[0].tournaments.map((t: any) => t.name)).toEqual(["Tournament 1", "Tournament 2"]);
		expect(data.events[0].teamBattles).toHaveLength(1);
		expect(data.events[0].teamBattles[0].id).toBe(battle.id);
		expect(data.events[0].teams).toHaveLength(2);
		expect(data.events[0].teams.map((t: any) => t.name)).toEqual(["チームA", "チームB"]);
	});

	it("returns events with empty arrays when no tournaments, teamBattles, or teams exist", async () => {
		const event = eventsMemory.createEvent({ name: "Test Event" });

		const result = await loader({
			context: mockContext,
			params: {},
			request: new Request("http://localhost/events"),
		});

		expect(result).toBeInstanceOf(Response);
		const data = await result.json();

		expect(data.events).toHaveLength(1);
		expect(data.events[0].id).toBe(event.id);
		expect(data.events[0].tournaments).toEqual([]);
		expect(data.events[0].teamBattles).toEqual([]);
		expect(data.events[0].teams).toEqual([]);
	});
});
