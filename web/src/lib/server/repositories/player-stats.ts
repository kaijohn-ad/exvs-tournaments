export interface PlayerStatsData {
	scope: 'event' | 'tournament' | 'teamBattle' | 'global';
	scope_id?: string;
	player_id: string;
	wins?: number;
	losses?: number;
}

export interface PlayerStatsImportData extends PlayerStatsData {
	id?: string;
}

export interface PlayerStatsRecord extends PlayerStatsData {
	id: string;
	wins: number;
	losses: number;
	last_updated_at: string;
}

const store = new Map<string, PlayerStatsRecord>();

export const listPlayerStats = (scope?: string, scopeId?: string): PlayerStatsRecord[] => {
	const all = Array.from(store.values());
	
	if (scope && scopeId) {
		return all.filter(s => s.scope === scope && s.scope_id === scopeId);
	}
	
	if (scope) {
		return all.filter(s => s.scope === scope);
	}
	
	return all;
};

export const getPlayerStats = (playerId: string, scope: string, scopeId?: string): PlayerStatsRecord | null => {
	const all = Array.from(store.values());
	return all.find(s => 
		s.player_id === playerId && 
		s.scope === scope && 
		s.scope_id === scopeId
	) ?? null;
};

export const createPlayerStats = (data: PlayerStatsData): PlayerStatsRecord => {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	const record: PlayerStatsRecord = {
		id,
		scope: data.scope,
		scope_id: data.scope_id,
		player_id: data.player_id,
		wins: data.wins ?? 0,
		losses: data.losses ?? 0,
		last_updated_at: now
	};

	store.set(id, record);
	return record;
};

export const ensurePlayerStats = (statsId: string): PlayerStatsRecord => {
	const record = store.get(statsId);

	if (!record) {
		throw new Error('Player stats not found');
	}

	return record;
};

export const updatePlayerStats = (statsId: string, data: PlayerStatsData): PlayerStatsRecord => {
	const existing = ensurePlayerStats(statsId);
	const now = new Date().toISOString();

	const updated: PlayerStatsRecord = {
		...existing,
		scope: data.scope,
		scope_id: data.scope_id,
		player_id: data.player_id,
		wins: data.wins ?? existing.wins,
		losses: data.losses ?? existing.losses,
		last_updated_at: now
	};

	store.set(statsId, updated);
	return updated;
};

export const incrementPlayerStats = (playerId: string, scope: string, scopeId: string | undefined, won: boolean): PlayerStatsRecord => {
	let stats = getPlayerStats(playerId, scope, scopeId);
	
	if (!stats) {
		stats = createPlayerStats({
			scope: scope as any,
			scope_id: scopeId,
			player_id: playerId,
			wins: won ? 1 : 0,
			losses: won ? 0 : 1
		});
	} else {
		const now = new Date().toISOString();
		const updated: PlayerStatsRecord = {
			...stats,
			wins: stats.wins + (won ? 1 : 0),
			losses: stats.losses + (won ? 0 : 1),
			last_updated_at: now
		};
		store.set(stats.id, updated);
		stats = updated;
	}
	
	return stats;
};

export const deletePlayerStats = (statsId: string): void => {
	ensurePlayerStats(statsId);
	store.delete(statsId);
};

export const setPlayerStats = (stats: PlayerStatsImportData[]): PlayerStatsRecord[] => {
	store.clear();

	const results: PlayerStatsRecord[] = [];
	const now = new Date().toISOString();

	for (const stat of stats) {
		if (!stat.player_id || !stat.scope) {
			continue;
		}

		const id = stat.id ?? crypto.randomUUID();
		const record: PlayerStatsRecord = {
			id,
			scope: stat.scope,
			scope_id: stat.scope_id,
			player_id: stat.player_id,
			wins: stat.wins ?? 0,
			losses: stat.losses ?? 0,
			last_updated_at: now
		};

		store.set(id, record);
		results.push(record);
	}

	return results;
};

export const __resetForTests = () => {
	store.clear();
};
