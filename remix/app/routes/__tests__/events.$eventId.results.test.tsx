import { describe, expect, it, beforeEach } from 'vitest';
import { loader } from '../events.$eventId.results';
import * as eventsMemory from '~/repositories/events';
import * as playersMemory from '~/repositories/players';
import * as pairsMemory from '~/repositories/pairs';
import * as matchesMemory from '~/repositories/matches';
import * as tournamentsMemory from '~/repositories/tournaments';
import * as teamBattlesMemory from '~/repositories/team-battles';

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

describe('public event results route', () => {
	beforeEach(() => {
		eventsMemory.__resetForTests();
		playersMemory.__resetForTests();
		pairsMemory.__resetForTests();
		matchesMemory.__resetForTests();
		tournamentsMemory.__resetForTests();
		teamBattlesMemory.__resetForTests();
	});

	describe('loader', () => {
		it('returns event data with results summary', async () => {
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });
			const player1 = playersMemory.createPlayer(event1.id, { name: 'Player 1' });
			const player2 = playersMemory.createPlayer(event1.id, { name: 'Player 2' });
			const pair1 = pairsMemory.createPair(event1.id, {
				player1_id: player1.id,
				player2_id: player2.id,
			});

			const tournament1 = tournamentsMemory.createTournament(event1.id, {
				name: 'Tournament 1',
			});

			const match1 = matchesMemory.createMatch({
				context: 'bracket',
				context_id: tournament1.id,
				side_a_type: 'pair',
				side_a_pair_id: pair1.id,
				side_b_type: 'pair',
				side_b_pair_id: pair1.id,
				score_a: 2,
				score_b: 1,
				winner_side: 'a',
				status: 'completed',
			});

			const result = await loader({
				params: { eventId: event1.id },
				context: mockContext,
				request: new Request(`http://localhost/events/${event1.id}/results`),
			});

			expect(result).toBeInstanceOf(Response);
			const data = await result.json();
			expect(data.eventId).toBe(event1.id);
			expect(data.event.name).toBe('Event 1');
			expect(data.matches).toBeDefined();
			expect(data.players).toBeDefined();
			expect(data.pairs).toBeDefined();
		});

		it('returns empty arrays when no data exists', async () => {
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });

			const result = await loader({
				params: { eventId: event1.id },
				context: mockContext,
				request: new Request(`http://localhost/events/${event1.id}/results`),
			});

			expect(result).toBeInstanceOf(Response);
			const data = await result.json();
			expect(data.matches).toEqual([]);
			expect(data.players).toEqual([]);
			expect(data.pairs).toEqual([]);
		});

		it('returns 404 when event does not exist', async () => {
			await expect(
				loader({
					params: { eventId: 'non-existent-event-id' },
					context: mockContext,
					request: new Request('http://localhost/events/non-existent-event-id/results'),
				})
			).rejects.toThrow();

			try {
				await loader({
					params: { eventId: 'non-existent-event-id' },
					context: mockContext,
					request: new Request('http://localhost/events/non-existent-event-id/results'),
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
					request: new Request('http://localhost/events//results'),
				} as any)
			).rejects.toThrow();

			try {
				await loader({
					params: {},
					context: mockContext,
					request: new Request('http://localhost/events//results'),
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

