import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { eventId, tournamentId } = event.params;

	event.depends(`tournament-bracket:${eventId}:${tournamentId}`);

	const db = getDatabase(event);

	let tournament;
	try {
		tournament = await db.tournaments.ensureTournament(eventId, tournamentId);
	} catch (thrown) {
		console.error('[tournament-bracket:load] tournament not found', {
			eventId,
			tournamentId,
			error: thrown instanceof Error ? thrown.message : thrown
		});
		throw error(404, '指定したトーナメントが見つかりません。');
	}

	const [pairs, players, bracketMatches] = await Promise.all([
		db.pairs.listPairs(eventId),
		db.players.listPlayers(eventId),
		db.bracketMatches.listBracketMatches(tournamentId)
	]);

	return {
		eventId,
		tournamentId,
		tournament,
		pairs,
		players,
		bracketMatches
	};
};
