import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { getDatabase } from "~/repositories/database.server";
import type { MatchRecord } from "~/repositories/matches";
import type { PlayerRecord } from "~/repositories/players";
import type { PairRecord } from "~/repositories/pairs";
import type { TournamentRecord } from "~/repositories/tournaments";
import type { TeamRecord } from "~/repositories/teams";
import type { TeamBattleRecord } from "~/repositories/team-battles";
import type { TeamBattleSlotRecord } from "~/repositories/team-battle-slots";

type LoaderData = {
	eventId: string;
	event: {
		id: string;
		name: string;
		slug: string | null;
		createdAt: string;
	};
	matches: MatchRecord[];
	players: PlayerRecord[];
	pairs: PairRecord[];
	tournaments: TournamentRecord[];
	bracketMatchToTournamentMap: Record<string, string>; // bracket_match.id -> tournament.id
	teams: TeamRecord[];
	teamBattles: TeamBattleRecord[];
	slotsByBattleId: Record<string, TeamBattleSlotRecord[]>;
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw new Response("Event ID is required", { status: 400 });
	}

	const db = getDatabase(context);

	try {
		const event = await db.events.ensureEvent(eventId);
		
		// イベントに関連する全てのデータを取得
		const [allMatches, players, pairs, tournaments] = await Promise.all([
			db.matches.listMatches(),
			db.players.listPlayers(eventId),
			db.pairs.listPairs(eventId),
			db.tournaments.listTournaments(eventId),
		]);

		// イベントに関連するトーナメントと団体戦のIDを取得
		const teamBattles = await db.teamBattles.listTeamBattles(eventId);
		const teams = await db.teams.listTeams(eventId);
		const tournamentIds = new Set(tournaments.map(t => t.id));
		const battleIds = new Set(teamBattles.map(b => b.id));

		// 各団体戦のスロットを取得
		const slotsByBattleId: Record<string, TeamBattleSlotRecord[]> = {};
		for (const battle of teamBattles) {
			const slots = await db.teamBattleSlots.listSlotsByBattle(battle.id);
			slotsByBattleId[battle.id] = slots;
		}

		// ブラケットマッチIDからトーナメントIDへのマップを作成
		const bracketMatchToTournamentMap = new Map<string, string>();
		for (const tournament of tournaments) {
			const bracketMatches = await db.bracketMatches.listBracketMatches(tournament.id);
			for (const bracketMatch of bracketMatches) {
				bracketMatchToTournamentMap.set(bracketMatch.id, tournament.id);
			}
		}

		// イベントに関連するマッチのみをフィルタリング
		const eventMatches = allMatches.filter(match => {
			if (match.context === 'bracket') {
				const tournamentId = bracketMatchToTournamentMap.get(match.context_id);
				return tournamentId !== undefined && tournamentIds.has(tournamentId);
			}
			if (match.context === 'teamBattle') {
				return battleIds.has(match.context_id);
			}
			return false;
		});

		// 完了または進行中のマッチをフィルタリング（途中の進行状況も表示）
		const completedMatches = eventMatches.filter(match => match.status === 'completed' || match.status === 'in_progress');

		// MapをRecordに変換（シリアライズ可能にするため）
		const bracketMatchToTournamentRecord: Record<string, string> = {};
		bracketMatchToTournamentMap.forEach((tournamentId, bracketMatchId) => {
			bracketMatchToTournamentRecord[bracketMatchId] = tournamentId;
		});

		return json<LoaderData>({
			eventId,
			event: {
				id: event.id,
				name: event.name,
				slug: event.slug,
				createdAt: event.createdAt,
			},
			matches: completedMatches,
			players,
			pairs,
			tournaments,
			bracketMatchToTournamentMap: bracketMatchToTournamentRecord,
			teams,
			teamBattles,
			slotsByBattleId,
		});
	} catch (error) {
		console.error("[admin.events.$eventId.results:load] failed", {
			eventId,
			error: error instanceof Error ? error.message : error,
		});
		throw new Response("指定したイベントが見つかりません。", { status: 404 });
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: `${data?.event.name || "イベント"} - 結果 - 管理 | Boost Bracket` },
	{ name: "description", content: `${data?.event.name || "イベント"}の試合結果サマリー（管理画面）` },
];

export default function AdminEventResultsRoute() {
	const { eventId, event, matches, players, pairs, tournaments, bracketMatchToTournamentMap, teams, teamBattles, slotsByBattleId } = useLoaderData<typeof loader>();

	// プレイヤー名とペア名のマップを作成
	const playerNameMap = new Map(players.map((p) => [p.id, p.name]));
	const pairMap = new Map(pairs.map((p) => [p.id, p]));
	const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));
	const pairRecordMap = new Map(pairs.map((p) => [p.id, p]));

	const getPairDisplayName = (pairId: string | null | undefined): string => {
		if (!pairId) return "未確定";
		const pair = pairMap.get(pairId);
		if (!pair) return "(不明なペア)";
		const player1Name = playerNameMap.get(pair.player1_id) ?? "?";
		const player2Name = playerNameMap.get(pair.player2_id) ?? "?";
		return `${player1Name} / ${player2Name}`;
	};

	// スロットのプレイヤー名をフォーマット
	const formatSlotPlayers = (slot: TeamBattleSlotRecord): string => {
		if (slot.assignment_type === "pair" && slot.pair_id) {
			const pair = pairRecordMap.get(slot.pair_id);
			if (pair) {
				const player1Name = playerNameMap.get(pair.player1_id) ?? "?";
				const player2Name = playerNameMap.get(pair.player2_id) ?? "?";
				return `${player1Name} / ${player2Name}`;
			}
			return "(不明なペア)";
		} else {
			const player1Name = slot.player1_id ? (playerNameMap.get(slot.player1_id) ?? "?") : "-";
			const player2Name = slot.player2_id ? (playerNameMap.get(slot.player2_id) ?? "?") : "-";
			return `${player1Name} / ${player2Name}`;
		}
	};

	// 団体戦のスコアを集計
	const getBattleScore = (battleMatches: MatchRecord[]) => {
		let a = 0;
		let b = 0;
		for (const match of battleMatches) {
			if (match.winner_side === "a") {
				a++;
			} else if (match.winner_side === "b") {
				b++;
			}
		}
		return { a, b };
	};

	// スロットをslot_indexでグループ化
	const groupSlotsByIndex = (slots: TeamBattleSlotRecord[], teamAId: string, teamBId: string) => {
		const map = new Map<number, { a?: TeamBattleSlotRecord; b?: TeamBattleSlotRecord }>();
		for (const slot of slots) {
			const existing = map.get(slot.slot_index) ?? {};
			if (slot.team_id === teamAId) {
				existing.a = slot;
			} else if (slot.team_id === teamBId) {
				existing.b = slot;
			}
			map.set(slot.slot_index, existing);
		}
		return Array.from(map.entries()).sort((x, y) => x[0] - y[0]);
	};

	// 勝利数の集計（ペア単位）
	const pairWinCounts = new Map<string, number>();
	const pairLossCounts = new Map<string, number>();

	matches.forEach(match => {
		if (match.side_a_type === 'pair' && match.side_a_pair_id) {
			if (match.winner_side === 'a') {
				pairWinCounts.set(match.side_a_pair_id, (pairWinCounts.get(match.side_a_pair_id) || 0) + 1);
			} else {
				pairLossCounts.set(match.side_a_pair_id, (pairLossCounts.get(match.side_a_pair_id) || 0) + 1);
			}
		}
		if (match.side_b_type === 'pair' && match.side_b_pair_id) {
			if (match.winner_side === 'b') {
				pairWinCounts.set(match.side_b_pair_id, (pairWinCounts.get(match.side_b_pair_id) || 0) + 1);
			} else {
				pairLossCounts.set(match.side_b_pair_id, (pairLossCounts.get(match.side_b_pair_id) || 0) + 1);
			}
		}
	});

	// 勝利数でソートしたペアのリスト
	const pairStats = Array.from(new Set([...pairWinCounts.keys(), ...pairLossCounts.keys()]))
		.map(pairId => ({
			pairId,
			name: getPairDisplayName(pairId),
			wins: pairWinCounts.get(pairId) || 0,
			losses: pairLossCounts.get(pairId) || 0,
			total: (pairWinCounts.get(pairId) || 0) + (pairLossCounts.get(pairId) || 0),
		}))
		.filter(stat => stat.total > 0)
		.sort((a, b) => {
			// 勝利数でソート、同点の場合は総試合数でソート
			if (b.wins !== a.wins) {
				return b.wins - a.wins;
			}
			return b.total - a.total;
		});

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h2 className="text-2xl font-bold text-slate-900">結果サマリー</h2>
				<p className="text-sm text-slate-600">
					このイベントの試合結果と統計情報を表示しています。
				</p>
			</header>

			{/* 基本統計 */}
			<section className="grid gap-4 md:grid-cols-3">
				<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
					<div className="text-sm font-medium text-slate-500 mb-1">総試合数</div>
					<div className="text-2xl font-bold text-slate-900">{matches.length}</div>
				</div>
				<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
					<div className="text-sm font-medium text-slate-500 mb-1">参加プレイヤー数</div>
					<div className="text-2xl font-bold text-slate-900">{players.length}</div>
				</div>
				<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
					<div className="text-sm font-medium text-slate-500 mb-1">参加ペア数</div>
					<div className="text-2xl font-bold text-slate-900">{pairs.length}</div>
				</div>
			</section>

			{/* トーナメント一覧 */}
			{matches.length > 0 && (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="text-lg font-semibold text-slate-900 mb-4">
						トーナメント結果 ({tournaments.length})
					</h3>
					{tournaments.length === 0 ? (
						<p className="text-sm text-slate-500">トーナメントはまだ登録されていません。</p>
					) : (
						<div className="grid gap-3 md:grid-cols-2">
							{tournaments.map((tournament) => {
								// matchesテーブルのcontext_idはbracket_match.idを指すため、
								// bracketMatchToTournamentMapを使ってトーナメントIDを取得
								const tournamentMatches = matches.filter(m => {
									if (m.context !== 'bracket') return false;
									const tournamentId = bracketMatchToTournamentMap[m.context_id];
									return tournamentId === tournament.id;
								});
								return (
									<div
										key={tournament.id}
										className="rounded-lg border border-slate-200 bg-slate-50 p-4"
									>
										<div className="font-medium text-slate-900 mb-1">{tournament.name}</div>
										<div className="text-sm text-slate-600">
											完了試合数: {tournamentMatches.length}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</section>
			)}

			{/* 団体戦結果 */}
			{teamBattles.length > 0 && (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="text-lg font-semibold text-slate-900 mb-4">
						団体戦結果 ({teamBattles.length})
					</h3>
					<div className="grid gap-4">
						{teamBattles.map((battle) => {
							const battleMatches = matches.filter(m => m.context === 'teamBattle' && m.context_id === battle.id);
							const score = getBattleScore(battleMatches);
							const slots = slotsByBattleId[battle.id] || [];
							const groupedSlots = groupSlotsByIndex(slots, battle.team_a_id, battle.team_b_id);
							const teamAName = teamNameMap.get(battle.team_a_id) ?? "(不明なチーム)";
							const teamBName = teamNameMap.get(battle.team_b_id) ?? "(不明なチーム)";
							const matchesBySlotIndex = new Map<number, MatchRecord>();
							for (const match of battleMatches) {
								if (match.slot_index !== null && match.slot_index !== undefined) {
									matchesBySlotIndex.set(match.slot_index, match);
								}
							}

							return (
								<div key={battle.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
									<div className="mb-3 flex items-center justify-between">
										<div>
											<div className="font-medium text-slate-900">
												{teamAName} vs {teamBName}
											</div>
											<div className="text-sm text-slate-600">
												スコア: {score.a} - {score.b}
											</div>
											<div className="text-xs text-slate-500 mt-1">
												ステータス: {battle.status === 'completed' ? '完了' : battle.status === 'in_progress' ? '進行中' : '未開始'}
												{battle.result && ` / 結果: ${battle.result === 'team_a_win' ? teamAName + 'の勝利' : battle.result === 'team_b_win' ? teamBName + 'の勝利' : '引き分け'}`}
											</div>
										</div>
										<Link
											to={`/events/${eventId}/team-battles/${battle.id}/board`}
											className="text-sm font-medium text-blue-600 hover:text-blue-800"
										>
											ボードを見る →
										</Link>
									</div>
									{groupedSlots.length > 0 && (
										<div className="mt-3 overflow-x-auto">
											<table className="w-full text-xs">
												<thead>
													<tr className="border-b border-slate-200">
														<th className="text-left py-1 px-2 font-medium text-slate-700">スロット</th>
														<th className="text-left py-1 px-2 font-medium text-slate-700">Team A 出場</th>
														<th className="text-left py-1 px-2 font-medium text-slate-700">Team B 出場</th>
														<th className="text-center py-1 px-2 font-medium text-slate-700">結果</th>
														<th className="text-center py-1 px-2 font-medium text-slate-700">スコア</th>
													</tr>
												</thead>
												<tbody>
													{groupedSlots.map(([slotIndex, slotPair]) => {
														const match = matchesBySlotIndex.get(slotIndex);
														const result = match ? (match.winner_side === 'a' ? 'A勝' : 'B勝') : '未実施';
														const matchScore = match ? `${match.score_a} - ${match.score_b}` : 'ー';

														return (
															<tr key={slotIndex} className="border-b border-slate-100">
																<td className="py-1 px-2 font-medium text-slate-900">{slotIndex + 1}</td>
																<td className="py-1 px-2 text-slate-700">
																	{slotPair.a ? formatSlotPlayers(slotPair.a) : '未割当'}
																</td>
																<td className="py-1 px-2 text-slate-700">
																	{slotPair.b ? formatSlotPlayers(slotPair.b) : '未割当'}
																</td>
																<td className="py-1 px-2 text-center text-slate-700">{result}</td>
																<td className="py-1 px-2 text-center text-slate-700">{matchScore}</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</section>
			)}

			{/* ペア別成績 */}
			{pairStats.length > 0 && (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 className="text-lg font-semibold text-slate-900 mb-4">
						ペア別成績
					</h3>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-slate-200">
									<th className="text-left py-2 px-3 font-medium text-slate-700">ペア</th>
									<th className="text-right py-2 px-3 font-medium text-slate-700">勝利</th>
									<th className="text-right py-2 px-3 font-medium text-slate-700">敗北</th>
									<th className="text-right py-2 px-3 font-medium text-slate-700">総試合数</th>
									<th className="text-right py-2 px-3 font-medium text-slate-700">勝率</th>
								</tr>
							</thead>
							<tbody>
								{pairStats.map((stat) => {
									const winRate = stat.total > 0 ? ((stat.wins / stat.total) * 100).toFixed(1) : '0.0';
									return (
										<tr key={stat.pairId} className="border-b border-slate-100">
											<td className="py-2 px-3 font-medium text-slate-900">{stat.name}</td>
											<td className="py-2 px-3 text-right text-slate-700">{stat.wins}</td>
											<td className="py-2 px-3 text-right text-slate-700">{stat.losses}</td>
											<td className="py-2 px-3 text-right text-slate-700">{stat.total}</td>
											<td className="py-2 px-3 text-right text-slate-700">{winRate}%</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</section>
			)}

			{matches.length === 0 && (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<p className="text-sm text-slate-500">完了した試合はまだありません。</p>
				</section>
			)}
		</div>
	);
}

