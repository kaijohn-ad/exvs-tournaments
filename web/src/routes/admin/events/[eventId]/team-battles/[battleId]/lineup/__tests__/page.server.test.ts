import { describe, it, expect, beforeEach } from 'vitest';
import { load, actions } from '../+page.server';
import { resetForTests } from '$lib/server/db';
import type { RequestEvent } from '@sveltejs/kit';

function createRequestEvent(
	params: Record<string, string>,
	formData?: Record<string, string>
): any {
	const request = formData
		? new Request('http://localhost', {
				method: 'POST',
				body: new URLSearchParams(formData)
		  })
		: new Request('http://localhost');

	return {
		params,
		request,
		url: new URL('http://localhost'),
		locals: {},
		platform: undefined,
		cookies: {} as any,
		fetch: fetch,
		getClientAddress: () => '127.0.0.1',
		isDataRequest: false,
		isSubRequest: false,
		route: { id: '' },
		setHeaders: () => {},
		depends: () => {}
	};
}

describe('lineup page server', () => {
	beforeEach(() => {
		resetForTests();
	});

	describe('load', () => {
		it('should load battle, teams, players, pairs, and slots', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const team1 = await db.teams.createTeam('event1', { name: 'Team A' });
			const team2 = await db.teams.createTeam('event1', { name: 'Team B' });
			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: team1.id,
				team_b_id: team2.id,
				slots_count: 3
			});

			event.params.battleId = battle.id;

			const player1 = await db.players.createPlayer('event1', { name: 'Player 1' });
			const player2 = await db.players.createPlayer('event1', { name: 'Player 2' });
			const pair1 = await db.pairs.createPair('event1', {
				player1_id: player1.id,
				player2_id: player2.id
			});

			const slot1 = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 0,
				assignment_type: 'pair',
				pair_id: pair1.id
			});

			const result: any = await load(event);

			expect(result.eventId).toBe('event1');
			expect(result.battleId).toBe(battle.id);
			expect(result.battle.id).toBe(battle.id);
			expect(result.teamA?.id).toBe(team1.id);
			expect(result.teamB?.id).toBe(team2.id);
			expect(result.slots).toHaveLength(1);
			expect(result.slots[0].id).toBe(slot1.id);
			expect(result.players).toHaveLength(2);
			expect(result.pairs).toHaveLength(1);
		});
	});

	describe('actions.addSlot', () => {
		it('should add a new slot for a team', async () => {
			const event = createRequestEvent(
				{ eventId: 'event1', battleId: 'battle1' },
				{ teamId: 'team1' }
			);
			const db = (await import('$lib/server/db')).getDatabase(event);

			const team1 = await db.teams.createTeam('event1', { name: 'Team A' });
			const team2 = await db.teams.createTeam('event1', { name: 'Team B' });
			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: team1.id,
				team_b_id: team2.id,
				slots_count: 3
			});

			event.params.battleId = battle.id;
			event.request = new Request('http://localhost', {
				method: 'POST',
				body: new URLSearchParams({ teamId: team1.id })
			});

			const result = await actions.addSlot(event);

			expect(result).toHaveProperty('success', true);
			expect(result).toHaveProperty('type', 'success');

			const slots = await db.teamBattleSlots.listTeamBattleSlotsByTeam(battle.id, team1.id);
			expect(slots).toHaveLength(1);
			expect(slots[0].slot_index).toBe(0);
			expect(slots[0].assignment_type).toBe('adhoc');
		});

		it('should fail if team ID is missing', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' }, {});

			const result = await actions.addSlot(event);

			expect(result).toHaveProperty('status', 400);
		});

		it('should fail if maximum slots reached', async () => {
			const event = createRequestEvent(
				{ eventId: 'event1', battleId: 'battle1' },
				{ teamId: 'team1' }
			);
			const db = (await import('$lib/server/db')).getDatabase(event);

			const team1 = await db.teams.createTeam('event1', { name: 'Team A' });
			const team2 = await db.teams.createTeam('event1', { name: 'Team B' });
			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: team1.id,
				team_b_id: team2.id,
				slots_count: 2
			});

			event.params.battleId = battle.id;

			await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 0,
				assignment_type: 'adhoc'
			});
			await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 1,
				assignment_type: 'adhoc'
			});

			event.request = new Request('http://localhost', {
				method: 'POST',
				body: new URLSearchParams({ teamId: team1.id })
			});

			const result = await actions.addSlot(event);

			expect(result).toHaveProperty('status', 400);
		});
	});

	describe('actions.updateSlot', () => {
		it('should update slot with pair assignment', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const team1 = await db.teams.createTeam('event1', { name: 'Team A' });
			const team2 = await db.teams.createTeam('event1', { name: 'Team B' });
			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: team1.id,
				team_b_id: team2.id,
				slots_count: 3
			});

			const player1 = await db.players.createPlayer('event1', { name: 'Player 1' });
			const player2 = await db.players.createPlayer('event1', { name: 'Player 2' });
			const pair1 = await db.pairs.createPair('event1', {
				player1_id: player1.id,
				player2_id: player2.id
			});

			const slot = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 0,
				assignment_type: 'adhoc'
			});

			event.params.battleId = battle.id;
			event.request = new Request('http://localhost', {
				method: 'POST',
				body: new URLSearchParams({
					slotId: slot.id,
					assignmentType: 'pair',
					pairId: pair1.id
				})
			});

			const result = await actions.updateSlot(event);

			expect(result).toHaveProperty('success', true);

			const updated = await db.teamBattleSlots.ensureTeamBattleSlot(battle.id, slot.id);
			expect(updated.assignment_type).toBe('pair');
			expect(updated.pair_id).toBe(pair1.id);
		});

		it('should update slot with adhoc assignment', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const team1 = await db.teams.createTeam('event1', { name: 'Team A' });
			const team2 = await db.teams.createTeam('event1', { name: 'Team B' });
			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: team1.id,
				team_b_id: team2.id,
				slots_count: 3
			});

			const player1 = await db.players.createPlayer('event1', { name: 'Player 1' });
			const player2 = await db.players.createPlayer('event1', { name: 'Player 2' });

			const slot = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 0,
				assignment_type: 'pair'
			});

			event.params.battleId = battle.id;
			event.request = new Request('http://localhost', {
				method: 'POST',
				body: new URLSearchParams({
					slotId: slot.id,
					assignmentType: 'adhoc',
					player1Id: player1.id,
					player2Id: player2.id
				})
			});

			const result = await actions.updateSlot(event);

			expect(result).toHaveProperty('success', true);

			const updated = await db.teamBattleSlots.ensureTeamBattleSlot(battle.id, slot.id);
			expect(updated.assignment_type).toBe('adhoc');
			expect(updated.player1_id).toBe(player1.id);
			expect(updated.player2_id).toBe(player2.id);
		});

		it('should fail if slot ID is missing', async () => {
			const event = createRequestEvent(
				{ eventId: 'event1', battleId: 'battle1' },
				{ assignmentType: 'pair' }
			);

			const result = await actions.updateSlot(event);

			expect(result).toHaveProperty('status', 400);
		});

		it('should fail if assignment type is invalid', async () => {
			const event = createRequestEvent(
				{ eventId: 'event1', battleId: 'battle1' },
				{ slotId: 'slot1', assignmentType: 'invalid' }
			);

			const result = await actions.updateSlot(event);

			expect(result).toHaveProperty('status', 400);
		});
	});

	describe('actions.deleteSlot', () => {
		it('should delete slot and reindex remaining slots', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const team1 = await db.teams.createTeam('event1', { name: 'Team A' });
			const team2 = await db.teams.createTeam('event1', { name: 'Team B' });
			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: team1.id,
				team_b_id: team2.id,
				slots_count: 3
			});

			const slot1 = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 0,
				assignment_type: 'adhoc'
			});
			const slot2 = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 1,
				assignment_type: 'adhoc'
			});
			const slot3 = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 2,
				assignment_type: 'adhoc'
			});

			event.params.battleId = battle.id;
			event.request = new Request('http://localhost', {
				method: 'POST',
				body: new URLSearchParams({ slotId: slot2.id })
			});

			const result = await actions.deleteSlot(event);

			expect(result).toHaveProperty('success', true);

			const remainingSlots = await db.teamBattleSlots.listTeamBattleSlotsByTeam(
				battle.id,
				team1.id
			);
			expect(remainingSlots).toHaveLength(2);
			expect(remainingSlots[0].id).toBe(slot1.id);
			expect(remainingSlots[0].slot_index).toBe(0);
			expect(remainingSlots[1].id).toBe(slot3.id);
			expect(remainingSlots[1].slot_index).toBe(1);
		});

		it('should fail if slot ID is missing', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' }, {});

			const result = await actions.deleteSlot(event);

			expect(result).toHaveProperty('status', 400);
		});
	});

	describe('actions.moveSlot', () => {
		it('should move slot up', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const team1 = await db.teams.createTeam('event1', { name: 'Team A' });
			const team2 = await db.teams.createTeam('event1', { name: 'Team B' });
			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: team1.id,
				team_b_id: team2.id,
				slots_count: 3
			});

			const slot1 = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 0,
				assignment_type: 'adhoc'
			});
			const slot2 = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 1,
				assignment_type: 'adhoc'
			});

			event.params.battleId = battle.id;
			event.request = new Request('http://localhost', {
				method: 'POST',
				body: new URLSearchParams({ slotId: slot2.id, direction: 'up' })
			});

			const result = await actions.moveSlot(event);

			expect(result).toHaveProperty('success', true);

			const updated1 = await db.teamBattleSlots.ensureTeamBattleSlot(battle.id, slot1.id);
			const updated2 = await db.teamBattleSlots.ensureTeamBattleSlot(battle.id, slot2.id);
			expect(updated1.slot_index).toBe(1);
			expect(updated2.slot_index).toBe(0);
		});

		it('should move slot down', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const team1 = await db.teams.createTeam('event1', { name: 'Team A' });
			const team2 = await db.teams.createTeam('event1', { name: 'Team B' });
			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: team1.id,
				team_b_id: team2.id,
				slots_count: 3
			});

			const slot1 = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 0,
				assignment_type: 'adhoc'
			});
			const slot2 = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 1,
				assignment_type: 'adhoc'
			});

			event.params.battleId = battle.id;
			event.request = new Request('http://localhost', {
				method: 'POST',
				body: new URLSearchParams({ slotId: slot1.id, direction: 'down' })
			});

			const result = await actions.moveSlot(event);

			expect(result).toHaveProperty('success', true);

			const updated1 = await db.teamBattleSlots.ensureTeamBattleSlot(battle.id, slot1.id);
			const updated2 = await db.teamBattleSlots.ensureTeamBattleSlot(battle.id, slot2.id);
			expect(updated1.slot_index).toBe(1);
			expect(updated2.slot_index).toBe(0);
		});

		it('should fail if trying to move first slot up', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const team1 = await db.teams.createTeam('event1', { name: 'Team A' });
			const team2 = await db.teams.createTeam('event1', { name: 'Team B' });
			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: team1.id,
				team_b_id: team2.id,
				slots_count: 3
			});

			const slot1 = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 0,
				assignment_type: 'adhoc'
			});

			event.params.battleId = battle.id;
			event.request = new Request('http://localhost', {
				method: 'POST',
				body: new URLSearchParams({ slotId: slot1.id, direction: 'up' })
			});

			const result = await actions.moveSlot(event);

			expect(result).toHaveProperty('status', 400);
		});

		it('should fail if trying to move last slot down', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' });
			const db = (await import('$lib/server/db')).getDatabase(event);

			const team1 = await db.teams.createTeam('event1', { name: 'Team A' });
			const team2 = await db.teams.createTeam('event1', { name: 'Team B' });
			const battle = await db.teamBattles.createTeamBattle('event1', {
				team_a_id: team1.id,
				team_b_id: team2.id,
				slots_count: 3
			});

			const slot1 = await db.teamBattleSlots.createTeamBattleSlot({
				team_battle_id: battle.id,
				team_id: team1.id,
				slot_index: 0,
				assignment_type: 'adhoc'
			});

			event.params.battleId = battle.id;
			event.request = new Request('http://localhost', {
				method: 'POST',
				body: new URLSearchParams({ slotId: slot1.id, direction: 'down' })
			});

			const result = await actions.moveSlot(event);

			expect(result).toHaveProperty('status', 400);
		});

		it('should fail if slot ID or direction is missing', async () => {
			const event = createRequestEvent({ eventId: 'event1', battleId: 'battle1' }, {});

			const result = await actions.moveSlot(event);

			expect(result).toHaveProperty('status', 400);
		});

		it('should fail if direction is invalid', async () => {
			const event = createRequestEvent(
				{ eventId: 'event1', battleId: 'battle1' },
				{ slotId: 'slot1', direction: 'invalid' }
			);

			const result = await actions.moveSlot(event);

			expect(result).toHaveProperty('status', 400);
		});
	});
});
