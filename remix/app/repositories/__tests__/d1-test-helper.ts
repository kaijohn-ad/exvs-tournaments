import { afterEach, beforeAll, afterAll } from "vitest";
import { generateUUID } from "~/utils/uuid";
import { getDatabase } from "../database.server";
import type { AppLoadContext } from "@remix-run/cloudflare";
import type { CloudflareContext } from "../../../load-context";

// テスト用D1データベースの設定
let testDb: D1Database | null = null;
let testContext: AppLoadContext | null = null;

export async function setupTestDatabase(): Promise<{ db: D1Database; context: AppLoadContext }> {
	// テスト用のD1データベースを作成（実際の環境ではwranglerのテスト用DBを使用）
	// ここではモックを使用してテストを実行
	const mockDb = createMockD1Database();
	
	testDb = mockDb as unknown as D1Database;
	
	// CloudflareContext型に準拠したテスト用コンテキストを作成
	const cloudflareContext: CloudflareContext = {
		env: {
			DB: testDb,
		} as Env,
		ctx: {
			waitUntil: () => {},
			passThroughOnException: () => {},
			props: {},
		},
		caches: (globalThis as unknown as { caches?: CacheStorage }).caches || ({} as CacheStorage),
		cf: {} as Request["cf"],
	};

	testContext = {
		cloudflare: cloudflareContext,
		db: testDb,
	} as AppLoadContext;

	// テスト用スキーマを初期化
	await initializeTestSchema(testDb as unknown as D1Database);

	return { db: testDb, context: testContext! };
}

export function getTestDatabase() {
	if (!testDb || !testContext) {
		throw new Error("Test database not initialized. Call setupTestDatabase() first.");
	}
	return { db: testDb, context: testContext };
}

export async function cleanupTestDatabase() {
	if (testDb) {
		// テストデータをクリーンアップ
		await cleanupTestData(testDb as unknown as D1Database);
	}
	testDb = null;
	testContext = null;
}

// モックD1データベースの作成
function createMockD1Database() {
	const tables = new Map<string, Map<string, any>>();
	
	return {
		prepare: (sql: string) => {
			let boundParams: any[] = [];
			const makeAll = async () => {
				const tableName = extractTableName(sql);
				if (!tableName) return { results: [] };
				const table = tables.get(tableName) || new Map();
				let results = Array.from(table.values());
				if (sql.includes('WHERE')) {
				const filteredResults = results.filter((row) => {
						if (sql.includes('slug = ?') && boundParams.length > 0) {
							return row.slug === boundParams[0];
						}
					if (sql.includes('event_id = ?') && boundParams.length > 0) {
						let result = row.event_id === boundParams[0];
						if (sql.includes('AND deleted_at IS NULL')) {
							result = result && (row.deleted_at === null || row.deleted_at === undefined);
						}
						return result;
					}
					if (/\bid\s*=\s*\?/i.test(sql) && boundParams.length > 0) {
						let result = row.id === boundParams[0];
						if (sql.includes('AND deleted_at IS NULL')) {
							result = result && (row.deleted_at === null || row.deleted_at === undefined);
						}
						return result;
					}
						if (sql.includes('context = ?') && boundParams.length > 0) {
							return row.context === boundParams[0] && (!sql.includes('AND context_id = ?') || row.context_id === boundParams[1]);
						}
						if (sql.includes('tournament_id = ?') && boundParams.length > 0) {
							let result = row.tournament_id === boundParams[0];
							if (sql.includes("status = 'active'")) {
								result = result && row.status === 'active';
							}
							if (sql.includes('AND pair_id = ?') && boundParams.length > 1) {
								result = result && row.pair_id === boundParams[1];
							}
							if (sql.includes('AND player_id = ?') && boundParams.length > 1) {
								result = result && row.player_id === boundParams[1];
							}
							return result;
						}
					if (sql.includes('player_id = ?')) {
						// getPlayerStats: player_id=?, scope=?, scope_id IS ?
						if (/player_id = \? AND scope = \? AND scope_id IS \?/i.test(sql)) {
							return (
								row.player_id === boundParams[0] &&
								row.scope === boundParams[1] &&
								row.scope_id === (boundParams[2] ?? null)
							);
						}
						return row.player_id === boundParams[0];
					}
					if (sql.includes('scope = ?') && boundParams.length > 0) {
						let result = true;
						if (sql.includes('AND scope_id = ?')) {
							result = row.scope === boundParams[0] && row.scope_id === boundParams[1];
						} else if (sql.includes('AND scope_id IS ?')) {
							result = row.scope === boundParams[0] && row.scope_id === (boundParams[1] ?? null);
						} else {
							result = row.scope === boundParams[0];
						}
						return result;
					}
						return true;
					});
					results = filteredResults;
				}
				// ORDER BY handling
				if (/ORDER BY name COLLATE NOCASE/i.test(sql)) {
					results.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ja', { sensitivity: 'base' }));
				}
				if (/ORDER BY seed ASC, id ASC/i.test(sql)) {
					results.sort((a, b) => {
						const as = a.seed ?? Number.MAX_SAFE_INTEGER;
						const bs = b.seed ?? Number.MAX_SAFE_INTEGER;
						if (as !== bs) return as - bs;
						return String(a.id).localeCompare(String(b.id));
					});
				}
				if (/ORDER BY seed ASC/i.test(sql)) {
					results.sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER) || String(a.id).localeCompare(String(b.id)));
				}
				if (/ORDER BY.*CASE WHEN seed IS NULL THEN 1 ELSE 0 END.*seed ASC.*created_at ASC/i.test(sql)) {
					results.sort((a, b) => {
						const an = a.seed === null || a.seed === undefined ? 1 : 0;
						const bn = b.seed === null || b.seed === undefined ? 1 : 0;
						if (an !== bn) return an - bn;
						const as = a.seed ?? Number.MAX_SAFE_INTEGER;
						const bs = b.seed ?? Number.MAX_SAFE_INTEGER;
						if (as !== bs) return as - bs;
						return String(a.created_at).localeCompare(String(b.created_at));
					});
				}
				if (/ORDER BY created_at DESC/i.test(sql)) {
					results.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
				}
				if (/ORDER BY wins DESC, losses ASC/i.test(sql)) {
					results.sort((a, b) => (b.wins - a.wins) || (a.losses - b.losses));
				}
				if (/ORDER BY round ASC, position ASC/i.test(sql)) {
					results.sort((a, b) => (a.round - b.round) || (a.position - b.position));
				}
				if (/ORDER BY played_at DESC/i.test(sql)) {
					results.sort((a, b) => String(b.played_at).localeCompare(String(a.played_at)));
				}
				if (/CASE WHEN slot_index IS NULL THEN 1 ELSE 0 END, slot_index ASC, played_at ASC/i.test(sql)) {
					results.sort((a, b) => {
						const an = a.slot_index === null || a.slot_index === undefined ? 1 : 0;
						const bn = b.slot_index === null || b.slot_index === undefined ? 1 : 0;
						if (an !== bn) return an - bn;
						const as = a.slot_index ?? Number.MAX_SAFE_INTEGER;
						const bs = b.slot_index ?? Number.MAX_SAFE_INTEGER;
						if (as !== bs) return as - bs;
						return String(a.played_at).localeCompare(String(b.played_at));
					});
				}
				return { results };
			};
			const makeFirst = async () => {
				if (/SELECT COUNT\(\*\)/i.test(sql)) {
					const all = await makeAll();
					return { count: all.results?.length ?? 0 };
				}
				const all = await makeAll();
				return (all.results && all.results[0]) || null;
			};
			const makeRun = async () => {
				await executeSQL(sql, boundParams, tables);
				let changes = 0;
				if (sql.toUpperCase().includes('UPDATE')) {
					const tableName = extractTableName(sql);
					if (tableName === 'pairs' && /SET deleted_at = \? WHERE id = \? AND deleted_at IS NULL/i.test(sql)) {
						const [deletedAt, id] = boundParams;
						const table = tables.get(tableName);
						if (table) {
							const existing = table.get(id);
							// executeSQL実行後の状態を確認
							if (existing && existing.deleted_at === deletedAt) {
								changes = 1;
							}
						}
					} else {
						changes = 1; // 他のUPDATEはとりあえず1を返す
					}
				} else if (sql.toUpperCase().includes('DELETE FROM')) {
					changes = 1;
				} else if (sql.toUpperCase().includes('INSERT INTO')) {
					changes = 1;
				}
				return { success: true, meta: { duration: 0, changes } } as const;
			};
			return {
				bind: (...params: any[]) => {
					boundParams = params;
					return { all: makeAll, first: makeFirst, run: makeRun };
				},
				all: makeAll,
				first: makeFirst,
				run: makeRun,
			};
		},
	};
}

// SQLからテーブル名を抽出する簡単な実装
function extractTableName(sql: string): string | null {
	const selectMatch = sql.match(/FROM\s+(\w+)/i);
	if (selectMatch) return selectMatch[1];
	
	const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)/i);
	if (insertMatch) return insertMatch[1];
	
	const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
	if (updateMatch) return updateMatch[1];
	
	const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
	if (deleteMatch) return deleteMatch[1];
	
	return null;
}

// 簡単なSQL実行（テスト用）
async function executeSQL(sql: string, params: any[], tables: Map<string, Map<string, any>>) {
	const tableName = extractTableName(sql);
	if (!tableName) return;
	
	if (!tables.has(tableName)) {
		tables.set(tableName, new Map());
	}
	
		const table = tables.get(tableName)!;
	
	if (sql.toUpperCase().includes('INSERT INTO')) {
			const id = params[0] ?? generateUUID();
		const now = new Date().toISOString();
		
		// テーブル別のINSERT処理
		if (tableName === 'events') {
			table.set(id, { id, name: params[1] || '', slug: params[2] ?? null, created_at: params[3] ?? now });
		} else if (tableName === 'players') {
			// rudimentary FK: require event to exist when inserting
			const events = tables.get('events');
			if (!events || !events.has(params[1])) throw new Error('FK violation: event not found');
			table.set(id, { id, event_id: params[1] || '', name: params[2] || '', note: params[3] ?? null, created_at: now });
		} else if (tableName === 'pairs') {
			const events = tables.get('events');
			if (!events || !events.has(params[1])) throw new Error('FK violation: event not found');
			const playersTable = tables.get('players');
			if (!playersTable || !playersTable.has(params[2]) || !playersTable.has(params[3])) {
				throw new Error('FK violation: player not found');
			}
			table.set(id, { id, event_id: params[1] || '', player1_id: params[2] || '', player2_id: params[3] || '', seed: params[4] ?? null, created_at: now, deleted_at: null });
		} else if (tableName === 'tournaments') {
			const events = tables.get('events');
			if (!events || !events.has(params[1])) throw new Error('FK violation: event not found');
			table.set(id, { id, event_id: params[1] || '', name: params[2] || '', format: params[3] || 'single-elimination', seeding_mode: params[4] || 'random', created_at: now });
		} else if (tableName === 'teams') {
			table.set(id, { id, event_id: params[1] || '', name: params[2] || '', created_at: now });
		} else if (tableName === 'team_members') {
			const memberId = id;
			table.set(memberId, { id: memberId, team_id: params[1] || '', player_id: params[2] || '', created_at: now });
		} else if (tableName === 'team_battles') {
			const events = tables.get('events');
			if (!events || !events.has(params[1])) throw new Error('FK violation: event not found');
			table.set(id, {
				id,
				event_id: params[1] || '',
				team_a_id: params[2] || null,
				team_b_id: params[3] || null,
				slots_count: params[4] ?? 0,
				format: params[5] || 'waseda',
				allow_double_appearance_per_team: Boolean(params[6]),
				tiebreak: params[7] || 'off',
				status: params[8] || 'pending',
				result: params[9] ?? null,
				created_at: now
			});
		} else if (tableName === 'team_battle_slots') {
			const teamBattles = tables.get('team_battles');
			if (!teamBattles || !teamBattles.has(params[1])) throw new Error('FK violation: team battle not found');
			table.set(id, {
				id,
				team_battle_id: params[1] || '',
				team_id: params[2] || '',
				slot_index: params[3] ?? null,
				assignment_type: params[4] || 'pair',
				pair_id: params[5] ?? null,
				player1_id: params[6] ?? null,
				player2_id: params[7] ?? null,
				created_at: now
			});
		} else if (tableName === 'bracket_matches') {
			const tournaments = tables.get('tournaments');
			if (!tournaments || !tournaments.has(params[1])) throw new Error('FK violation: tournament not found');
			table.set(id, {
				id,
				tournament_id: params[1] || '',
				round: params[2] ?? 1,
				position: params[3] ?? 1,
				participant_a_type: params[4] || 'pair',
				participant_a_pair_id: params[5] ?? null,
				participant_b_type: params[6] || 'pair',
				participant_b_pair_id: params[7] ?? null,
				score_a: params[8] ?? null,
				score_b: params[9] ?? null,
				winner_side: params[10] ?? null,
				status: params[11] || 'pending',
				created_at: params[12] ?? now
			});
		} else if (tableName === 'matches') {
			const pairsTable = tables.get('pairs');
			if (params[4] === 'pair' && params[5] && (!pairsTable || !pairsTable.has(params[5]))) {
				throw new Error('FK violation: pair not found');
			}
			if (params[8] === 'pair' && params[9] && (!pairsTable || !pairsTable.has(params[9]))) {
				throw new Error('FK violation: pair not found');
			}
			table.set(id, {
				id,
				context: params[1] || '',
				context_id: params[2] || '',
				slot_index: params[3] ?? null,
				side_a_type: params[4] || '',
				side_a_pair_id: params[5] ?? null,
				side_a_player1_id: params[6] ?? null,
				side_a_player2_id: params[7] ?? null,
				side_b_type: params[8] || '',
				side_b_pair_id: params[9] ?? null,
				side_b_player1_id: params[10] ?? null,
				side_b_player2_id: params[11] ?? null,
				score_a: params[12] ?? 0,
				score_b: params[13] ?? 0,
				winner_side: params[14] || '',
				status: params[15] || 'completed',
				played_at: params[16] || now
			});
		} else if (tableName === 'player_stats') {
			// bind(id, scope, scope_id, player_id, wins, losses, now)
			table.set(id, { id, scope: params[1] || '', scope_id: params[2] ?? null, player_id: params[3] || '', wins: params[4] ?? 0, losses: params[5] ?? 0, last_updated_at: now });
		} else if (tableName === 'tournament_participants') {
			// INSERT INTO tournament_participants (id, tournament_id, participant_type, pair_id, player_id, seed, note, status, created_at)
			// VALUES (?, ?, 'pair', ?, NULL, ?, ?, 'active', ?)
			// bind(id, tournamentId, pairId, seed, note, createdAt) -> params[0]=id, params[1]=tournamentId, params[2]=pairId, params[3]=seed, params[4]=note, params[5]=createdAt
			// or VALUES (?, ?, 'solo', NULL, ?, NULL, ?, 'active', ?)
			// bind(id, tournamentId, playerId, note, createdAt) -> params[0]=id, params[1]=tournamentId, params[2]=playerId, params[3]=note, params[4]=createdAt
			const tournaments = tables.get('tournaments');
			if (!tournaments || !tournaments.has(params[1])) throw new Error('FK violation: tournament not found');
			
			// SQLからparticipant_typeを判定（'pair'または'solo'が含まれているか）
			const isPair = sql.includes("'pair'");
			let record: any = {
				id,
				tournament_id: params[1],
				participant_type: isPair ? 'pair' : 'solo',
				status: 'active',
				created_at: params[params.length - 1] ?? now
			};
			
			if (isPair) {
				// params[0]=id, params[1]=tournamentId, params[2]=pairId, params[3]=seed, params[4]=note, params[5]=createdAt
				const pairs = tables.get('pairs');
				if (!pairs || !pairs.has(params[2])) throw new Error('FK violation: pair not found');
				record.pair_id = params[2];
				record.player_id = null;
				record.seed = params[3] ?? null;
				record.note = params[4] ?? null;
			} else {
				// params[0]=id, params[1]=tournamentId, params[2]=playerId, params[3]=note, params[4]=createdAt
				const players = tables.get('players');
				if (!players || !players.has(params[2])) throw new Error('FK violation: player not found');
				record.pair_id = null;
				record.player_id = params[2];
				record.seed = null;
				record.note = params[3] ?? null;
			}
			
			table.set(id, record);
		} else {
			// その他のテーブル用の汎用処理
			table.set(id, { id, ...params.reduce((acc, param, index) => {
				acc[`param${index}`] = param;
				return acc;
			}, {}) });
		}
	} else if (sql.toUpperCase().includes('UPDATE')) {
		// テーブル別のUPDATE処理（主要ケースのみ対応）
		if (tableName === 'events' && /SET name = \?, slug = \? WHERE id = \?/i.test(sql)) {
			const [name, slug, id] = params;
			const existing = table.get(id);
			if (existing) table.set(id, { ...existing, name, slug });
		} else if (tableName === 'players' && /SET name = \?, note = \? WHERE id = \? AND event_id = \?/i.test(sql)) {
			const [name, note, id, eventId] = params;
			const existing = table.get(id);
			if (existing && existing.event_id === eventId) table.set(id, { ...existing, name, note });
		} else if (tableName === 'players' && /SET name = \?, note = \? WHERE id = \?/i.test(sql)) {
			const [name, note, id] = params;
			const existing = table.get(id);
			if (existing) table.set(id, { ...existing, name, note });
		} else if (tableName === 'pairs' && /SET deleted_at = \? WHERE id = \? AND deleted_at IS NULL/i.test(sql)) {
			const [deletedAt, id] = params;
			const existing = table.get(id);
			if (existing && !existing.deleted_at) {
				table.set(id, { ...existing, deleted_at: deletedAt });
			}
		} else if (tableName === 'pairs' && /SET player1_id = \?, player2_id = \?, seed = \? WHERE id = \? AND event_id = \?/i.test(sql)) {
			const [p1, p2, seed, id, eventId] = params;
			const existing = table.get(id);
			if (existing && existing.event_id === eventId) table.set(id, { ...existing, player1_id: p1, player2_id: p2, seed });
		} else if (tableName === 'pairs' && /SET player1_id = \?, player2_id = \?, seed = \? WHERE id = \?/i.test(sql)) {
			const [p1, p2, seed, id] = params;
			const existing = table.get(id);
			if (existing) table.set(id, { ...existing, player1_id: p1, player2_id: p2, seed });
		} else if (tableName === 'tournaments' && /SET name = \?, format = \?, seeding_mode = \? WHERE id = \? AND event_id = \?/i.test(sql)) {
			const [name, format, seeding_mode, id, eventId] = params;
			const existing = table.get(id);
			if (existing && existing.event_id === eventId) table.set(id, { ...existing, name, format, seeding_mode });
		} else if (tableName === 'tournaments' && /SET name = \?, format = \?, seeding_mode = \? WHERE id = \?/i.test(sql)) {
			const [name, format, seeding_mode, id] = params;
			const existing = table.get(id);
			if (existing) table.set(id, { ...existing, name, format, seeding_mode });
		} else if (tableName === 'team_battles' && /SET team_a_id = \?, team_b_id = \?, slots_count = \?, format = \?,[\s\S]*WHERE id = \? AND event_id = \?/i.test(sql)) {
			const [team_a_id, team_b_id, slots_count, format, allow_double, tiebreak, status, result, id, eventId] = params;
			const existing = table.get(id);
			if (existing && existing.event_id === eventId) {
				table.set(id, {
					...existing,
					team_a_id,
					team_b_id,
					slots_count,
					format,
					allow_double_appearance_per_team: Boolean(allow_double),
					tiebreak,
					status,
					result
				});
			}
		} else if (tableName === 'team_battle_slots' && /SET team_id = \?, slot_index = \?, assignment_type = \?,/i.test(sql)) {
			const [team_id, slot_index, assignment_type, pair_id, player1_id, player2_id, id, battleId] = params;
			const existing = table.get(id);
			if (existing && existing.team_battle_id === battleId) {
				table.set(id, {
					...existing,
					team_id,
					slot_index,
					assignment_type,
					pair_id,
					player1_id,
					player2_id
				});
			}
		} else if (tableName === 'bracket_matches' && /SET round = \?, position = \?, participant_a_type = \?, participant_a_pair_id = \?,/i.test(sql)) {
			const [round, position, participant_a_type, participant_a_pair_id, participant_b_type, participant_b_pair_id, score_a, score_b, winner_side, status, tournament_id, id] = params;
			const existing = table.get(id);
			if (existing && existing.tournament_id === tournament_id) {
				table.set(id, {
					...existing,
					round,
					position,
					participant_a_type,
					participant_a_pair_id,
					participant_b_type,
					participant_b_pair_id,
					score_a,
					score_b,
					winner_side,
					status
				});
			}
		} else if (tableName === 'matches' && /SET context = \?, context_id = \?, slot_index = \?, side_a_type = \?,/i.test(sql)) {
			const [context, context_id, slot_index, side_a_type, side_a_pair_id, side_a_player1_id, side_a_player2_id, side_b_type, side_b_pair_id, side_b_player1_id, side_b_player2_id, score_a, score_b, winner_side, status, played_at, id] = params;
			const existing = table.get(id);
			if (existing) table.set(id, { ...existing, context, context_id, slot_index, side_a_type, side_a_pair_id, side_a_player1_id, side_a_player2_id, side_b_type, side_b_pair_id, side_b_player1_id, side_b_player2_id, score_a, score_b, winner_side, status, played_at });
		} else if (tableName === 'player_stats' && /SET scope = \?, scope_id = \?, player_id = \?, wins = \?, losses = \?, last_updated_at = \?\s+WHERE id = \?/i.test(sql)) {
			const [scope, scope_id, player_id, wins, losses, last_updated_at, id] = params;
			const existing = table.get(id);
			if (existing) table.set(id, { ...existing, scope, scope_id, player_id, wins, losses, last_updated_at });
		} else if (tableName === 'tournament_participants' && /SET status = 'removed' WHERE tournament_id = \? AND status = 'active'/i.test(sql)) {
			// removeAll用: すべてのactiveな参加者をremovedに
			const [tournamentId] = params;
			for (const [id, row] of Array.from(table.entries())) {
				if (row.tournament_id === tournamentId && row.status === 'active') {
					table.set(id, { ...row, status: 'removed' });
				}
			}
		} else if (tableName === 'tournament_participants' && /SET status = 'removed' WHERE id = \? AND tournament_id = \? AND status = 'active'/i.test(sql)) {
			const [id, tournamentId] = params;
			const existing = table.get(id);
			if (existing && existing.tournament_id === tournamentId && existing.status === 'active') {
				table.set(id, { ...existing, status: 'removed' });
			}
		} else if (tableName === 'tournament_participants' && /SET seed = \? WHERE id = \? AND tournament_id = \?/i.test(sql)) {
			const [seed, id, tournamentId] = params;
			const existing = table.get(id);
			if (existing && existing.tournament_id === tournamentId) {
				table.set(id, { ...existing, seed: seed ?? null });
			}
		} else if (tableName === 'tournament_participants' && /SET note = \? WHERE id = \? AND tournament_id = \?/i.test(sql)) {
			const [note, id, tournamentId] = params;
			const existing = table.get(id);
			if (existing && existing.tournament_id === tournamentId) {
				table.set(id, { ...existing, note: note?.trim() ?? null });
			}
		} else if (tableName === 'tournaments' && /SET name = \?, format = \?, seeding_mode = \?, entry_mode = \? WHERE id = \?/i.test(sql)) {
			const [name, format, seeding_mode, entry_mode, id] = params;
			const existing = table.get(id);
			if (existing) table.set(id, { ...existing, name, format, seeding_mode, entry_mode });
		}
	} else if (sql.toUpperCase().includes('DELETE FROM')) {
		if (sql.includes('WHERE tournament_id = ?') && params.length > 0) {
			for (const [key, row] of Array.from(table.entries())) {
				if (row.tournament_id === params[0]) table.delete(key);
			}
		} else if (sql.includes('WHERE team_battle_id = ?') && params.length > 0) {
			for (const [key, row] of Array.from(table.entries())) {
				if (row.team_battle_id === params[0]) table.delete(key);
			}
		} else if (sql.includes('WHERE tournament_id = ? AND id = ?') && params.length > 1) {
			const [tournamentId, idToDelete] = params;
			const existing = table.get(idToDelete);
			if (existing && existing.tournament_id === tournamentId) table.delete(idToDelete);
		} else if (sql.includes('WHERE id = ?') && params.length > 0) {
			table.delete(params[0]);
		} else {
			table.clear();
		}
	}
}

// テスト用スキーマの初期化
async function initializeTestSchema(db: D1Database) {
	// 実際のスキーマファイルから読み込む
	const schema = `
		CREATE TABLE IF NOT EXISTS events (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			slug TEXT UNIQUE,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS players (
			id TEXT PRIMARY KEY,
			event_id TEXT NOT NULL,
			name TEXT NOT NULL,
			note TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS pairs (
			id TEXT PRIMARY KEY,
			event_id TEXT NOT NULL,
			player1_id TEXT NOT NULL,
			player2_id TEXT NOT NULL,
			seed INTEGER,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			deleted_at TEXT,
			FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
			FOREIGN KEY (player1_id) REFERENCES players(id) ON DELETE CASCADE,
			FOREIGN KEY (player2_id) REFERENCES players(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS tournaments (
			id TEXT PRIMARY KEY,
			event_id TEXT NOT NULL,
			name TEXT NOT NULL,
			format TEXT NOT NULL DEFAULT 'single-elimination',
			seeding_mode TEXT NOT NULL DEFAULT 'random',
			entry_mode TEXT NOT NULL DEFAULT 'pair' CHECK(entry_mode IN ('pair','solo')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS tournament_participants (
			id TEXT PRIMARY KEY,
			tournament_id TEXT NOT NULL,
			participant_type TEXT NOT NULL CHECK(participant_type IN ('pair','solo')),
			pair_id TEXT,
			player_id TEXT,
			seed INTEGER,
			note TEXT,
			status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
			FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE CASCADE,
			FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
			UNIQUE(tournament_id, pair_id),
			UNIQUE(tournament_id, player_id),
			CHECK( (participant_type='pair' AND pair_id IS NOT NULL AND player_id IS NULL)
				OR (participant_type='solo' AND player_id IS NOT NULL AND pair_id IS NULL) )
		);

		CREATE TABLE IF NOT EXISTS teams (
			id TEXT PRIMARY KEY,
			event_id TEXT NOT NULL,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS team_members (
			id TEXT PRIMARY KEY,
			team_id TEXT NOT NULL,
			player_id TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
			FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
			UNIQUE(team_id, player_id)
		);

		CREATE TABLE IF NOT EXISTS team_battles (
			id TEXT PRIMARY KEY,
			event_id TEXT NOT NULL,
			team_a_id TEXT NOT NULL,
			team_b_id TEXT NOT NULL,
			slots_count INTEGER NOT NULL DEFAULT 3 CHECK(slots_count >= 1 AND slots_count <= 5),
			format TEXT NOT NULL DEFAULT 'waseda',
			allow_double_appearance_per_team INTEGER NOT NULL DEFAULT 1,
			tiebreak TEXT NOT NULL DEFAULT 'off' CHECK(tiebreak IN ('off', 'representative')),
			status TEXT NOT NULL DEFAULT 'pending',
			result TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
			FOREIGN KEY (team_a_id) REFERENCES teams(id) ON DELETE CASCADE,
			FOREIGN KEY (team_b_id) REFERENCES teams(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS team_battle_slots (
			id TEXT PRIMARY KEY,
			team_battle_id TEXT NOT NULL,
			team_id TEXT NOT NULL,
			slot_index INTEGER NOT NULL,
			assignment_type TEXT NOT NULL CHECK(assignment_type IN ('pair', 'adhoc')),
			pair_id TEXT,
			player1_id TEXT,
			player2_id TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (team_battle_id) REFERENCES team_battles(id) ON DELETE CASCADE,
			FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
			FOREIGN KEY (pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
			FOREIGN KEY (player1_id) REFERENCES players(id) ON DELETE SET NULL,
			FOREIGN KEY (player2_id) REFERENCES players(id) ON DELETE SET NULL,
			UNIQUE(team_battle_id, team_id, slot_index)
		);

		CREATE TABLE IF NOT EXISTS matches (
			id TEXT PRIMARY KEY,
			context TEXT NOT NULL CHECK(context IN ('bracket', 'teamBattle', 'tiebreak')),
			context_id TEXT NOT NULL,
			slot_index INTEGER,
			side_a_type TEXT NOT NULL CHECK(side_a_type IN ('pair', 'adhoc')),
			side_a_pair_id TEXT,
			side_a_player1_id TEXT,
			side_a_player2_id TEXT,
			side_b_type TEXT NOT NULL CHECK(side_b_type IN ('pair', 'adhoc')),
			side_b_pair_id TEXT,
			side_b_player1_id TEXT,
			side_b_player2_id TEXT,
			score_a INTEGER NOT NULL,
			score_b INTEGER NOT NULL,
			winner_side TEXT NOT NULL CHECK(winner_side IN ('a', 'b')),
			status TEXT NOT NULL DEFAULT 'completed',
			played_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (side_a_pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
			FOREIGN KEY (side_a_player1_id) REFERENCES players(id) ON DELETE SET NULL,
			FOREIGN KEY (side_a_player2_id) REFERENCES players(id) ON DELETE SET NULL,
			FOREIGN KEY (side_b_pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
			FOREIGN KEY (side_b_player1_id) REFERENCES players(id) ON DELETE SET NULL,
			FOREIGN KEY (side_b_player2_id) REFERENCES players(id) ON DELETE SET NULL
		);

		CREATE TABLE IF NOT EXISTS bracket_matches (
			id TEXT PRIMARY KEY,
			tournament_id TEXT NOT NULL,
			round INTEGER NOT NULL,
			position INTEGER NOT NULL,
			participant_a_type TEXT CHECK(participant_a_type IN ('pair', 'bye')),
			participant_a_pair_id TEXT,
			participant_b_type TEXT CHECK(participant_b_type IN ('pair', 'bye')),
			participant_b_pair_id TEXT,
			score_a INTEGER,
			score_b INTEGER,
			winner_side TEXT CHECK(winner_side IN ('a', 'b', NULL)),
			status TEXT NOT NULL DEFAULT 'pending',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
			FOREIGN KEY (participant_a_pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
			FOREIGN KEY (participant_b_pair_id) REFERENCES pairs(id) ON DELETE SET NULL,
			UNIQUE(tournament_id, round, position)
		);

		CREATE TABLE IF NOT EXISTS player_stats (
			id TEXT PRIMARY KEY,
			scope TEXT NOT NULL CHECK(scope IN ('event', 'tournament', 'teamBattle', 'global')),
			scope_id TEXT,
			player_id TEXT NOT NULL,
			wins INTEGER NOT NULL DEFAULT 0,
			losses INTEGER NOT NULL DEFAULT 0,
			last_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
		);
	`;

	// スキーマを実行（モックでは実際には何もしない）
	console.log("Test schema initialized");
}

// テストデータのクリーンアップ
async function cleanupTestData(db: D1Database) {
	// モックでは実際には何もしない
	console.log("Test data cleaned up");
}

// テスト用のデータベースコンテキストを取得
export function getTestDatabaseContext() {
	const { db, context } = getTestDatabase();
	return getDatabase(context);
}
