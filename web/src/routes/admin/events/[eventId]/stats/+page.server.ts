import type { PageServerLoad } from './$types';
import { getDatabase } from '$lib/server/db';

export const load: PageServerLoad = async (event) => {
	event.depends(`stats:${event.params.eventId}`);

	const db = getDatabase(event);
	
	const eventStats = await db.playerStats.listPlayerStats('event', event.params.eventId);
	
	const players = await db.players.listPlayers(event.params.eventId);
	
	const playerMap = new Map(players.map(p => [p.id, p.name]));
	
	const enrichedStats = eventStats.map(stat => {
		const totalGames = stat.wins + stat.losses;
		const winRate = totalGames > 0 ? (stat.wins / totalGames * 100).toFixed(1) : '0.0';
		
		return {
			...stat,
			playerName: playerMap.get(stat.player_id) ?? '(Unknown)',
			totalGames,
			winRate
		};
	});
	
	const sortedStats = enrichedStats.sort((a, b) => {
		if (b.wins !== a.wins) return b.wins - a.wins;
		return parseFloat(b.winRate) - parseFloat(a.winRate);
	});

	return {
		eventId: event.params.eventId,
		stats: sortedStats
	};
};
