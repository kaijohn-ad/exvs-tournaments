import type { PageServerLoad, Actions } from './$types';
import { getDatabase } from '$lib/server/db';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	event.depends(`matches:${event.params.eventId}`);

	const db = getDatabase(event);
	
	const allMatches = await db.matches.listMatches();
	
	const players = await db.players.listPlayers(event.params.eventId);
	const pairs = await db.pairs.listPairs(event.params.eventId);
	
	const playerMap = new Map(players.map(p => [p.id, p.name]));
	const pairMap = new Map(pairs.map(p => [p.id, `${playerMap.get(p.player1_id) ?? '?'} & ${playerMap.get(p.player2_id) ?? '?'}`]));
	
	const getSideName = (match: any, side: 'a' | 'b'): string => {
		const type = side === 'a' ? match.side_a_type : match.side_b_type;
		const pairId = side === 'a' ? match.side_a_pair_id : match.side_b_pair_id;
		const player1Id = side === 'a' ? match.side_a_player1_id : match.side_b_player1_id;
		const player2Id = side === 'a' ? match.side_a_player2_id : match.side_b_player2_id;
		
		if (type === 'pair' && pairId) {
			return pairMap.get(pairId) ?? '(Unknown Pair)';
		}
		
		if (player1Id && player2Id) {
			return `${playerMap.get(player1Id) ?? '?'} & ${playerMap.get(player2Id) ?? '?'}`;
		}
		
		if (player1Id) {
			return playerMap.get(player1Id) ?? '(Unknown)';
		}
		
		return '(Unknown)';
	};
	
	const enrichedMatches = allMatches.map(match => ({
		...match,
		sideAName: getSideName(match, 'a'),
		sideBName: getSideName(match, 'b')
	}));

	return {
		eventId: event.params.eventId,
		matches: enrichedMatches
	};
};

export const actions: Actions = {
	delete: async (event) => {
		const formData = await event.request.formData();
		const matchId = formData.get('matchId')?.toString();

		if (!matchId) {
			return fail(400, { error: 'Match ID is required' });
		}

		const db = getDatabase(event);
		await db.matches.deleteMatch(matchId);

		return { success: true };
	}
};
