import { describe, it, expect, beforeEach } from 'vitest';
import * as repo from './team-battle-slots';

describe('team-battle-slots repository (memory)', () => {
	beforeEach(() => {
		repo.__resetForTests();
	});

	describe('createTeamBattleSlot', () => {
		it('should create a new slot with generated ID', () => {
			const slot = repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: 'player1',
				player2_id: 'player2'
			});

			expect(slot.id).toBeDefined();
			expect(slot.team_battle_id).toBe('battle1');
			expect(slot.team_id).toBe('team1');
			expect(slot.slot_index).toBe(0);
			expect(slot.assignment_type).toBe('adhoc');
			expect(slot.player1_id).toBe('player1');
			expect(slot.player2_id).toBe('player2');
		});

		it('should create a slot with pair assignment', () => {
			const slot = repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'pair',
				pair_id: 'pair1'
			});

			expect(slot.assignment_type).toBe('pair');
			expect(slot.pair_id).toBe('pair1');
			expect(slot.player1_id).toBeUndefined();
			expect(slot.player2_id).toBeUndefined();
		});
	});

	describe('listTeamBattleSlots', () => {
		it('should return empty array when no slots exist', () => {
			const slots = repo.listTeamBattleSlots('battle1');
			expect(slots).toEqual([]);
		});

		it('should return all slots for a battle sorted by team and index', () => {
			repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team2',
				slot_index: 0,
				assignment_type: 'adhoc'
			});
			repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 1,
				assignment_type: 'adhoc'
			});
			repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc'
			});

			const slots = repo.listTeamBattleSlots('battle1');
			expect(slots).toHaveLength(3);
			expect(slots[0].team_id).toBe('team1');
			expect(slots[0].slot_index).toBe(0);
			expect(slots[1].team_id).toBe('team1');
			expect(slots[1].slot_index).toBe(1);
			expect(slots[2].team_id).toBe('team2');
			expect(slots[2].slot_index).toBe(0);
		});

		it('should not return slots from other battles', () => {
			repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc'
			});
			repo.createTeamBattleSlot({
				team_battle_id: 'battle2',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc'
			});

			const slots = repo.listTeamBattleSlots('battle1');
			expect(slots).toHaveLength(1);
			expect(slots[0].team_battle_id).toBe('battle1');
		});
	});

	describe('listTeamBattleSlotsByTeam', () => {
		it('should return only slots for specified team', () => {
			repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc'
			});
			repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team2',
				slot_index: 0,
				assignment_type: 'adhoc'
			});
			repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 1,
				assignment_type: 'adhoc'
			});

			const slots = repo.listTeamBattleSlotsByTeam('battle1', 'team1');
			expect(slots).toHaveLength(2);
			expect(slots.every(s => s.team_id === 'team1')).toBe(true);
			expect(slots[0].slot_index).toBe(0);
			expect(slots[1].slot_index).toBe(1);
		});
	});

	describe('ensureTeamBattleSlot', () => {
		it('should return slot if it exists', () => {
			const created = repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc'
			});

			const slot = repo.ensureTeamBattleSlot('battle1', created.id);
			expect(slot.id).toBe(created.id);
		});

		it('should throw error if slot does not exist', () => {
			expect(() => {
				repo.ensureTeamBattleSlot('battle1', 'nonexistent');
			}).toThrow('Team battle slot not found');
		});
	});

	describe('updateTeamBattleSlot', () => {
		it('should update slot properties', () => {
			const created = repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc',
				player1_id: 'player1',
				player2_id: 'player2'
			});

			const updated = repo.updateTeamBattleSlot('battle1', created.id, {
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 1,
				assignment_type: 'pair',
				pair_id: 'pair1'
			});

			expect(updated.id).toBe(created.id);
			expect(updated.slot_index).toBe(1);
			expect(updated.assignment_type).toBe('pair');
			expect(updated.pair_id).toBe('pair1');
		});

		it('should throw error if slot does not exist', () => {
			expect(() => {
				repo.updateTeamBattleSlot('battle1', 'nonexistent', {
					team_battle_id: 'battle1',
					team_id: 'team1',
					slot_index: 0,
					assignment_type: 'adhoc'
				});
			}).toThrow('Team battle slot not found');
		});
	});

	describe('deleteTeamBattleSlot', () => {
		it('should delete slot', () => {
			const created = repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc'
			});

			repo.deleteTeamBattleSlot('battle1', created.id);

			const slots = repo.listTeamBattleSlots('battle1');
			expect(slots).toHaveLength(0);
		});

		it('should throw error if slot does not exist', () => {
			expect(() => {
				repo.deleteTeamBattleSlot('battle1', 'nonexistent');
			}).toThrow('Team battle slot not found');
		});
	});

	describe('deleteTeamBattleSlotsByBattle', () => {
		it('should delete all slots for a battle', () => {
			repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc'
			});
			repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team2',
				slot_index: 0,
				assignment_type: 'adhoc'
			});
			repo.createTeamBattleSlot({
				team_battle_id: 'battle2',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc'
			});

			repo.deleteTeamBattleSlotsByBattle('battle1');

			const battle1Slots = repo.listTeamBattleSlots('battle1');
			const battle2Slots = repo.listTeamBattleSlots('battle2');
			expect(battle1Slots).toHaveLength(0);
			expect(battle2Slots).toHaveLength(1);
		});
	});

	describe('setTeamBattleSlots', () => {
		it('should replace all slots for a battle', () => {
			repo.createTeamBattleSlot({
				team_battle_id: 'battle1',
				team_id: 'team1',
				slot_index: 0,
				assignment_type: 'adhoc'
			});

			const newSlots = repo.setTeamBattleSlots('battle1', [
				{
					team_id: 'team1',
					slot_index: 0,
					assignment_type: 'pair',
					pair_id: 'pair1',
					team_battle_id: 'battle1'
				},
				{
					team_id: 'team2',
					slot_index: 0,
					assignment_type: 'adhoc',
					player1_id: 'player1',
					player2_id: 'player2',
					team_battle_id: 'battle1'
				}
			]);

			expect(newSlots).toHaveLength(2);
			const allSlots = repo.listTeamBattleSlots('battle1');
			expect(allSlots).toHaveLength(2);
		});

		it('should skip slots with missing required fields', () => {
			const slots = repo.setTeamBattleSlots('battle1', [
				{
					team_id: '',
					slot_index: 0,
					assignment_type: 'adhoc',
					team_battle_id: 'battle1'
				},
				{
					team_id: 'team1',
					slot_index: 0,
					assignment_type: 'adhoc',
					team_battle_id: 'battle1'
				}
			]);

			expect(slots).toHaveLength(1);
		});

		it('should preserve provided IDs', () => {
			const slots = repo.setTeamBattleSlots('battle1', [
				{
					id: 'custom-id',
					team_id: 'team1',
					slot_index: 0,
					assignment_type: 'adhoc',
					team_battle_id: 'battle1'
				}
			]);

			expect(slots[0].id).toBe('custom-id');
		});
	});
});
