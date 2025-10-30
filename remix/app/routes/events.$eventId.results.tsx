import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { getDatabase } from "~/repositories/database.server";
import type { MatchRecord } from "~/repositories/matches";
import type { PlayerRecord } from "~/repositories/players";
import type { PairRecord } from "~/repositories/pairs";
import type { TournamentRecord } from "~/repositories/tournaments";

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
		const tournamentIds = new Set(tournaments.map(t => t.id));
		const battleIds = new Set(teamBattles.map(b => b.id));

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

		// 完了したマッチのみをフィルタリング
		const completedMatches = eventMatches.filter(match => match.status === 'completed');

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
		});
	} catch (error) {
		console.error("[events.$eventId.results:load] failed", {
			eventId,
			error: error instanceof Error ? error.message : error,
		});
		throw new Response("指定したイベントが見つかりません。", { status: 404 });
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: `${data?.event.name || "イベント"} - 結果 | Boost Bracket` },
	{ name: "description", content: `${data?.event.name || "イベント"}の試合結果サマリー` },
];

export default function EventResultsRoute() {
	const { eventId, event, matches, players, pairs, tournaments, bracketMatchToTournamentMap } = useLoaderData<typeof loader>();

	// プレイヤー名とペア名のマップを作成
	const playerNameMap = new Map(players.map((p) => [p.id, p.name]));
	const pairMap = new Map(pairs.map((p) => [p.id, p]));

	const getPairDisplayName = (pairId: string | null | undefined): string => {
		if (!pairId) return "未確定";
		const pair = pairMap.get(pairId);
		if (!pair) return "(不明なペア)";
		const player1Name = playerNameMap.get(pair.player1_id) ?? "?";
		const player2Name = playerNameMap.get(pair.player2_id) ?? "?";
		return `${player1Name} / ${player2Name}`;
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

