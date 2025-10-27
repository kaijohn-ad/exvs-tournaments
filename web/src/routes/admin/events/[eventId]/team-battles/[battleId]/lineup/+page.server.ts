import type { PageServerLoad, Actions } from './$types';
import { getDatabase } from '$lib/server/db';
import { fail } from '@sveltejs/kit';

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (!value) return undefined;
	const str = value.toString().trim();
	return str.length > 0 ? str : undefined;
};

export const load: PageServerLoad = async (event) => {
	event.depends(`lineup:${event.params.battleId}`);

	const db = getDatabase(event);
	
	const battle = await db.teamBattles.ensureTeamBattle(event.params.eventId, event.params.battleId);
	const slots = await db.teamBattleSlots.listTeamBattleSlots(event.params.battleId);
	const teams = await db.teams.listTeams(event.params.eventId);
	const players = await db.players.listPlayers(event.params.eventId);
	const pairs = await db.pairs.listPairs(event.params.eventId);

	const teamA = teams.find(t => t.id === battle.team_a_id);
	const teamB = teams.find(t => t.id === battle.team_b_id);

	return {
		eventId: event.params.eventId,
		battleId: event.params.battleId,
		battle,
		teamA,
		teamB,
		slots,
		teams,
		players,
		pairs
	};
};

export const actions: Actions = {
	addSlot: async (event) => {
		const formData = await event.request.formData();
		const teamId = normalizeText(formData.get('teamId'));

		if (!teamId) {
			return fail(400, { error: 'Team ID is required' });
		}

		const db = getDatabase(event);
		const battle = await db.teamBattles.ensureTeamBattle(event.params.eventId, event.params.battleId);
		
		const existingSlots = await db.teamBattleSlots.listTeamBattleSlotsByTeam(
			event.params.battleId,
			teamId
		);

		const nextIndex = existingSlots.length;

		if (nextIndex >= battle.slots_count) {
			return fail(400, { error: 'Maximum slots reached for this team' });
		}

		await db.teamBattleSlots.createTeamBattleSlot({
			team_battle_id: event.params.battleId,
			team_id: teamId,
			slot_index: nextIndex,
			assignment_type: 'adhoc',
			player1_id: undefined,
			player2_id: undefined
		});

		return { success: true, type: 'success', message: 'スロットを追加しました' };
	},

	updateSlot: async (event) => {
		const formData = await event.request.formData();
		const slotId = normalizeText(formData.get('slotId'));
		const assignmentType = normalizeText(formData.get('assignmentType')) as 'pair' | 'adhoc';
		const pairId = normalizeText(formData.get('pairId'));
		const player1Id = normalizeText(formData.get('player1Id'));
		const player2Id = normalizeText(formData.get('player2Id'));

		if (!slotId) {
			return fail(400, { error: 'Slot ID is required' });
		}

		if (!assignmentType || (assignmentType !== 'pair' && assignmentType !== 'adhoc')) {
			return fail(400, { error: 'Invalid assignment type' });
		}

		const db = getDatabase(event);
		const slot = await db.teamBattleSlots.ensureTeamBattleSlot(event.params.battleId, slotId);

		await db.teamBattleSlots.updateTeamBattleSlot(event.params.battleId, slotId, {
			team_battle_id: slot.team_battle_id,
			team_id: slot.team_id,
			slot_index: slot.slot_index,
			assignment_type: assignmentType,
			pair_id: assignmentType === 'pair' ? pairId : undefined,
			player1_id: assignmentType === 'adhoc' ? player1Id : undefined,
			player2_id: assignmentType === 'adhoc' ? player2Id : undefined
		});

		return { success: true, type: 'success', message: 'スロットを更新しました' };
	},

	deleteSlot: async (event) => {
		const formData = await event.request.formData();
		const slotId = normalizeText(formData.get('slotId'));

		if (!slotId) {
			return fail(400, { error: 'Slot ID is required' });
		}

		const db = getDatabase(event);
		const slot = await db.teamBattleSlots.ensureTeamBattleSlot(event.params.battleId, slotId);
		
		await db.teamBattleSlots.deleteTeamBattleSlot(event.params.battleId, slotId);

		const remainingSlots = await db.teamBattleSlots.listTeamBattleSlotsByTeam(
			event.params.battleId,
			slot.team_id
		);

		for (let i = 0; i < remainingSlots.length; i++) {
			if (remainingSlots[i].slot_index !== i) {
				await db.teamBattleSlots.updateTeamBattleSlot(
					event.params.battleId,
					remainingSlots[i].id,
					{
						...remainingSlots[i],
						slot_index: i
					}
				);
			}
		}

		return { success: true, type: 'success', message: 'スロットを削除しました' };
	},

	moveSlot: async (event) => {
		const formData = await event.request.formData();
		const slotId = normalizeText(formData.get('slotId'));
		const direction = normalizeText(formData.get('direction'));

		if (!slotId || !direction) {
			return fail(400, { error: 'Slot ID and direction are required' });
		}

		if (direction !== 'up' && direction !== 'down') {
			return fail(400, { error: 'Invalid direction' });
		}

		const db = getDatabase(event);
		const slot = await db.teamBattleSlots.ensureTeamBattleSlot(event.params.battleId, slotId);
		
		const teamSlots = await db.teamBattleSlots.listTeamBattleSlotsByTeam(
			event.params.battleId,
			slot.team_id
		);

		const currentIndex = slot.slot_index;
		const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

		if (targetIndex < 0 || targetIndex >= teamSlots.length) {
			return fail(400, { error: 'Cannot move slot in that direction' });
		}

		const targetSlot = teamSlots.find(s => s.slot_index === targetIndex);
		if (!targetSlot) {
			return fail(400, { error: 'Target slot not found' });
		}

		await db.teamBattleSlots.updateTeamBattleSlot(event.params.battleId, slot.id, {
			...slot,
			slot_index: targetIndex
		});

		await db.teamBattleSlots.updateTeamBattleSlot(event.params.battleId, targetSlot.id, {
			...targetSlot,
			slot_index: currentIndex
		});

		return { success: true, type: 'success', message: 'スロットを移動しました' };
	}
};
