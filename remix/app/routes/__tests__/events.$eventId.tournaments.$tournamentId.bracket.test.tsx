import { describe, expect, it, beforeEach } from 'vitest';
import { loader } from '../events.$eventId.tournaments.$tournamentId.bracket';
import * as tournamentsMemory from '~/repositories/tournaments';
import * as eventsMemory from '~/repositories/events';
import * as pairsMemory from '~/repositories/pairs';
import * as playersMemory from '~/repositories/players';
import * as bracketMatchesMemory from '~/repositories/bracket-matches';

const EVENT_ID_1 = 'event-1';
const EVENT_ID_2 = 'event-2';

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

describe('public tournament bracket route', () => {
	beforeEach(() => {
		tournamentsMemory.__resetForTests();
		eventsMemory.__resetForTests();
		pairsMemory.__resetForTests();
		playersMemory.__resetForTests();
		bracketMatchesMemory.__resetForTests();
	});

	describe('loader', () => {
		it('returns bracket data when eventId and tournamentId match', async () => {
			// テストデータの準備
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });
			const tournament1 = tournamentsMemory.createTournament(event1.id, {
				name: 'Tournament 1',
			});

			const result = await loader({
				params: { eventId: event1.id, tournamentId: tournament1.id },
				context: mockContext,
				request: new Request(`http://localhost/events/${event1.id}/tournaments/${tournament1.id}/bracket`),
			});

			expect(result).toBeInstanceOf(Response);
			const data = await result.json();
			expect(data.eventId).toBe(event1.id);
			expect(data.tournamentId).toBe(tournament1.id);
			expect(data.event.name).toBe('Event 1');
			expect(data.tournament.name).toBe('Tournament 1');
			expect(data.pairs).toEqual([]);
			expect(data.players).toEqual([]);
			expect(data.bracketMatches).toEqual([]);
			expect(data.loadedAt).toBeDefined();
		});

		it('returns 404 when tournament belongs to different event', async () => {
			// テストデータの準備
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });
			const event2 = eventsMemory.createEvent({ name: 'Event 2' });
			const tournament1 = tournamentsMemory.createTournament(event1.id, {
				name: 'Tournament 1',
			});

			// event2 のIDで event1 のトーナメントにアクセスしようとする
			await expect(
				loader({
					params: { eventId: event2.id, tournamentId: tournament1.id },
					context: mockContext,
					request: new Request(`http://localhost/events/${event2.id}/tournaments/${tournament1.id}/bracket`),
				})
			).rejects.toThrow();

			// 実際にエラーをキャッチして確認
			try {
				await loader({
					params: { eventId: event2.id, tournamentId: tournament1.id },
					context: mockContext,
					request: new Request(`http://localhost/events/${event2.id}/tournaments/${tournament1.id}/bracket`),
				});
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				const response = error as Response;
				expect(response.status).toBe(404);
				const text = await response.text();
				expect(text).toBe('指定したトーナメントが見つかりません。');
			}
		});

		it('returns 404 when tournament does not exist', async () => {
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });

			await expect(
				loader({
					params: { eventId: event1.id, tournamentId: 'non-existent-tournament-id' },
					context: mockContext,
					request: new Request(`http://localhost/events/${event1.id}/tournaments/non-existent-tournament-id/bracket`),
				})
			).rejects.toThrow();

			try {
				await loader({
					params: { eventId: event1.id, tournamentId: 'non-existent-tournament-id' },
					context: mockContext,
					request: new Request(`http://localhost/events/${event1.id}/tournaments/non-existent-tournament-id/bracket`),
				});
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				const response = error as Response;
				expect(response.status).toBe(404);
				const text = await response.text();
				expect(text).toBe('指定したトーナメントが見つかりません。');
			}
		});

		it('returns 404 when event does not exist', async () => {
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });
			const tournament1 = tournamentsMemory.createTournament(event1.id, {
				name: 'Tournament 1',
			});

			await expect(
				loader({
					params: { eventId: 'non-existent-event-id', tournamentId: tournament1.id },
					context: mockContext,
					request: new Request(`http://localhost/events/non-existent-event-id/tournaments/${tournament1.id}/bracket`),
				})
			).rejects.toThrow();

			try {
				await loader({
					params: { eventId: 'non-existent-event-id', tournamentId: tournament1.id },
					context: mockContext,
					request: new Request(`http://localhost/events/non-existent-event-id/tournaments/${tournament1.id}/bracket`),
				});
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				const response = error as Response;
				expect(response.status).toBe(404);
				// トーナメントのチェックが先に実行されるため、トーナメントが見つからないというエラーになる
				const text = await response.text();
				expect(text).toBe('指定したトーナメントが見つかりません。');
			}
		});

		it('returns 400 when eventId is missing', async () => {
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });
			const tournament1 = tournamentsMemory.createTournament(event1.id, {
				name: 'Tournament 1',
			});

			await expect(
				loader({
					params: { tournamentId: tournament1.id },
					context: mockContext,
					request: new Request(`http://localhost/events//tournaments/${tournament1.id}/bracket`),
				} as any)
			).rejects.toThrow();

			try {
				await loader({
					params: { tournamentId: tournament1.id },
					context: mockContext,
					request: new Request(`http://localhost/events//tournaments/${tournament1.id}/bracket`),
				} as any);
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				const response = error as Response;
				expect(response.status).toBe(400);
				const text = await response.text();
				expect(text).toBe('Event ID and Tournament ID are required');
			}
		});

		it('returns 400 when tournamentId is missing', async () => {
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });

			await expect(
				loader({
					params: { eventId: event1.id },
					context: mockContext,
					request: new Request(`http://localhost/events/${event1.id}/tournaments//bracket`),
				} as any)
			).rejects.toThrow();

			try {
				await loader({
					params: { eventId: event1.id },
					context: mockContext,
					request: new Request(`http://localhost/events/${event1.id}/tournaments//bracket`),
				} as any);
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(Response);
				const response = error as Response;
				expect(response.status).toBe(400);
				const text = await response.text();
				expect(text).toBe('Event ID and Tournament ID are required');
			}
		});
	});
});

