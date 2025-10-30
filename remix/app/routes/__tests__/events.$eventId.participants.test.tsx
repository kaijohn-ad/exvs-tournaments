import { describe, expect, it, beforeEach } from 'vitest';
import { loader } from '../events.$eventId.participants';
import * as eventsMemory from '~/repositories/events';
import * as playersMemory from '~/repositories/players';
import * as pairsMemory from '~/repositories/pairs';

const EVENT_ID_1 = 'event-1';

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

describe('public event participants route', () => {
	beforeEach(() => {
		eventsMemory.__resetForTests();
		playersMemory.__resetForTests();
		pairsMemory.__resetForTests();
	});

	describe('loader', () => {
		it('returns event data with players and pairs', async () => {
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });
			const player1 = playersMemory.createPlayer(event1.id, { name: 'Player 1' });
			const player2 = playersMemory.createPlayer(event1.id, { name: 'Player 2' });
			const pair1 = pairsMemory.createPair(event1.id, {
				player1_id: player1.id,
				player2_id: player2.id,
			});

			const result = await loader({
				params: { eventId: event1.id },
				context: mockContext,
				request: new Request(`http://localhost/events/${event1.id}/participants`),
			});

			expect(result).toBeInstanceOf(Response);
			const data = await result.json();
			expect(data.eventId).toBe(event1.id);
			expect(data.event.name).toBe('Event 1');
			expect(data.players).toHaveLength(2);
			expect(data.pairs).toHaveLength(1);
			expect(data.players.find((p: any) => p.id === player1.id)?.name).toBe('Player 1');
			expect(data.pairs.find((p: any) => p.id === pair1.id)?.id).toBe(pair1.id);
		});

		it('returns empty arrays when no players or pairs exist', async () => {
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });

			const result = await loader({
				params: { eventId: event1.id },
				context: mockContext,
				request: new Request(`http://localhost/events/${event1.id}/participants`),
			});

			expect(result).toBeInstanceOf(Response);
			const data = await result.json();
			expect(data.players).toEqual([]);
			expect(data.pairs).toEqual([]);
		});

		it('returns 404 when event does not exist', async () => {
			await expect(
				loader({
					params: { eventId: 'non-existent-event-id' },
					context: mockContext,
					request: new Request('http://localhost/events/non-existent-event-id/participants'),
				})
			).rejects.toThrow();

			try {
				await loader({
					params: { eventId: 'non-existent-event-id' },
					context: mockContext,
					request: new Request('http://localhost/events/non-existent-event-id/participants'),
				});
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				const response = error as Response;
				expect(response.status).toBe(404);
				const text = await response.text();
				expect(text).toBe('指定したイベントが見つかりません。');
			}
		});

		it('returns 400 when eventId is missing', async () => {
			await expect(
				loader({
					params: {},
					context: mockContext,
					request: new Request('http://localhost/events//participants'),
				} as any)
			).rejects.toThrow();

			try {
				await loader({
					params: {},
					context: mockContext,
					request: new Request('http://localhost/events//participants'),
				} as any);
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				const response = error as Response;
				expect(response.status).toBe(400);
				const text = await response.text();
				expect(text).toBe('Event ID is required');
			}
		});
	});
});

