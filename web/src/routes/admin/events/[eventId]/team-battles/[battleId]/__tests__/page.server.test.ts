import { describe, it, expect, beforeEach } from 'vitest';
import { actions, load } from '../+page.server';
import { resetForTests } from '$lib/server/db';

function createRequestEvent(params: any, formData?: FormData) {
	return {
		params,
		request: {
			formData: async () => formData || new FormData()
		},
		platform: undefined,
		url: new URL('http://localhost'),
		locals: {},
		depends: () => {}
	} as any;
}

describe('Team Battle Detail Page - Server Actions', () => {
	beforeEach(() => {
		resetForTests();
	});

	describe('load function', () => {
		it('should load battle details with slots and matches', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const player1 = await db.players.createPlayer('event1', { name: 'Player 1' });
			const player2 = await db.players.createPlayer('event1', { name: 'Player 2' });
			const player3 = await db.players.createPlayer('event1', { name: 'Player 3' });
			const player4 = await db.players.createPlayer('event1', { name: 'Player 4' });

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 2,
				format: 'waseda',
				tiebreak: 'off',
				status: 'pending'
			});

			event.params.battleId = battle.id;

			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamA.id,
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: player1.id,
				player2_id: player2.id
			});

			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamB.id,
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: player3.id,
				player2_id: player4.id
			});

			const result = await load(event) as any;

			expect(result.battle.id).toBe(battle.id);
			expect(result.teamASlots).toHaveLength(1);
			expect(result.teamBSlots).toHaveLength(1);
			expect(result.teams).toHaveLength(2);
			expect(result.players).toHaveLength(4);
		});
	});

	describe('recordSlotResult action', () => {
		it('should record slot result and create match log', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const player1 = await db.players.createPlayer('event1', { name: 'Player 1' });
			const player2 = await db.players.createPlayer('event1', { name: 'Player 2' });
			const player3 = await db.players.createPlayer('event1', { name: 'Player 3' });
			const player4 = await db.players.createPlayer('event1', { name: 'Player 4' });

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 3,
				format: 'waseda',
				tiebreak: 'off',
				status: 'pending'
			});

			event.params.battleId = battle.id;

			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamA.id,
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: player1.id,
				player2_id: player2.id
			});

			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamB.id,
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: player3.id,
				player2_id: player4.id
			});

			const formData = new FormData();
			formData.set('slotIndex', '0');
			formData.set('scoreA', '3');
			formData.set('scoreB', '1');
			formData.set('winnerTeamId', teamA.id);

			event.request.formData = async () => formData;

			const result = await actions.recordSlotResult(event);

			expect(result).toHaveProperty('success', true);

			const matches = await db.matches.listMatches('teamBattle', battle.id);
			expect(matches).toHaveLength(1);
			expect(matches[0].score_a).toBe(3);
			expect(matches[0].score_b).toBe(1);
			expect(matches[0].winner_side).toBe('a');

			const updatedBattle = await db.teamBattles.ensureTeamBattle('event1', battle.id);
			expect(updatedBattle.status).toBe('in_progress');
		});

		it('should update player statistics when recording slot result', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const player1 = await db.players.createPlayer('event1', { name: 'Player 1' });
			const player2 = await db.players.createPlayer('event1', { name: 'Player 2' });
			const player3 = await db.players.createPlayer('event1', { name: 'Player 3' });
			const player4 = await db.players.createPlayer('event1', { name: 'Player 4' });

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 3,
				format: 'waseda',
				tiebreak: 'off',
				status: 'pending'
			});

			event.params.battleId = battle.id;

			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamA.id,
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: player1.id,
				player2_id: player2.id
			});

			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamB.id,
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: player3.id,
				player2_id: player4.id
			});

			const formData = new FormData();
			formData.set('slotIndex', '0');
			formData.set('scoreA', '3');
			formData.set('scoreB', '1');
			formData.set('winnerTeamId', teamA.id);

			event.request.formData = async () => formData;

			await actions.recordSlotResult(event);

			const player1Stats = await db.playerStats.getPlayerStats(player1.id, 'teamBattle', battle.id);
			const player2Stats = await db.playerStats.getPlayerStats(player2.id, 'teamBattle', battle.id);
			const player3Stats = await db.playerStats.getPlayerStats(player3.id, 'teamBattle', battle.id);
			const player4Stats = await db.playerStats.getPlayerStats(player4.id, 'teamBattle', battle.id);

			expect(player1Stats?.wins).toBe(1);
			expect(player1Stats?.losses).toBe(0);
			expect(player2Stats?.wins).toBe(1);
			expect(player2Stats?.losses).toBe(0);
			expect(player3Stats?.wins).toBe(0);
			expect(player3Stats?.losses).toBe(1);
			expect(player4Stats?.wins).toBe(0);
			expect(player4Stats?.losses).toBe(1);
		});

		it('should fail if slot configuration is missing', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 3,
				format: 'waseda',
				tiebreak: 'off',
				status: 'pending'
			});

			event.params.battleId = battle.id;

			const formData = new FormData();
			formData.set('slotIndex', '0');
			formData.set('scoreA', '3');
			formData.set('scoreB', '1');
			formData.set('winnerTeamId', teamA.id);

			event.request.formData = async () => formData;

			const result = await actions.recordSlotResult(event);

			expect(result).toHaveProperty('status', 400);
		});
	});

	describe('finalizeBattle action', () => {
		it('should finalize battle with team A win', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const player1 = await db.players.createPlayer('event1', { name: 'Player 1' });
			const player2 = await db.players.createPlayer('event1', { name: 'Player 2' });
			const player3 = await db.players.createPlayer('event1', { name: 'Player 3' });
			const player4 = await db.players.createPlayer('event1', { name: 'Player 4' });

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 3,
				format: 'waseda',
				tiebreak: 'off',
				status: 'in_progress'
			});

			event.params.battleId = battle.id;

			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamA.id,
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: player1.id,
				player2_id: player2.id
			});

			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamB.id,
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: player3.id,
				player2_id: player4.id
			});

			await db.matches.createMatch({
				context: 'teamBattle',
				context_id: battle.id,
				side_a_type: 'adhoc',
				side_a_player1_id: player1.id,
				side_a_player2_id: player2.id,
				side_b_type: 'adhoc',
				side_b_player1_id: player3.id,
				side_b_player2_id: player4.id,
				score_a: 3,
				score_b: 1,
				winner_side: 'a'
			});

			await db.matches.createMatch({
				context: 'teamBattle',
				context_id: battle.id,
				side_a_type: 'adhoc',
				side_a_player1_id: player1.id,
				side_a_player2_id: player2.id,
				side_b_type: 'adhoc',
				side_b_player1_id: player3.id,
				side_b_player2_id: player4.id,
				score_a: 2,
				score_b: 1,
				winner_side: 'a'
			});

			await db.matches.createMatch({
				context: 'teamBattle',
				context_id: battle.id,
				side_a_type: 'adhoc',
				side_a_player1_id: player1.id,
				side_a_player2_id: player2.id,
				side_b_type: 'adhoc',
				side_b_player1_id: player3.id,
				side_b_player2_id: player4.id,
				score_a: 1,
				score_b: 2,
				winner_side: 'b'
			});

			const result = await actions.finalizeBattle(event);

			expect(result).toHaveProperty('success', true);

			const updatedBattle = await db.teamBattles.ensureTeamBattle('event1', battle.id);
			expect(updatedBattle.status).toBe('completed');
			expect(updatedBattle.result).toBe('team_a_win');
		});

		it('should require tiebreaker when battle ends in draw', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const player1 = await db.players.createPlayer('event1', { name: 'Player 1' });
			const player2 = await db.players.createPlayer('event1', { name: 'Player 2' });
			const player3 = await db.players.createPlayer('event1', { name: 'Player 3' });
			const player4 = await db.players.createPlayer('event1', { name: 'Player 4' });

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 2,
				format: 'waseda',
				tiebreak: 'representative',
				status: 'in_progress'
			});

			event.params.battleId = battle.id;

			await db.matches.createMatch({
				context: 'teamBattle',
				context_id: battle.id,
				side_a_type: 'adhoc',
				side_a_player1_id: player1.id,
				side_a_player2_id: player2.id,
				side_b_type: 'adhoc',
				side_b_player1_id: player3.id,
				side_b_player2_id: player4.id,
				score_a: 3,
				score_b: 1,
				winner_side: 'a'
			});

			await db.matches.createMatch({
				context: 'teamBattle',
				context_id: battle.id,
				side_a_type: 'adhoc',
				side_a_player1_id: player1.id,
				side_a_player2_id: player2.id,
				side_b_type: 'adhoc',
				side_b_player1_id: player3.id,
				side_b_player2_id: player4.id,
				score_a: 1,
				score_b: 2,
				winner_side: 'b'
			});

			const result = await actions.finalizeBattle(event);

			expect(result).toHaveProperty('success', true);

			const updatedBattle = await db.teamBattles.ensureTeamBattle('event1', battle.id);
			expect(updatedBattle.status).toBe('tiebreak_required');
			expect(updatedBattle.result).toBe('draw');
		});

		it('should fail if not all slots have results', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 3,
				format: 'waseda',
				tiebreak: 'off',
				status: 'in_progress'
			});

			event.params.battleId = battle.id;

			await db.matches.createMatch({
				context: 'teamBattle',
				context_id: battle.id,
				side_a_type: 'adhoc',
				side_b_type: 'adhoc',
				score_a: 3,
				score_b: 1,
				winner_side: 'a'
			});

			const result = await actions.finalizeBattle(event);

			expect(result).toHaveProperty('status', 400);
		});
	});

	describe('recordTiebreaker action', () => {
		it('should record tiebreaker result and complete battle', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 2,
				format: 'waseda',
				tiebreak: 'representative',
				status: 'tiebreak_required',
				result: 'draw'
			});

			event.params.battleId = battle.id;

			const formData = new FormData();
			formData.set('scoreA', '3');
			formData.set('scoreB', '2');
			formData.set('winnerTeamId', teamA.id);

			event.request.formData = async () => formData;

			const result = await actions.recordTiebreaker(event);

			expect(result).toHaveProperty('success', true);

			const updatedBattle = await db.teamBattles.ensureTeamBattle('event1', battle.id);
			expect(updatedBattle.status).toBe('completed');
			expect(updatedBattle.result).toBe('team_a_win');

			const tiebreakerMatches = await db.matches.listMatches('tiebreak', battle.id);
			expect(tiebreakerMatches).toHaveLength(1);
			expect(tiebreakerMatches[0].score_a).toBe(3);
			expect(tiebreakerMatches[0].score_b).toBe(2);
			expect(tiebreakerMatches[0].winner_side).toBe('a');
		});

		it('should fail if tiebreaker not required', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 2,
				format: 'waseda',
				tiebreak: 'off',
				status: 'in_progress'
			});

			event.params.battleId = battle.id;

			const formData = new FormData();
			formData.set('scoreA', '3');
			formData.set('scoreB', '2');
			formData.set('winnerTeamId', teamA.id);

			event.request.formData = async () => formData;

			const result = await actions.recordTiebreaker(event);

			expect(result).toHaveProperty('status', 400);
		});
	});

	describe('assignSlot action', () => {
		it('should assign players to a slot', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const player1 = await db.players.createPlayer('event1', { name: 'Player 1' });
			const player2 = await db.players.createPlayer('event1', { name: 'Player 2' });

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 3,
				format: 'waseda',
				tiebreak: 'off',
				status: 'pending'
			});

			event.params.battleId = battle.id;

			const formData = new FormData();
			formData.set('teamId', teamA.id);
			formData.set('slotIndex', '0');
			formData.set('assignmentType', 'adhoc');
			formData.set('player1Id', player1.id);
			formData.set('player2Id', player2.id);

			event.request.formData = async () => formData;

			const result = await actions.assignSlot(event);

			expect(result).toHaveProperty('success', true);

			const slots = await db.teamBattleSlots.listSlotsByBattle(battle.id);
			expect(slots).toHaveLength(1);
			expect(slots[0].team_id).toBe(teamA.id);
			expect(slots[0].slot_index).toBe(0);
			expect(slots[0].player1_id).toBe(player1.id);
			expect(slots[0].player2_id).toBe(player2.id);
		});

		it('should update existing slot assignment', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const player1 = await db.players.createPlayer('event1', { name: 'Player 1' });
			const player2 = await db.players.createPlayer('event1', { name: 'Player 2' });
			const player3 = await db.players.createPlayer('event1', { name: 'Player 3' });

			const teamA = await db.teams.createTeam('event1', { name: 'Team A' });
			const teamB = await db.teams.createTeam('event1', { name: 'Team B' });

			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: teamA.id,
				team_b_id: teamB.id,
				slots_count: 3,
				format: 'waseda',
				tiebreak: 'off',
				status: 'pending'
			});

			event.params.battleId = battle.id;

			await db.teamBattleSlots.createSlot({
				team_battle_id: battle.id,
				team_id: teamA.id,
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: player1.id,
				player2_id: player2.id
			});

			const formData = new FormData();
			formData.set('teamId', teamA.id);
			formData.set('slotIndex', '0');
			formData.set('assignmentType', 'adhoc');
			formData.set('player1Id', player1.id);
			formData.set('player2Id', player3.id);

			event.request.formData = async () => formData;

			const result = await actions.assignSlot(event);

			expect(result).toHaveProperty('success', true);

			const slots = await db.teamBattleSlots.listSlotsByBattle(battle.id);
			expect(slots).toHaveLength(1);
			expect(slots[0].player2_id).toBe(player3.id);
		});
	});

	describe('deleteSlotResult action', () => {
		it('should delete a slot result', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const match = await db.matches.createMatch({
				context: 'teamBattle',
				context_id: 'battle1',
				side_a_type: 'adhoc',
				side_b_type: 'adhoc',
				score_a: 3,
				score_b: 1,
				winner_side: 'a'
			});

			const formData = new FormData();
			formData.set('matchId', match.id);

			event.request.formData = async () => formData;

			const result = await actions.deleteSlotResult(event);

			expect(result).toHaveProperty('success', true);

			const matches = await db.matches.listMatches('teamBattle', 'battle1');
			expect(matches).toHaveLength(0);
		});
	});
});
