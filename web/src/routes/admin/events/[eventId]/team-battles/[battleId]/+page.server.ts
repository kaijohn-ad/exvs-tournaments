import type { PageServerLoad, Actions } from './$types';
import { getDatabase } from '$lib/server/db';
import { fail } from '@sveltejs/kit';

interface SlotResult {
	slot_index: number;
	winner_team_id: string;
	score_a: number;
	score_b: number;
}

export const load: PageServerLoad = async (event) => {
	event.depends(`team-battle:${event.params.battleId}`);

	const db = getDatabase(event);
	const eventId = event.params.eventId;
	const battleId = event.params.battleId;

	const battle = await db.teamBattles.ensureTeamBattle(eventId, battleId);
	const slots = await db.teamBattleSlots.listSlotsByBattle(battleId);
	const teams = await db.teams.listTeams(eventId);
	const players = await db.players.listPlayers(eventId);
	const pairs = await db.pairs.listPairs(eventId);
	const matches = await db.matches.listMatches('teamBattle', battleId);

	const teamASlots = slots.filter(s => s.team_id === battle.team_a_id);
	const teamBSlots = slots.filter(s => s.team_id === battle.team_b_id);

	return {
		eventId,
		battleId,
		battle,
		teamASlots,
		teamBSlots,
		teams,
		players,
		pairs,
		matches
	};
};

function calculateBattleResult(
	slotResults: SlotResult[],
	teamAId: string,
	teamBId: string
): { result: string; teamAWins: number; teamBWins: number } {
	let teamAWins = 0;
	let teamBWins = 0;

	for (const slotResult of slotResults) {
		if (slotResult.winner_team_id === teamAId) {
			teamAWins++;
		} else if (slotResult.winner_team_id === teamBId) {
			teamBWins++;
		}
	}

	let result: string;
	if (teamAWins > teamBWins) {
		result = 'team_a_win';
	} else if (teamBWins > teamAWins) {
		result = 'team_b_win';
	} else {
		result = 'draw';
	}

	return { result, teamAWins, teamBWins };
}

async function resolveSlotPlayers(eventId: string, db: any, slot: any) {
	const players: string[] = [];

	if (slot.assignment_type === 'pair') {
		if (slot.pair_id) {
			const pair = await db.pairs.ensurePair(eventId, slot.pair_id);
			if (pair.player1_id) players.push(pair.player1_id);
			if (pair.player2_id) players.push(pair.player2_id);
		}
	} else {
		if (slot.player1_id) players.push(slot.player1_id);
		if (slot.player2_id) players.push(slot.player2_id);
	}

	return players;
}

async function recordSlotMatch(
	db: any,
	eventId: string,
	battleId: string,
	slotIndex: number,
	teamASlot: any,
	teamBSlot: any,
	scoreA: number,
	scoreB: number,
	winnerTeamId: string
) {
	const winnerSide = winnerTeamId === teamASlot.team_id ? 'a' : 'b';

	const teamAPlayers = await resolveSlotPlayers(eventId, db, teamASlot);
	const teamBPlayers = await resolveSlotPlayers(eventId, db, teamBSlot);

	const [teamAPlayer1, teamAPlayer2] = teamAPlayers.length > 0 ? teamAPlayers : [teamASlot.player1_id, teamASlot.player2_id];
	const [teamBPlayer1, teamBPlayer2] = teamBPlayers.length > 0 ? teamBPlayers : [teamBSlot.player1_id, teamBSlot.player2_id];

 
	const existingMatches: any[] = await db.matches.listMatches('teamBattle', battleId);
	const existingMatch = existingMatches.find((m) => m.slot_index === slotIndex);

	if (existingMatch) {
		throw fail(400, { error: `スロット${slotIndex + 1}の結果はすでに記録されています。削除してから再入力してください。` });
	}

	const matchData = {
		context: 'teamBattle' as const,
		context_id: battleId,
		slot_index: slotIndex,
		side_a_type: teamASlot.assignment_type as 'pair' | 'adhoc',
		side_a_pair_id: teamASlot.pair_id,
		side_a_player1_id: teamAPlayer1 ?? undefined,
		side_a_player2_id: teamAPlayer2 ?? undefined,
		side_b_type: teamBSlot.assignment_type as 'pair' | 'adhoc',
		side_b_pair_id: teamBSlot.pair_id,
		side_b_player1_id: teamBPlayer1 ?? undefined,
		side_b_player2_id: teamBPlayer2 ?? undefined,
		score_a: scoreA,
		score_b: scoreB,
		winner_side: winnerSide
	};

	const match = await db.matches.createMatch(matchData);

	for (const playerId of teamAPlayers) {
		await db.playerStats.incrementPlayerStats(playerId, 'teamBattle', battleId, winnerSide === 'a');
	}

	for (const playerId of teamBPlayers) {
		await db.playerStats.incrementPlayerStats(playerId, 'teamBattle', battleId, winnerSide === 'b');
	}

	return match;
}

export const actions: Actions = {
	recordSlotResult: async (event) => {
		const formData = await event.request.formData();
		const slotIndex = parseInt(formData.get('slotIndex')?.toString() || '0');
		const scoreA = parseInt(formData.get('scoreA')?.toString() || '0');
		const scoreB = parseInt(formData.get('scoreB')?.toString() || '0');
		const winnerTeamId = formData.get('winnerTeamId')?.toString();

		if (!winnerTeamId || isNaN(scoreA) || isNaN(scoreB)) {
			return fail(400, { error: 'Invalid slot result data' });
		}

		const db = getDatabase(event);
		const eventId = event.params.eventId;
		const battleId = event.params.battleId;

		const battle = await db.teamBattles.ensureTeamBattle(eventId, battleId);
		const slots = await db.teamBattleSlots.listSlotsByBattle(battleId);

		const teamASlot = slots.find(s => s.team_id === battle.team_a_id && s.slot_index === slotIndex);
		const teamBSlot = slots.find(s => s.team_id === battle.team_b_id && s.slot_index === slotIndex);

		if (!teamASlot || !teamBSlot) {
			return fail(400, { error: 'Slot configuration not found' });
		}

		await recordSlotMatch(db, eventId, battleId, slotIndex, teamASlot, teamBSlot, scoreA, scoreB, winnerTeamId);

		if (battle.status === 'pending') {
			await db.teamBattles.updateTeamBattle(eventId, battleId, {
				...battle,
				status: 'in_progress'
			});
		}

		return { success: true, message: `スロット${slotIndex + 1}の結果を記録しました` };
	},

	finalizeBattle: async (event) => {
		const db = getDatabase(event);
		const eventId = event.params.eventId;
		const battleId = event.params.battleId;

		const battle = await db.teamBattles.ensureTeamBattle(eventId, battleId);
		const matches = await db.matches.listMatches('teamBattle', battleId);

		if (matches.length < battle.slots_count) {
			return fail(400, { error: `全${battle.slots_count}スロットの結果を入力してください` });
		}

	const slotResults: SlotResult[] = matches.map((match, index) => ({
		slot_index: typeof match.slot_index === 'number' ? match.slot_index : index,
		winner_team_id: match.winner_side === 'a' ? battle.team_a_id : battle.team_b_id,
		score_a: match.score_a,
		score_b: match.score_b
	}));

		const { result, teamAWins, teamBWins } = calculateBattleResult(
			slotResults,
			battle.team_a_id,
			battle.team_b_id
		);

		let finalResult = result;
		let finalStatus = 'completed';

		if (result === 'draw' && battle.tiebreak === 'representative') {
			finalStatus = 'tiebreak_required';
			finalResult = 'draw';
		}

		await db.teamBattles.updateTeamBattle(eventId, battleId, {
			...battle,
			status: finalStatus,
			result: finalResult
		});

		return {
			success: true,
			message: `団体戦を確定しました (チームA: ${teamAWins}勝, チームB: ${teamBWins}勝)`
		};
	},

	recordTiebreaker: async (event) => {
		const formData = await event.request.formData();
		const scoreA = parseInt(formData.get('scoreA')?.toString() || '0');
		const scoreB = parseInt(formData.get('scoreB')?.toString() || '0');
		const winnerTeamId = formData.get('winnerTeamId')?.toString();

		if (!winnerTeamId || isNaN(scoreA) || isNaN(scoreB)) {
			return fail(400, { error: 'Invalid tiebreaker data' });
		}

		const db = getDatabase(event);
		const eventId = event.params.eventId;
		const battleId = event.params.battleId;

		const battle = await db.teamBattles.ensureTeamBattle(eventId, battleId);

		if (battle.status !== 'tiebreak_required') {
			return fail(400, { error: 'Tiebreaker not required for this battle' });
		}

		const winnerSide: 'a' | 'b' = winnerTeamId === battle.team_a_id ? 'a' : 'b';
		const finalResult = winnerTeamId === battle.team_a_id ? 'team_a_win' : 'team_b_win';

		const tiebreakerMatch = {
			context: 'tiebreak' as const,
			context_id: battleId,
			side_a_type: 'adhoc' as const,
			side_a_player1_id: undefined,
			side_a_player2_id: undefined,
			side_b_type: 'adhoc' as const,
			side_b_player1_id: undefined,
			side_b_player2_id: undefined,
			score_a: scoreA,
			score_b: scoreB,
			winner_side: winnerSide
		};

		await db.matches.createMatch(tiebreakerMatch);

		await db.teamBattles.updateTeamBattle(eventId, battleId, {
			...battle,
			status: 'completed',
			result: finalResult
		});

		return { success: true, message: 'タイブレークの結果を記録しました' };
	},

	assignSlot: async (event) => {
		const formData = await event.request.formData();
		const teamId = formData.get('teamId')?.toString();
		const slotIndex = parseInt(formData.get('slotIndex')?.toString() || '0');
		const assignmentType = formData.get('assignmentType')?.toString() as 'pair' | 'adhoc';
		const pairId = formData.get('pairId')?.toString();
		const player1Id = formData.get('player1Id')?.toString();
		const player2Id = formData.get('player2Id')?.toString();

		if (!teamId || isNaN(slotIndex) || !assignmentType) {
			return fail(400, { error: 'Invalid slot assignment data' });
		}

		const db = getDatabase(event);
		const battleId = event.params.battleId;

		const existingSlots = await db.teamBattleSlots.listSlotsByBattle(battleId);
		const existingSlot = existingSlots.find(
			s => s.team_id === teamId && s.slot_index === slotIndex
		);

		const slotData = {
			team_battle_id: battleId,
			team_id: teamId,
			slot_index: slotIndex,
			assignment_type: assignmentType,
			pair_id: assignmentType === 'pair' ? pairId : undefined,
			player1_id: assignmentType === 'adhoc' ? player1Id : undefined,
			player2_id: assignmentType === 'adhoc' ? player2Id : undefined
		};

		if (existingSlot) {
			await db.teamBattleSlots.updateSlot(existingSlot.id, slotData);
		} else {
			await db.teamBattleSlots.createSlot(slotData);
		}

		return { success: true, message: 'スロットを割り当てました' };
	},

	deleteSlotResult: async (event) => {
		const formData = await event.request.formData();
		const matchId = formData.get('matchId')?.toString();

		if (!matchId) {
			return fail(400, { error: 'Match ID is required' });
		}

		const db = getDatabase(event);
		await db.matches.deleteMatch(matchId);

		return { success: true, message: 'スロット結果を削除しました' };
	}
};
