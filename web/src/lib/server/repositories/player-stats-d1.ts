import type { PlayerStatsData, PlayerStatsImportData, PlayerStatsRecord } from './player-stats';

export const createPlayerStatsRepositoryD1 = (db: D1Database) => {
	return {
		async listPlayerStats(scope?: string, scopeId?: string): Promise<PlayerStatsRecord[]> {
			let query = 'SELECT * FROM player_stats';
			const bindings: string[] = [];

			if (scope && scopeId) {
				query += ' WHERE scope = ? AND scope_id = ?';
				bindings.push(scope, scopeId);
			} else if (scope) {
				query += ' WHERE scope = ?';
				bindings.push(scope);
			}

			query += ' ORDER BY wins DESC, losses ASC';

			const stmt = db.prepare(query);
			const result = await (bindings.length > 0 ? stmt.bind(...bindings) : stmt).all<PlayerStatsRecord>();

			return result.results || [];
		},

		async getPlayerStats(playerId: string, scope: string, scopeId?: string): Promise<PlayerStatsRecord | null> {
			const result = await db
				.prepare(
					'SELECT * FROM player_stats WHERE player_id = ? AND scope = ? AND scope_id IS ?'
				)
				.bind(playerId, scope, scopeId ?? null)
				.first<PlayerStatsRecord>();

			return result ?? null;
		},

		async createPlayerStats(data: PlayerStatsData): Promise<PlayerStatsRecord> {
			const id = crypto.randomUUID();
			const now = new Date().toISOString();
			const wins = data.wins ?? 0;
			const losses = data.losses ?? 0;

			await db
				.prepare(
					`INSERT INTO player_stats 
					(id, scope, scope_id, player_id, wins, losses, last_updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					id,
					data.scope,
					data.scope_id ?? null,
					data.player_id,
					wins,
					losses,
					now
				)
				.run();

			return {
				id,
				scope: data.scope,
				scope_id: data.scope_id,
				player_id: data.player_id,
				wins,
				losses,
				last_updated_at: now
			};
		},

		async ensurePlayerStats(statsId: string): Promise<PlayerStatsRecord> {
			const result = await db
				.prepare('SELECT * FROM player_stats WHERE id = ?')
				.bind(statsId)
				.first<PlayerStatsRecord>();

			if (!result) {
				throw new Error('Player stats not found');
			}

			return result;
		},

		async updatePlayerStats(statsId: string, data: PlayerStatsData): Promise<PlayerStatsRecord> {
			const existing = await this.ensurePlayerStats(statsId);
			const now = new Date().toISOString();

			const wins = data.wins ?? existing.wins;
			const losses = data.losses ?? existing.losses;

			await db
				.prepare(
					`UPDATE player_stats 
					SET scope = ?, scope_id = ?, player_id = ?, wins = ?, losses = ?, last_updated_at = ?
					WHERE id = ?`
				)
				.bind(
					data.scope,
					data.scope_id ?? null,
					data.player_id,
					wins,
					losses,
					now,
					statsId
				)
				.run();

			return {
				id: statsId,
				scope: data.scope,
				scope_id: data.scope_id,
				player_id: data.player_id,
				wins,
				losses,
				last_updated_at: now
			};
		},

		async incrementPlayerStats(playerId: string, scope: string, scopeId: string | undefined, won: boolean): Promise<PlayerStatsRecord> {
			let stats = await this.getPlayerStats(playerId, scope, scopeId);
			
			if (!stats) {
				stats = await this.createPlayerStats({
					scope: scope as any,
					scope_id: scopeId,
					player_id: playerId,
					wins: won ? 1 : 0,
					losses: won ? 0 : 1
				});
			} else {
				const now = new Date().toISOString();
				const wins = stats.wins + (won ? 1 : 0);
				const losses = stats.losses + (won ? 0 : 1);

				await db
					.prepare(
						`UPDATE player_stats 
						SET wins = ?, losses = ?, last_updated_at = ?
						WHERE id = ?`
					)
					.bind(wins, losses, now, stats.id)
					.run();

				stats = {
					...stats,
					wins,
					losses,
					last_updated_at: now
				};
			}
			
			return stats;
		},

		async deletePlayerStats(statsId: string): Promise<void> {
			await this.ensurePlayerStats(statsId);
			await db.prepare('DELETE FROM player_stats WHERE id = ?').bind(statsId).run();
		},

		async setPlayerStats(stats: PlayerStatsImportData[]): Promise<PlayerStatsRecord[]> {
			await db.prepare('DELETE FROM player_stats').run();

			const results: PlayerStatsRecord[] = [];
			const now = new Date().toISOString();

			for (const stat of stats) {
				if (!stat.player_id || !stat.scope) {
					continue;
				}

				const id = stat.id ?? crypto.randomUUID();
				const wins = stat.wins ?? 0;
				const losses = stat.losses ?? 0;

				await db
					.prepare(
						`INSERT INTO player_stats 
						(id, scope, scope_id, player_id, wins, losses, last_updated_at)
						VALUES (?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						id,
						stat.scope,
						stat.scope_id ?? null,
						stat.player_id,
						wins,
						losses,
						now
					)
					.run();

				results.push({
					id,
					scope: stat.scope,
					scope_id: stat.scope_id,
					player_id: stat.player_id,
					wins,
					losses,
					last_updated_at: now
				});
			}

			return results;
		}
	};
};
