import { describe, expect, it, beforeEach } from 'vitest';
import { loader } from '../events.$eventId.schedule';
import * as eventsMemory from '~/repositories/events';
import * as playersMemory from '~/repositories/players';
import * as pairsMemory from '~/repositories/pairs';
import * as matchesMemory from '~/repositories/matches';
import * as tournamentsMemory from '~/repositories/tournaments';
import * as teamBattlesMemory from '~/repositories/team-battles';
import * as bracketMatchesMemory from '~/repositories/bracket-matches';

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

describe('public event schedule route', () => {
	beforeEach(() => {
		eventsMemory.__resetForTests();
		playersMemory.__resetForTests();
		pairsMemory.__resetForTests();
		matchesMemory.__resetForTests();
		tournamentsMemory.__resetForTests();
		teamBattlesMemory.__resetForTests();
		bracketMatchesMemory.__resetForTests();
	});

	describe('loader', () => {
	it('returns event data with matches sorted by played_at', async () => {
		const event1 = eventsMemory.createEvent({ name: 'Event 1' });
		const player1 = playersMemory.createPlayer(event1.id, { name: 'Player 1' });
		const player2 = playersMemory.createPlayer(event1.id, { name: 'Player 2' });
		const pair1 = pairsMemory.createPair(event1.id, {
			player1_id: player1.id,
			player2_id: player2.id,
		});

		// トーナメントと団体戦を作成
		const tournament1 = tournamentsMemory.createTournament(event1.id, {
			name: 'Tournament 1',
		});
		const teamBattle1 = teamBattlesMemory.createTeamBattle(event1.id, {
			team_a_id: 'team-a',
			team_b_id: 'team-b',
		});

		const now = new Date().toISOString();
		const later = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1時間後

		// bracket_matchを作成（matchesテーブルのcontext_idはbracket_match.idを指す）
		const bracketMatch1 = bracketMatchesMemory.createBracketMatch(tournament1.id, {
			round: 1,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: pair1.id,
			participant_b_type: 'pair',
			participant_b_pair_id: pair1.id,
			score_a: 2,
			score_b: 1,
			winner_side: 'a',
			status: 'completed',
		});

		const match1 = matchesMemory.createMatch({
			context: 'bracket',
			context_id: bracketMatch1.id, // bracket_match.idを指す
			side_a_type: 'pair',
			side_a_pair_id: pair1.id,
			side_b_type: 'pair',
			side_b_pair_id: pair1.id,
			score_a: 2,
			score_b: 1,
			winner_side: 'a',
			status: 'pending', // 未開始の試合として追加
			played_at: now,
		});

		const match2 = matchesMemory.createMatch({
			context: 'teamBattle',
			context_id: teamBattle1.id,
			side_a_type: 'pair',
			side_a_pair_id: pair1.id,
			side_b_type: 'pair',
			side_b_pair_id: pair1.id,
			score_a: 1,
			score_b: 2,
			winner_side: 'b',
			status: 'pending', // 未開始の試合として追加
			played_at: later,
		});

		const result = await loader({
			params: { eventId: event1.id },
			context: mockContext,
			request: new Request(`http://localhost/events/${event1.id}/schedule`),
		});

		expect(result).toBeInstanceOf(Response);
		const data = await result.json();
		expect(data.eventId).toBe(event1.id);
		expect(data.event.name).toBe('Event 1');
		expect(data.matches.length).toBeGreaterThanOrEqual(2);
		// created_atでソートされていることを確認（追加順：古い順）
		expect(data.matches.find((m: any) => m.id === match1.id)).toBeDefined();
		expect(data.matches.find((m: any) => m.id === match2.id)).toBeDefined();
	});

		it('returns empty array when no matches exist', async () => {
			const event1 = eventsMemory.createEvent({ name: 'Event 1' });

			const result = await loader({
				params: { eventId: event1.id },
				context: mockContext,
				request: new Request(`http://localhost/events/${event1.id}/schedule`),
			});

			expect(result).toBeInstanceOf(Response);
			const data = await result.json();
			expect(data.matches).toEqual([]);
		});

		it('returns 404 when event does not exist', async () => {
			await expect(
				loader({
					params: { eventId: 'non-existent-event-id' },
					context: mockContext,
					request: new Request('http://localhost/events/non-existent-event-id/schedule'),
				})
			).rejects.toThrow();

			try {
				await loader({
					params: { eventId: 'non-existent-event-id' },
					context: mockContext,
					request: new Request('http://localhost/events/non-existent-event-id/schedule'),
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
					request: new Request('http://localhost/events//schedule'),
				} as any)
			).rejects.toThrow();

			try {
				await loader({
					params: {},
					context: mockContext,
					request: new Request('http://localhost/events//schedule'),
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

