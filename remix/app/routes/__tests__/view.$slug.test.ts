import { describe, it, expect, beforeEach } from "vitest";
import { loader } from "../view.$slug";
import * as eventsMemory from "~/repositories/events";
import * as tournamentsMemory from "~/repositories/tournaments";

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

describe("view slug route", () => {
	beforeEach(() => {
		eventsMemory.__resetForTests();
		tournamentsMemory.__resetForTests();
	});

	it("returns event data and tournaments for valid slug", async () => {
		const event = eventsMemory.createEvent({ name: "Test Event", slug: "test-event" });
		const tournament1 = tournamentsMemory.createTournament(event.id, { name: "Tournament 1" });
		const tournament2 = tournamentsMemory.createTournament(event.id, { name: "Tournament 2" });

		const result = await loader({
			context: mockContext,
			params: { slug: "test-event" },
			request: new Request("http://localhost/view/test-event"),
		});

		expect(result).toBeInstanceOf(Response);
		const data = await result.json();

		expect(data.eventId).toBe(event.id);
		expect(data.eventName).toBe("Test Event");
		expect(data.tournaments).toHaveLength(2);
		expect(data.tournaments.map((t: any) => t.name)).toEqual(["Tournament 1", "Tournament 2"]);
	});

	it("returns empty tournaments array when event has no tournaments", async () => {
		const event = eventsMemory.createEvent({ name: "Test Event", slug: "test-event" });

		const result = await loader({
			context: mockContext,
			params: { slug: "test-event" },
			request: new Request("http://localhost/view/test-event"),
		});

		expect(result).toBeInstanceOf(Response);
		const data = await result.json();

		expect(data.eventId).toBe(event.id);
		expect(data.eventName).toBe("Test Event");
		expect(data.tournaments).toEqual([]);
	});

	it("throws 404 error when slug is not found", async () => {
		try {
			await loader({
				context: mockContext,
				params: { slug: "non-existent-slug" },
				request: new Request("http://localhost/view/non-existent-slug"),
			});
			expect.fail("Expected loader to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			if (error instanceof Response) {
				expect(error.status).toBe(404);
			}
		}
	});

	it("throws error when slug is missing", async () => {
		try {
			await loader({
				context: mockContext,
				params: {},
				request: new Request("http://localhost/view"),
			});
			expect.fail("Expected loader to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(Response);
			if (error instanceof Response) {
				expect(error.status).toBe(400);
			}
		}
	});
});
