import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { setupTestDatabase, cleanupTestDatabase, getTestDatabaseContext } from "./d1-test-helper";

describe("Events D1 Integration Tests", () => {
	beforeEach(async () => {
		await setupTestDatabase();
	});

	afterEach(async () => {
		await cleanupTestDatabase();
	});

	test("should create and list events", async () => {
		const database = getTestDatabaseContext();

		// イベントを作成
		const eventData = {
			name: "Test Tournament 2024",
			slug: "test-tournament-2024"
		};

		const createdEvent = await database.events.createEvent(eventData);
		
		expect(createdEvent).toBeDefined();
		expect(createdEvent.name).toBe(eventData.name);
		expect(createdEvent.slug).toBe(eventData.slug);
		expect(createdEvent.id).toBeDefined();
		expect(createdEvent.createdAt).toBeDefined();

		// イベント一覧を取得
		const events = await database.events.listEvents();
		
		expect(events).toHaveLength(1);
		expect(events[0].id).toBe(createdEvent.id);
		expect(events[0].name).toBe(eventData.name);
		expect(events[0].slug).toBe(eventData.slug);
	});

	test("should create event without slug", async () => {
		const database = getTestDatabaseContext();

		const eventData = {
			name: "Event Without Slug"
		};

		const createdEvent = await database.events.createEvent(eventData);
		
		expect(createdEvent).toBeDefined();
		expect(createdEvent.name).toBe(eventData.name);
		expect(createdEvent.slug).toBeNull();
	});

	test("should get event by slug", async () => {
		const database = getTestDatabaseContext();

		const eventData = {
			name: "Slug Test Event",
			slug: "slug-test-event"
		};

		const createdEvent = await database.events.createEvent(eventData);
		const events = await database.events.listEvents();
		const foundEvent = events.find(e => e.slug === eventData.slug);
		
		expect(foundEvent).toBeDefined();
		expect(foundEvent!.id).toBe(createdEvent.id);
		expect(foundEvent!.name).toBe(eventData.name);
		expect(foundEvent!.slug).toBe(eventData.slug);
	});

	test("should return null for non-existent slug", async () => {
		const database = getTestDatabaseContext();

		const events = await database.events.listEvents();
		const foundEvent = events.find(e => e.slug === "non-existent-slug");
		
		expect(foundEvent).toBeUndefined();
	});

	test("should update event", async () => {
		const database = getTestDatabaseContext();

		const eventData = {
			name: "Original Event Name",
			slug: "original-slug"
		};

		const createdEvent = await database.events.createEvent(eventData);
		
		const updateData = {
			name: "Updated Event Name",
			slug: "updated-slug"
		};

		const updatedEvent = await database.events.updateEvent(createdEvent.id, updateData);
		
		expect(updatedEvent).toBeDefined();
		expect(updatedEvent.name).toBe(updateData.name);
		expect(updatedEvent.slug).toBe(updateData.slug);
		expect(updatedEvent.id).toBe(createdEvent.id);

		// 更新されたイベントが正しく取得できることを確認
		const events = await database.events.listEvents();
		const foundEvent = events.find(e => e.slug === updateData.slug);
		expect(foundEvent).toBeDefined();
		expect(foundEvent!.name).toBe(updateData.name);
	});

	test("should delete event", async () => {
		const database = getTestDatabaseContext();

		const eventData = {
			name: "Event To Delete",
			slug: "event-to-delete"
		};

		const createdEvent = await database.events.createEvent(eventData);
		
		// イベントが存在することを確認
		const eventsBefore = await database.events.listEvents();
		expect(eventsBefore).toHaveLength(1);

		// イベントを削除
		await database.events.deleteEvent(createdEvent.id);

		// イベントが削除されたことを確認
		const eventsAfter = await database.events.listEvents();
		expect(eventsAfter).toHaveLength(0);

		// スラッグで検索しても見つからないことを確認
		const events = await database.events.listEvents();
		const foundEvent = events.find(e => e.slug === eventData.slug);
		expect(foundEvent).toBeUndefined();
	});

	test("should handle multiple events", async () => {
		const database = getTestDatabaseContext();

		const eventsData = [
			{ name: "Event 1", slug: "event-1" },
			{ name: "Event 2", slug: "event-2" },
			{ name: "Event 3", slug: "event-3" }
		];

		// 複数のイベントを作成
		const createdEvents = [];
		for (const eventData of eventsData) {
			const createdEvent = await database.events.createEvent(eventData);
			createdEvents.push(createdEvent);
		}

		// 全てのイベントが作成されたことを確認
		expect(createdEvents).toHaveLength(3);

		// イベント一覧を取得
		const allEvents = await database.events.listEvents();
		expect(allEvents).toHaveLength(3);

		// 各イベントが正しく作成されていることを確認
		for (let i = 0; i < eventsData.length; i++) {
			const event = allEvents.find(e => e.slug === eventsData[i].slug);
			expect(event).toBeDefined();
			expect(event!.name).toBe(eventsData[i].name);
		}
	});
});
