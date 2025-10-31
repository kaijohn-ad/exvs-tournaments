import { describe, expect, it, beforeEach } from 'vitest';
import { loader, action } from '../admin.events.$eventId.tournaments';
import * as tournamentsMemory from '~/repositories/tournaments';
import * as pairsMemory from '~/repositories/pairs';
import * as bracketMatchesMemory from '~/repositories/bracket-matches';
import * as tournamentParticipantsMemory from '~/repositories/tournament-participants';
import * as playersMemory from '~/repositories/players';

const EVENT_ID = 'event-1';

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

const createFormData = (entries: Record<string, string>) => {
	const formData = new FormData();
	for (const [key, value] of Object.entries(entries)) {
		formData.append(key, value);
	}
	return formData;
};

describe('admin tournaments route', () => {
	beforeEach(() => {
		tournamentsMemory.__resetForTests();
		pairsMemory.__resetForTests();
		bracketMatchesMemory.__resetForTests();
		tournamentParticipantsMemory.__resetForTests();
		playersMemory.__resetForTests();
	});

	describe('loader', () => {
		it('returns tournaments sorted by name', async () => {
			tournamentsMemory.createTournament(EVENT_ID, { name: 'Summer Tournament' });
			tournamentsMemory.createTournament(EVENT_ID, { name: 'Spring Tournament' });

			const result = await loader({
				params: { eventId: EVENT_ID },
				context: mockContext,
				request: new Request('http://localhost/admin/events/event-1/tournaments'),
			});

			expect(result).toBeInstanceOf(Response);
			const data = await result.json();
			expect(data.eventId).toBe(EVENT_ID);
			expect(data.tournaments).toHaveLength(2);
			expect(data.tournaments[0].name).toBe('Spring Tournament');
			expect(data.tournaments[1].name).toBe('Summer Tournament');
		});

		it('returns empty array when no tournaments exist', async () => {
			const result = await loader({
				params: { eventId: EVENT_ID },
				context: mockContext,
				request: new Request('http://localhost/admin/events/event-1/tournaments'),
			});

			expect(result).toBeInstanceOf(Response);
			const data = await result.json();
			expect(data.eventId).toBe(EVENT_ID);
			expect(data.tournaments).toHaveLength(0);
		});
	});

	describe('action', () => {
		describe('create intent', () => {
			it('creates a tournament', async () => {
				const formData = createFormData({
					_intent: 'create',
					name: 'Spring Tournament',
					format: 'single-elimination',
					seedingMode: 'random',
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('success');
				expect(data!.source).toBe('create');
				expect(data!.tournaments).toHaveLength(1);
				expect(data!.tournaments![0].name).toBe('Spring Tournament');
			});

			it('fails without name', async () => {
				const formData = createFormData({
					_intent: 'create',
					name: '',
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('error');
				expect(data!.source).toBe('create');
			});
		});

		describe('update intent', () => {
			it('updates a tournament', async () => {
				const tournament = tournamentsMemory.createTournament(EVENT_ID, { name: 'Spring Tournament' });

				const formData = createFormData({
					_intent: 'update',
					tournamentId: tournament.id,
					name: 'Spring Championship',
					seedingMode: 'manual',
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('success');
				expect(data!.source).toBe('update');
				expect(data!.tournaments).toHaveLength(1);
				expect(data!.tournaments![0].name).toBe('Spring Championship');
			});

			it('fails without tournamentId', async () => {
				const formData = createFormData({
					_intent: 'update',
					name: 'Test',
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('error');
				expect(data!.source).toBe('update');
			});
		});

		describe('delete intent', () => {
			it('deletes a tournament', async () => {
				const tournament = tournamentsMemory.createTournament(EVENT_ID, { name: 'Spring Tournament' });

				const formData = createFormData({
					_intent: 'delete',
					tournamentId: tournament.id,
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('success');
				expect(data!.source).toBe('delete');
			});
		});

		describe('import intent', () => {
			it('imports tournaments from JSON', async () => {
				const formData = createFormData({
					_intent: 'import',
					payload: JSON.stringify([
						{ id: 't1', name: 'Tournament A', format: 'single-elimination', seedingMode: 'random' },
						{ name: 'Tournament B', seedingMode: 'manual' },
					]),
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('success');
				expect(data!.source).toBe('import');
				expect(data!.tournaments).toHaveLength(2);
			});

			it('fails with invalid JSON', async () => {
				const formData = createFormData({
					_intent: 'import',
					payload: 'not json',
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('error');
				expect(data!.source).toBe('import');
			});
		});

		describe('generate intent', () => {
			it('generates bracket for tournament', async () => {
				const tournament = tournamentsMemory.createTournament(EVENT_ID, { name: 'Spring Tournament' });
				const pair1 = pairsMemory.createPair(EVENT_ID, { player1_id: 'p1', player2_id: 'p2' });
				const pair2 = pairsMemory.createPair(EVENT_ID, { player1_id: 'p3', player2_id: 'p4' });
				
				// 参加者として登録
				tournamentParticipantsMemory.addPair(tournament.id, pair1.id);
				tournamentParticipantsMemory.addPair(tournament.id, pair2.id);

				const formData = createFormData({
					_intent: 'generate',
					tournamentId: tournament.id,
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('success');
				expect(data!.source).toBe('generate');
			});

			it('fails with insufficient pairs', async () => {
				const tournament = tournamentsMemory.createTournament(EVENT_ID, { name: 'Spring Tournament' });

				const formData = createFormData({
					_intent: 'generate',
					tournamentId: tournament.id,
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('error');
				expect(data!.source).toBe('generate');
			});

			it('generates bracket for solo tournament with even participants', async () => {
				const tournament = tournamentsMemory.createTournament(EVENT_ID, {
					name: 'Solo Tournament',
					entryMode: 'solo'
				});
				const player1 = playersMemory.createPlayer(EVENT_ID, { name: 'Player 1' });
				const player2 = playersMemory.createPlayer(EVENT_ID, { name: 'Player 2' });
				const player3 = playersMemory.createPlayer(EVENT_ID, { name: 'Player 3' });
				const player4 = playersMemory.createPlayer(EVENT_ID, { name: 'Player 4' });
				
				// Solo参加者として登録
				tournamentParticipantsMemory.addSolo(tournament.id, player1.id);
				tournamentParticipantsMemory.addSolo(tournament.id, player2.id);
				tournamentParticipantsMemory.addSolo(tournament.id, player3.id);
				tournamentParticipantsMemory.addSolo(tournament.id, player4.id);

				const formData = createFormData({
					_intent: 'generate',
					tournamentId: tournament.id,
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('success');
				expect(data!.source).toBe('generate');
				
				// ブラケットマッチが生成されていることを確認
				const matches = bracketMatchesMemory.listBracketMatches(tournament.id);
				expect(matches.length).toBeGreaterThan(0);
			});

			it('fails with odd number of solo participants', async () => {
				const tournament = tournamentsMemory.createTournament(EVENT_ID, {
					name: 'Solo Tournament',
					entryMode: 'solo'
				});
				const player1 = playersMemory.createPlayer(EVENT_ID, { name: 'Player 1' });
				const player2 = playersMemory.createPlayer(EVENT_ID, { name: 'Player 2' });
				const player3 = playersMemory.createPlayer(EVENT_ID, { name: 'Player 3' });
				
				// Solo参加者として登録（奇数）
				tournamentParticipantsMemory.addSolo(tournament.id, player1.id);
				tournamentParticipantsMemory.addSolo(tournament.id, player2.id);
				tournamentParticipantsMemory.addSolo(tournament.id, player3.id);

				const formData = createFormData({
					_intent: 'generate',
					tournamentId: tournament.id,
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('error');
				expect(data!.source).toBe('generate');
				expect(data!.message).toContain('奇数');
			});

			it('fails with insufficient solo participants', async () => {
				const tournament = tournamentsMemory.createTournament(EVENT_ID, {
					name: 'Solo Tournament',
					entryMode: 'solo'
				});
				const player1 = playersMemory.createPlayer(EVENT_ID, { name: 'Player 1' });
				
				// Solo参加者として登録（1名のみ）
				tournamentParticipantsMemory.addSolo(tournament.id, player1.id);

				const formData = createFormData({
					_intent: 'generate',
					tournamentId: tournament.id,
				});

				const result = await action({
					params: { eventId: EVENT_ID },
					context: mockContext,
					request: new Request('http://localhost/admin/events/event-1/tournaments', {
						method: 'POST',
						body: formData,
					}),
				});

				expect(result).toBeInstanceOf(Response);
				const data = await result.json();
				expect(data).not.toBeNull();
				expect(data!.type).toBe('error');
				expect(data!.source).toBe('generate');
				expect(data!.message).toContain('少なくとも2名');
			});
		});
	});
});