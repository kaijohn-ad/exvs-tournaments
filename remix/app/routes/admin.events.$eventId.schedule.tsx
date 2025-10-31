import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { getDatabase } from "~/repositories/database.server";
import type { MatchRecord } from "~/repositories/matches";
import type { PlayerRecord } from "~/repositories/players";
import type { PairRecord } from "~/repositories/pairs";
import type { BracketMatchRecord } from "~/repositories/bracket-matches";

type EnrichedMatchRecord = MatchRecord & {
	// bracket_matchesから変換された試合の場合、BYE情報を保持
	isBracketMatch?: boolean;
	sideAIsBye?: boolean;
	sideBIsBye?: boolean;
	// 追加順を保持するためのcreated_at
	created_at?: string;
};

type LoaderData = {
	eventId: string;
	event: {
		id: string;
		name: string;
		slug: string | null;
		createdAt: string;
	};
	matches: EnrichedMatchRecord[];
	players: PlayerRecord[];
	pairs: PairRecord[];
};

// bracket_matchesをMatchRecord形式に変換する関数
function convertBracketMatchToMatchRecord(
	bracketMatch: BracketMatchRecord,
	tournamentId: string
): EnrichedMatchRecord {
	return {
		id: bracketMatch.id,
		context: 'bracket',
		context_id: bracketMatch.id, // matchesテーブルではcontext_idがbracket_match.idになっている
		slot_index: null,
		side_a_type: bracketMatch.participant_a_type === 'bye' ? 'pair' : 'pair',
		side_a_pair_id: bracketMatch.participant_a_type === 'bye' ? undefined : (bracketMatch.participant_a_pair_id ?? undefined),
		side_a_player1_id: undefined,
		side_a_player2_id: undefined,
		side_b_type: bracketMatch.participant_b_type === 'bye' ? 'pair' : 'pair',
		side_b_pair_id: bracketMatch.participant_b_type === 'bye' ? undefined : (bracketMatch.participant_b_pair_id ?? undefined),
		side_b_player1_id: undefined,
		side_b_player2_id: undefined,
		score_a: bracketMatch.score_a ?? 0,
		score_b: bracketMatch.score_b ?? 0,
		winner_side: bracketMatch.winner_side ?? 'a',
		status: bracketMatch.status,
		played_at: '', // 未開始の試合はplayed_atがないので空文字列に
		isBracketMatch: true,
		sideAIsBye: bracketMatch.participant_a_type === 'bye',
		sideBIsBye: bracketMatch.participant_b_type === 'bye',
		created_at: bracketMatch.created_at, // 追加順のためのcreated_at
	};
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw new Response("Event ID is required", { status: 400 });
	}

	const db = getDatabase(context);

	try {
		const event = await db.events.ensureEvent(eventId);
		
		// イベントに関連する全てのマッチを取得
		const [allMatches, players, pairs] = await Promise.all([
			db.matches.listMatches(),
			db.players.listPlayers(eventId),
			db.pairs.listPairs(eventId),
		]);

		// イベントに関連するトーナメントと団体戦のIDを取得
		const [tournaments, teamBattles] = await Promise.all([
			db.tournaments.listTournaments(eventId),
			db.teamBattles.listTeamBattles(eventId),
		]);

		const tournamentIds = new Set(tournaments.map(t => t.id));
		const battleIds = new Set(teamBattles.map(b => b.id));

		// ブラケットマッチIDからトーナメントIDへのマップを作成
		const bracketMatchToTournamentMap = new Map<string, string>();
		const pendingBracketMatches: EnrichedMatchRecord[] = [];
		
		for (const tournament of tournaments) {
			const bracketMatches = await db.bracketMatches.listBracketMatches(tournament.id);
			for (const bracketMatch of bracketMatches) {
				bracketMatchToTournamentMap.set(bracketMatch.id, tournament.id);
				
				// 未開始（pending）または進行中（in_progress）のブラケットマッチをMatchRecord形式に変換
				if (bracketMatch.status === 'pending' || bracketMatch.status === 'in_progress') {
					// matchesテーブルに既に登録されているかチェック
					const existingMatch = allMatches.find(m => m.context === 'bracket' && m.context_id === bracketMatch.id);
					if (!existingMatch) {
						pendingBracketMatches.push(convertBracketMatchToMatchRecord(bracketMatch, tournament.id));
					}
				}
			}
		}

		// イベントに関連するマッチのみをフィルタリング（未開始・進行中の試合のみ）
		const eventMatches = allMatches.filter(match => {
			// 完了した試合は除外
			if (match.status === 'completed') {
				return false;
			}
			
			if (match.context === 'bracket') {
				const tournamentId = bracketMatchToTournamentMap.get(match.context_id);
				return tournamentId !== undefined && tournamentIds.has(tournamentId);
			}
			if (match.context === 'teamBattle') {
				return battleIds.has(match.context_id);
			}
			return false;
		}).map(match => ({
			...match,
			created_at: match.played_at || new Date().toISOString(), // matchesテーブルにはcreated_atがないのでplayed_atを使用
		}));

		// matchesテーブルの試合と未開始のブラケットマッチを統合
		const allEventMatches = [...eventMatches, ...pendingBracketMatches];

		// created_atでソート（追加順：古い順）
		const sortedMatches = [...allEventMatches].sort((a, b) => {
			const aCreatedAt = a.created_at || '';
			const bCreatedAt = b.created_at || '';
			
			if (!aCreatedAt && !bCreatedAt) return 0;
			if (!aCreatedAt) return 1;
			if (!bCreatedAt) return -1;
			return new Date(aCreatedAt).getTime() - new Date(bCreatedAt).getTime();
		});

		return json<LoaderData>({
			eventId,
			event: {
				id: event.id,
				name: event.name,
				slug: event.slug,
				createdAt: event.createdAt,
			},
			matches: sortedMatches,
			players,
			pairs,
		});
	} catch (error) {
		console.error("[admin.events.$eventId.schedule:load] failed", {
			eventId,
			error: error instanceof Error ? error.message : error,
		});
		throw new Response("指定したイベントが見つかりません。", { status: 404 });
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: `${data?.event.name || "イベント"} - スケジュール - 管理 | Boost Bracket` },
	{ name: "description", content: `${data?.event.name || "イベント"}の試合スケジュール（管理画面）` },
];

function getContextLabel(context: string): string {
	switch (context) {
		case 'bracket':
			return 'ブラケット';
		case 'teamBattle':
			return '団体戦';
		case 'tiebreak':
			return 'タイブレーク';
		default:
			return context;
	}
}

function getStatusLabel(status: string): string {
	switch (status) {
		case 'completed':
			return '完了';
		case 'in_progress':
			return '進行中';
		case 'pending':
		default:
			return '未開始';
	}
}

export default function AdminEventScheduleRoute() {
	const { eventId, event, matches, players, pairs } = useLoaderData<typeof loader>();

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

	const getSideName = (match: EnrichedMatchRecord, side: 'a' | 'b'): string => {
		// BYEの場合
		if (match.isBracketMatch) {
			if (side === 'a' && match.sideAIsBye) {
				return 'BYE';
			}
			if (side === 'b' && match.sideBIsBye) {
				return 'BYE';
			}
		}

		const type = side === 'a' ? match.side_a_type : match.side_b_type;
		const pairId = side === 'a' ? match.side_a_pair_id : match.side_b_pair_id;
		const player1Id = side === 'a' ? match.side_a_player1_id : match.side_b_player1_id;
		const player2Id = side === 'a' ? match.side_a_player2_id : match.side_b_player2_id;

		if (type === 'pair' && pairId) {
			return getPairDisplayName(pairId);
		}

		if (player1Id && player2Id) {
			return `${playerNameMap.get(player1Id) ?? '?'} / ${playerNameMap.get(player2Id) ?? '?'}`;
		}

		if (player1Id) {
			return playerNameMap.get(player1Id) ?? '(不明)';
		}

		return '(未確定)';
	};

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h2 className="text-2xl font-bold text-slate-900">スケジュール</h2>
				<p className="text-sm text-slate-600">
					このイベントの試合を追加順に表示しています。
				</p>
			</header>

			{/* 管理リンク */}
			<div className="flex gap-3">
				<Link
					to={`/admin/events/${eventId}/matches`}
					className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
				>
					試合管理
				</Link>
			</div>

			{matches.length === 0 ? (
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<p className="text-sm text-slate-500">スケジュールされた試合はまだありません。</p>
				</section>
			) : (
				<section className="flex flex-col gap-4">
					{matches.map((match, index) => (
						<div
							key={match.id}
							className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-2">
										<span className="text-xs font-medium text-slate-600 bg-blue-100 px-2 py-1 rounded">
											#{index + 1}
										</span>
										<span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
											{getContextLabel(match.context)}
										</span>
										<span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
											{getStatusLabel(match.status)}
										</span>
										{match.slot_index != null && (
											<span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
												スロット {(match.slot_index ?? 0) + 1}
											</span>
										)}
									</div>
									<div className="flex items-center gap-3 mb-2">
										<div className="font-medium text-slate-900">
											{getSideName(match, 'a')}
										</div>
										<div className="text-slate-400">vs</div>
										<div className="font-medium text-slate-900">
											{getSideName(match, 'b')}
										</div>
									</div>
									{match.status === 'completed' && (
										<div className="text-sm text-slate-600">
											スコア: {match.score_a} - {match.score_b} (
											{match.winner_side === 'a' ? getSideName(match, 'a') : getSideName(match, 'b')} 勝利)
										</div>
									)}
								</div>
							</div>
						</div>
					))}
				</section>
			)}
		</div>
	);
}

