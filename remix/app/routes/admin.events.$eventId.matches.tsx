import { useEffect, useState } from "react";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
} from "@remix-run/react";
import {
	json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { getDatabase } from "~/repositories/database.server";
import type { MatchRecord } from "~/repositories/matches";

type LoaderData = {
	eventId: string;
	matches: EnrichedMatch[];
};

type ActionData = {
	success?: boolean;
	error?: string;
};

type EnrichedMatch = MatchRecord & {
	sideAName: string;
	sideBName: string;
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const db = getDatabase(context);
	const eventId = params.eventId!;

	// 全試合を取得
	const allMatches = await db.matches.listMatches();

	// プレイヤーとペアの情報を取得
	const players = await db.players.listPlayers(eventId);
	const pairs = await db.pairs.listPairs(eventId);

	// マップを作成
	const playerMap = new Map(players.map(p => [p.id, p.name]));
	const pairMap = new Map(pairs.map(p => [
		p.id, 
		`${playerMap.get(p.player1_id) ?? '?'} & ${playerMap.get(p.player2_id) ?? '?'}`
	]));

	// サイド名を取得する関数
	const getSideName = (match: MatchRecord, side: 'a' | 'b'): string => {
		const type = side === 'a' ? match.side_a_type : match.side_b_type;
		const pairId = side === 'a' ? match.side_a_pair_id : match.side_b_pair_id;
		const player1Id = side === 'a' ? match.side_a_player1_id : match.side_b_player1_id;
		const player2Id = side === 'a' ? match.side_a_player2_id : match.side_b_player2_id;
		
		if (type === 'pair' && pairId) {
			return pairMap.get(pairId) ?? '(Unknown Pair)';
		}
		
		if (player1Id && player2Id) {
			return `${playerMap.get(player1Id) ?? '?'} & ${playerMap.get(player2Id) ?? '?'}`;
		}
		
		if (player1Id) {
			return playerMap.get(player1Id) ?? '(Unknown)';
		}
		
		return '(Unknown)';
	};

	// 試合データを拡張
	const enrichedMatches: EnrichedMatch[] = allMatches.map(match => ({
		...match,
		sideAName: getSideName(match, 'a'),
		sideBName: getSideName(match, 'b')
	}));

	return json<LoaderData>({
		eventId,
		matches: enrichedMatches
	});
}

export async function action({ request, context }: ActionFunctionArgs) {
	const formData = await request.formData();
	const intent = formData.get("_intent");

	if (intent !== "delete-match") {
		return json<ActionData>({ error: "Invalid action" }, { status: 400 });
	}

	const matchId = formData.get("matchId")?.toString();

	if (!matchId) {
		return json<ActionData>({ error: "Match ID is required" }, { status: 400 });
	}

	try {
		const db = getDatabase(context);
		await db.matches.deleteMatch(matchId);

		return json<ActionData>({ success: true });
	} catch (error) {
		return json<ActionData>(
			{ 
				error: error instanceof Error ? error.message : "試合の削除に失敗しました" 
			}, 
			{ status: 500 }
		);
	}
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleString('ja-JP', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}

function getResultBadgeClass(winnerSide: 'a' | 'b', side: 'a' | 'b'): string {
	return winnerSide === side ? 'winner' : 'loser';
}

function getResultText(winnerSide: 'a' | 'b', side: 'a' | 'b'): string {
	return winnerSide === side ? '勝利' : '敗北';
}

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

function FlashMessage({ action }: { action: ActionData | undefined }) {
	const [show, setShow] = useState(false);

	useEffect(() => {
		if (action?.success || action?.error) {
			setShow(true);
			const timer = setTimeout(() => setShow(false), action?.success ? 3000 : 5000);
			return () => clearTimeout(timer);
		}
	}, [action]);

	if (!show || !action) return null;

	return (
		<div
			className={`rounded-lg p-4 font-medium ${
				action.success
					? 'bg-green-50 text-green-800 border border-green-200'
					: 'bg-red-50 text-red-800 border border-red-200'
			}`}
		>
			{action.success ? '試合ログを削除しました' : `エラー: ${action.error}`}
		</div>
	);
}

export default function MatchesRoute() {
	const { eventId, matches } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();

	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">試合ログ</h1>
					<p className="mt-2 text-slate-600">
						イベントID: <code className="rounded bg-slate-100 px-2 py-1 text-sm font-mono">{eventId}</code>
					</p>
				</div>
				<Link
					to="/admin"
					className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
				>
					管理トップへ戻る
				</Link>
			</div>

			<FlashMessage action={actionData} />

			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<h2 className="text-xl font-semibold text-slate-900 mb-6">
					試合履歴 ({matches.length}件)
				</h2>
				
				{matches.length === 0 ? (
					<p className="text-slate-500">まだ試合が記録されていません。</p>
				) : (
					<div className="space-y-4">
						{matches.map((match) => (
							<div
								key={match.id}
								className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-all hover:shadow-md hover:border-slate-300"
							>
								<div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
									<div className="text-sm font-medium text-slate-600">
										{formatDate(match.played_at)}
									</div>
									<Form method="post" className="m-0">
										<input type="hidden" name="_intent" value="delete-match" />
										<input type="hidden" name="matchId" value={match.id} />
										<button
											type="submit"
											disabled={isSubmitting}
											className="text-slate-400 hover:text-red-500 transition-colors p-1"
											title="削除"
										>
											🗑️
										</button>
									</Form>
								</div>
								
								<div className="grid grid-cols-3 items-center gap-4 mb-3">
									<div className="flex flex-col gap-2">
										<div className="font-semibold text-slate-900">
											{match.sideAName}
										</div>
										<div className="flex items-center gap-3">
											<span className="text-2xl font-bold text-blue-600 min-w-[40px]">
												{match.score_a}
											</span>
											<span
												className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
													getResultBadgeClass(match.winner_side, 'a') === 'winner'
														? 'bg-green-100 text-green-800'
														: 'bg-red-100 text-red-800'
												}`}
											>
												{getResultText(match.winner_side, 'a')}
											</span>
										</div>
									</div>
									
									<div className="text-center font-bold text-slate-500 text-sm">
										VS
									</div>
									
									<div className="flex flex-col gap-2">
										<div className="font-semibold text-slate-900">
											{match.sideBName}
										</div>
										<div className="flex items-center gap-3">
											<span className="text-2xl font-bold text-blue-600 min-w-[40px]">
												{match.score_b}
											</span>
											<span
												className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
													getResultBadgeClass(match.winner_side, 'b') === 'winner'
														? 'bg-green-100 text-green-800'
														: 'bg-red-100 text-red-800'
												}`}
											>
												{getResultText(match.winner_side, 'b')}
											</span>
										</div>
									</div>
								</div>

								<div className="flex gap-2 items-center text-sm">
									<span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-semibold">
										{getContextLabel(match.context)}
									</span>
									{match.context_id && (
										<span className="text-slate-500 font-mono">
											ID: {match.context_id}
										</span>
									)}
									<span className="px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">
										{match.status}
									</span>
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
