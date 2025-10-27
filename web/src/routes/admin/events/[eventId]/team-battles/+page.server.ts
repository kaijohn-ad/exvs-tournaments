import type { PageServerLoad, Actions } from './$types';
import { getDatabase } from '$lib/server/db';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	event.depends(`team-battles:${event.params.eventId}`);

	const db = getDatabase(event);
	
	const teamBattles = await db.teamBattles.listTeamBattles(event.params.eventId);
	const teams = await db.teams.listTeams(event.params.eventId);
	const players = await db.players.listPlayers(event.params.eventId);

	return {
		eventId: event.params.eventId,
		teamBattles,
		teams,
		players
	};
};

export const actions: Actions = {
	delete: async (event) => {
		const formData = await event.request.formData();
		const battleId = formData.get('battleId')?.toString();

		if (!battleId) {
			return fail(400, { error: 'Battle ID is required' });
		}

		const db = getDatabase(event);
		await db.teamBattles.deleteTeamBattle(event.params.eventId, battleId);

		return { success: true };
	}
};
