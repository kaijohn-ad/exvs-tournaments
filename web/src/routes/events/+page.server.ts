import { getDatabase } from '$lib/server/db';
import type { EventRecord } from '$lib/server/repositories/events';
import type { TournamentRecord } from '$lib/server/repositories/tournaments';
import type { PageServerLoad } from './$types';

export type EventSummary = EventRecord & {
	tournaments: TournamentRecord[];
};

export const load: PageServerLoad = async (event) => {
	const db = getDatabase(event);

	event.depends('public-events:list');

	const events = await db.events.listEvents();

	const summaries: EventSummary[] = await Promise.all(
		events.map(async (record) => {
			const tournaments = await db.tournaments.listTournaments(record.id);
			return {
				...record,
				tournaments
			};
		})
	);

	return {
		events: summaries
	};
};
