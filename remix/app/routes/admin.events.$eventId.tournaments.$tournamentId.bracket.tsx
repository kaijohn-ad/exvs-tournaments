import { useEffect, useMemo, useState } from "react";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
	useRevalidator,
} from "@remix-run/react";
import {
	json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { getDatabase } from "~/repositories/database.server";
import type { TournamentRecord } from "~/repositories/tournaments";
import type { PairRecord } from "~/repositories/pairs";
import type { PlayerRecord } from "~/repositories/players";
import type { BracketMatchRecord } from "~/repositories/bracket-matches";

type LoaderData = {
	eventId: string;
	tournamentId: string;
	tournament: TournamentRecord;
	pairs: PairRecord[];
	players: PlayerRecord[];
	bracketMatches: BracketMatchRecord[];
};

type ActionData =
	| {
			type: "success";
			message: string;
			matchId: string;
			winnerSide: "a" | "b";
			scoreA: number;
			scoreB: number;
	  }
	| {
			type: "error";
			message: string;
			matchId?: string;
	  };

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	const tournamentId = params.tournamentId;

	if (!eventId || !tournamentId) {
		throw new Response("Event ID and Tournament ID are required", { status: 400 });
	}

	const db = getDatabase(context);

	let tournament: TournamentRecord;
	try {
		const existing = await db.tournaments.ensureTournament(tournamentId);
		if (existing.eventId !== eventId) {
			throw new Response('Tournament not found', { status: 404 });
		}
		tournament = existing;
	} catch (error) {
		console.error("[tournament-bracket:load] tournament not found", {
			eventId,
			tournamentId,
			error: error instanceof Error ? error.message : error,
		});
		throw new Response("指定したトーナメントが見つかりません。", { status: 404 });
	}

	const [pairs, players, bracketMatches] = await Promise.all([
		db.pairs.listPairs(eventId),
		db.players.listPlayers(eventId),
		db.bracketMatches.listBracketMatches(tournamentId),
	]);

	return json<LoaderData>({
		eventId,
		tournamentId,
		tournament,
		pairs,
		players,
		bracketMatches,
	});
}

const parseScore = (value: FormDataEntryValue | null, label: string): number => {
	if (value == null) {
		throw new Error(`${label}を入力してください`);
	}

	const parsed = Number(value.toString().trim());

	if (!Number.isFinite(parsed)) {
		throw new Error(`${label}は数値で入力してください`);
	}

	if (parsed < 0) {
		throw new Error(`${label}は0以上で入力してください`);
	}

	return Math.trunc(parsed);
};

const collectPairPlayers = (pair: { player1_id: string; player2_id: string }) => {
	return [pair.player1_id, pair.player2_id].filter((id): id is string => Boolean(id));
};

export async function action({ request, params, context }: ActionFunctionArgs) {
	const eventId = params.eventId;
	const tournamentId = params.tournamentId;

	if (!eventId || !tournamentId) {
		throw new Response("Event ID and Tournament ID are required", { status: 400 });
	}

	const formData = await request.formData();
	const intent = formData.get("_intent")?.toString();

	if (intent === "record") {
		const matchId = formData.get("matchId")?.toString();
		const winnerSide = formData.get("winnerSide")?.toString();

		if (!matchId) {
			return json<ActionData>(
				{ type: "error", message: "試合IDが取得できませんでした。" },
				{ status: 400 }
			);
		}

		if (winnerSide !== "a" && winnerSide !== "b") {
			return json<ActionData>(
				{ type: "error", message: "勝者のサイドを選択してください。", matchId },
				{ status: 400 }
			);
		}

		let scoreA: number;
		let scoreB: number;

		try {
			scoreA = parseScore(formData.get("scoreA"), "サイドAのスコア");
			scoreB = parseScore(formData.get("scoreB"), "サイドBのスコア");
		} catch (error) {
			return json<ActionData>(
				{
					type: "error",
					message: error instanceof Error ? error.message : "スコアの解析に失敗しました。",
					matchId,
				},
				{ status: 400 }
			);
		}

		if (winnerSide === "a" && scoreA <= scoreB) {
			return json<ActionData>(
				{
					type: "error",
					message: "サイドAを勝者とする場合、サイドAのスコアがサイドBより高い必要があります。",
					matchId,
				},
				{ status: 400 }
			);
		}

		if (winnerSide === "b" && scoreB <= scoreA) {
			return json<ActionData>(
				{
					type: "error",
					message: "サイドBを勝者とする場合、サイドBのスコアがサイドAより高い必要があります。",
					matchId,
				},
				{ status: 400 }
			);
		}

		const db = getDatabase(context);

		let match: BracketMatchRecord;
		try {
			match = await db.bracketMatches.ensureBracketMatch(tournamentId, matchId);
		} catch (error) {
			console.error("[tournament-bracket:record] match not found", {
				eventId,
				tournamentId,
				matchId,
				error: error instanceof Error ? error.message : error,
			});
			return json<ActionData>(
				{ type: "error", message: "指定した試合が見つかりません。", matchId },
				{ status: 404 }
			);
		}

		if (
			match.participant_a_type !== "pair" ||
			match.participant_b_type !== "pair" ||
			!match.participant_a_pair_id ||
			!match.participant_b_pair_id
		) {
			return json<ActionData>(
				{
					type: "error",
					message: "両サイドのペアが確定してから結果を入力してください。",
					matchId,
				},
				{ status: 400 }
			);
		}

		const existingLogs = await db.matches.listMatches("bracket", matchId);
		if (existingLogs.length > 0) {
			return json<ActionData>(
				{
					type: "error",
					message: "この試合は既に記録されています。ログを削除してから再入力してください。",
					matchId,
				},
				{ status: 409 }
			);
		}

		const winnerPairId =
			winnerSide === "a" ? match.participant_a_pair_id : match.participant_b_pair_id;
		const loserPairId =
			winnerSide === "a" ? match.participant_b_pair_id : match.participant_a_pair_id;

		let pairA: PairRecord;
		let pairB: PairRecord;

		try {
		pairA = await db.pairs.ensurePair(match.participant_a_pair_id);
		pairB = await db.pairs.ensurePair(match.participant_b_pair_id);
		} catch (error) {
			console.error("[tournament-bracket:record] pair lookup failed", {
				eventId,
				tournamentId,
				matchId,
				error: error instanceof Error ? error.message : error,
			});
			return json<ActionData>(
				{ type: "error", message: "参加ペアの情報取得に失敗しました。", matchId },
				{ status: 400 }
			);
		}

		await db.bracketMatches.updateBracketMatch(tournamentId, matchId, {
			score_a: scoreA,
			score_b: scoreB,
			status: "completed",
			winner_side: winnerSide,
		});

		const allMatches = await db.bracketMatches.listBracketMatches(tournamentId);
		const nextRound = match.round + 1;
		const nextPosition = Math.ceil(match.position / 2);
		const nextMatch = allMatches.find(
			(candidate) => candidate.round === nextRound && candidate.position === nextPosition
		);

		if (nextMatch) {
			const targetSide = match.position % 2 === 1 ? "a" : "b";
			const currentTargetPairId =
				targetSide === "a" ? nextMatch.participant_a_pair_id : nextMatch.participant_b_pair_id;
			const needsParticipantUpdate = currentTargetPairId !== winnerPairId;
			const needsReset =
				nextMatch.status !== "pending" ||
				nextMatch.winner_side !== null ||
				nextMatch.score_a !== null ||
				nextMatch.score_b !== null;

			if (needsParticipantUpdate || needsReset) {
				const updatePayload: any = {};

				if (targetSide === "a" && needsParticipantUpdate) {
					updatePayload.participant_a_type = "pair";
					updatePayload.participant_a_pair_id = winnerPairId;
				} else if (targetSide === "b" && needsParticipantUpdate) {
					updatePayload.participant_b_type = "pair";
					updatePayload.participant_b_pair_id = winnerPairId;
				}

				if (needsReset) {
					updatePayload.status = "pending";
					updatePayload.winner_side = null;
					updatePayload.score_a = null;
					updatePayload.score_b = null;
				}

				await db.bracketMatches.updateBracketMatch(tournamentId, nextMatch.id, updatePayload);
			}
		}

		await db.matches.createMatch({
			context: "bracket",
			context_id: matchId,
			side_a_type: "pair",
			side_a_pair_id: pairA.id,
			side_a_player1_id: pairA.player1_id,
			side_a_player2_id: pairA.player2_id,
			side_b_type: "pair",
			side_b_pair_id: pairB.id,
			side_b_player1_id: pairB.player1_id,
			side_b_player2_id: pairB.player2_id,
			score_a: scoreA,
			score_b: scoreB,
			winner_side: winnerSide,
		});

		const winnerPlayers = collectPairPlayers(winnerSide === "a" ? pairA : pairB);
		const loserPlayers = collectPairPlayers(winnerSide === "a" ? pairB : pairA);

		for (const playerId of winnerPlayers) {
			await db.playerStats.incrementPlayerStats(playerId, "tournament", tournamentId, true);
		}

		for (const playerId of loserPlayers) {
			await db.playerStats.incrementPlayerStats(playerId, "tournament", tournamentId, false);
		}

		return json<ActionData>({
			type: "success",
			message: "試合結果を記録しました。",
			matchId,
			winnerSide,
			scoreA,
			scoreB,
		});
	}

	return json<ActionData | null>(null);
}

// ブラケット表示用の型定義
type ParticipantType = "pair" | "bye" | "empty" | "unknown";

interface ParticipantDisplay {
	type: ParticipantType;
	label: string;
	playerNames: string[];
	seed: number | null;
	pairId: string | null;
}

interface MatchDisplay {
	id: string;
	round: number;
	position: number;
	status: string;
	winnerSide: "a" | "b" | null;
	scoreA: number | null;
	scoreB: number | null;
	scoreALabel: string;
	scoreBLabel: string;
	participantA: ParticipantDisplay;
	participantB: ParticipantDisplay;
	isCompleted: boolean;
	isInProgress: boolean;
	isPending: boolean;
	isAutoAdvance: boolean;
	statusLabel: string;
	statusClass: string;
	statusModifier: "completed" | "in-progress" | "pending";
}

interface RoundDisplay {
	round: number;
	name: string;
	matches: MatchDisplay[];
	gapFactor: number;
}

export default function AdminBracketRoute() {
	const { eventId, tournamentId, tournament, pairs, players, bracketMatches } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const revalidator = useRevalidator();

	const [recentMatchId, setRecentMatchId] = useState<string | null>(null);

	// 自動リフレッシュ（5秒間隔）
	useEffect(() => {
		const interval = setInterval(() => {
			revalidator.revalidate();
		}, 5000);

		return () => clearInterval(interval);
	}, [revalidator]);

	// 最近更新された試合のハイライト
	useEffect(() => {
		if (actionData?.type === "success" && actionData.matchId) {
			setRecentMatchId(actionData.matchId);
			setTimeout(() => setRecentMatchId(null), 3000);
		}
	}, [actionData]);

	const playerNameById = useMemo(() => {
		const map: Record<string, string> = {};
		for (const player of players) {
			map[player.id] = player.name;
		}
		return map;
	}, [players]);

	const pairById = useMemo(() => {
		const map: Record<string, PairRecord> = {};
		for (const pair of pairs) {
			map[pair.id] = pair;
		}
		return map;
	}, [pairs]);

	const getPlayerName = (playerId: string | null | undefined): string => {
		if (!playerId) {
			return "(未登録)";
		}
		return playerNameById[playerId] ?? "(Unknown)";
	};

	const buildParticipant = (
		match: BracketMatchRecord,
		side: "a" | "b"
	): ParticipantDisplay => {
		const pairId = side === "a" ? match.participant_a_pair_id : match.participant_b_pair_id;
		const participantType = side === "a" ? match.participant_a_type : match.participant_b_type;

		if (participantType === "bye") {
			return {
				type: "bye",
				label: "BYE",
				playerNames: [],
				seed: null,
				pairId: null,
			};
		}

		if (!pairId) {
			return {
				type: "empty",
				label: "未確定",
				playerNames: [],
				seed: null,
				pairId: null,
			};
		}

		const pair = pairById[pairId];
		if (!pair) {
			return {
				type: "unknown",
				label: "ペア未登録",
				playerNames: [],
				seed: null,
				pairId,
			};
		}

		const playerNames = [getPlayerName(pair.player1_id), getPlayerName(pair.player2_id)];

		return {
			type: "pair",
			label: `${playerNames[0]} / ${playerNames[1]}`,
			playerNames,
			seed: pair.seed ?? null,
			pairId,
		};
	};

	const getScoreLabel = (value: number | null | undefined): string => {
		return typeof value === "number" && Number.isFinite(value) ? String(value) : "—";
	};

	const getStatusLabel = (status: string, autoAdvance: boolean): string => {
		if (autoAdvance) {
			return "自動勝ち上がり";
		}
		switch (status) {
			case "completed":
				return "完了";
			case "in_progress":
				return "進行中";
			case "pending":
			default:
				return "未開始";
		}
	};

	const getStatusClass = (status: string, autoAdvance: boolean): string => {
		if (autoAdvance) {
			return "status-auto";
		}
		switch (status) {
			case "completed":
				return "status-completed";
			case "in_progress":
				return "status-in-progress";
			default:
				return "status-pending";
		}
	};

	const toMatchDisplay = (match: BracketMatchRecord): MatchDisplay => {
		const participantA = buildParticipant(match, "a");
		const participantB = buildParticipant(match, "b");
		const isInProgress = match.status === "in_progress";
		const isCompleted = match.status === "completed" || Boolean(match.winner_side);
		const isAutoAdvance =
			isCompleted &&
			match.score_a == null &&
			match.score_b == null &&
			Boolean(match.winner_side) &&
			(participantA.type === "bye" || participantB.type === "bye");

		return {
			id: match.id,
			round: match.round,
			position: match.position,
			status: match.status ?? "pending",
			winnerSide: match.winner_side ?? null,
			scoreA: match.score_a ?? null,
			scoreB: match.score_b ?? null,
			scoreALabel: getScoreLabel(match.score_a),
			scoreBLabel: getScoreLabel(match.score_b),
			participantA,
			participantB,
			isCompleted,
			isInProgress,
			isPending: !isCompleted && !isInProgress,
			isAutoAdvance,
			statusLabel: getStatusLabel(match.status ?? "pending", isAutoAdvance),
			statusClass: getStatusClass(match.status ?? "pending", isAutoAdvance),
			statusModifier: isCompleted ? "completed" : isInProgress ? "in-progress" : "pending",
		};
	};

	const getParticipantClasses = (match: MatchDisplay, side: "a" | "b"): string => {
		const participant = side === "a" ? match.participantA : match.participantB;
		const classes: string[] = ["participant"];

		switch (participant.type) {
			case "bye":
				classes.push("bye");
				break;
			case "empty":
				classes.push("empty");
				break;
			case "unknown":
				classes.push("unknown");
				break;
		}

		if (match.isCompleted && match.winnerSide === side) {
			classes.push("winner");
		} else if (match.isCompleted && match.winnerSide && match.winnerSide !== side) {
			classes.push("loser");
		} else if (match.isInProgress) {
			classes.push("in-progress");
		}

		return classes.join(" ");
	};

	const matchDisplays = useMemo(() => {
		return bracketMatches.map(toMatchDisplay);
	}, [bracketMatches, playerNameById, pairById]);

	const roundNumbers = useMemo(() => {
		const rounds = new Set(matchDisplays.map((m) => m.round));
		return Array.from(rounds).sort((a, b) => a - b);
	}, [matchDisplays]);

	const rounds = useMemo((): RoundDisplay[] => {
		return roundNumbers.map((roundNumber) => {
			const roundMatches = matchDisplays.filter((m) => m.round === roundNumber);
			const totalRounds = roundNumbers.length;
			const gapFactor = Math.pow(2, totalRounds - roundNumber - 1);

			let roundName: string;
			if (roundNumber === 1) {
				roundName = "1回戦";
			} else if (roundNumber === totalRounds) {
				roundName = "決勝";
			} else if (roundNumber === totalRounds - 1) {
				roundName = "準決勝";
			} else if (roundNumber === totalRounds - 2) {
				roundName = "準々決勝";
			} else {
				roundName = `${roundNumber}回戦`;
			}

			return {
				round: roundNumber,
				name: roundName,
				matches: roundMatches,
				gapFactor,
			};
		});
	}, [matchDisplays, roundNumbers]);

	// 進行状況の計算
	const totalMatches = matchDisplays.length;
	const completedMatches = matchDisplays.filter((m) => m.isCompleted).length;
	const inProgressMatches = matchDisplays.filter((m) => m.isInProgress).length;
	const pendingMatches = matchDisplays.filter((m) => m.isPending).length;
	const progressPercent = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

	const activeRound = rounds.find((r) => r.matches.some((m) => m.isInProgress || m.isPending));
	const activeRoundName = activeRound?.name ?? "完了";

	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">
						{tournament.name} ブラケット
					</h1>
					<p className="mt-2 text-sm text-slate-600">
						イベントID: <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{eventId}</code>
					</p>
				</div>
				<Link
					to={`/admin/events/${eventId}/tournaments`}
					className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
				>
					← トーナメント設定に戻る
				</Link>
			</header>

			{actionData && (
				<div
					className={`rounded-lg border px-4 py-3 text-sm ${
						actionData.type === "success"
							? "border-emerald-300 bg-emerald-50 text-emerald-700"
							: "border-rose-300 bg-rose-50 text-rose-700"
					}`}
				>
					{actionData.message}
				</div>
			)}

			{/* 進行状況カード */}
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<header className="mb-6 flex items-center justify-between">
					<h2 className="text-xl font-semibold text-slate-900">進行状況</h2>
					<span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
						現在: {activeRoundName}
					</span>
				</header>

				{totalMatches === 0 ? (
					<p className="text-slate-500">
						ブラケットがまだ生成されていません。トーナメント設定からブラケットを作成してください。
					</p>
				) : (
					<>
						<div className="mb-6">
							<div className="h-2 w-full rounded-full bg-slate-200">
								<div
									className="h-2 rounded-full bg-blue-600 transition-all duration-300"
									style={{ width: `${progressPercent}%` }}
								></div>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							<div className="text-center">
								<div className="text-2xl font-bold text-slate-900">{totalMatches}</div>
								<div className="text-sm text-slate-600">合計</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-green-600">{completedMatches}</div>
								<div className="text-sm text-slate-600">完了</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-blue-600">{inProgressMatches}</div>
								<div className="text-sm text-slate-600">進行中</div>
							</div>
							<div className="text-center">
								<div className="text-2xl font-bold text-slate-400">{pendingMatches}</div>
								<div className="text-sm text-slate-600">未開始</div>
							</div>
						</div>

						<p className="mt-4 text-center text-sm text-slate-600">
							全{totalMatches}試合中{completedMatches}試合が完了しています。
						</p>
					</>
				)}
			</section>

			{/* ブラケット表示 */}
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg" data-testid="bracket">
				<header className="mb-6">
					<h2 className="text-xl font-semibold text-slate-900">トーナメント表</h2>
					<p className="mt-1 text-sm text-slate-600">横スクロールで全ラウンドを表示できます。</p>
				</header>

				{rounds.length === 0 ? (
					<p className="text-slate-500">表示できるブラケットがありません。</p>
				) : (
					<div className="overflow-x-auto">
						<div className="flex min-w-max gap-8">
							{rounds.map((round) => (
								<section
									key={round.round}
									data-testid={`round-${round.round}`}
									className="flex min-w-[280px] flex-col"
									style={{ gap: `${round.gapFactor * 8}px` }}
								>
									<header className="mb-4 text-center">
										<h3 className="text-lg font-semibold text-slate-900">{round.name}</h3>
										<span className="text-sm text-slate-500">R{round.round}</span>
									</header>

									{round.matches.length === 0 ? (
										<p className="text-center text-sm text-slate-500">マッチが設定されていません。</p>
									) : (
										<div className="space-y-4">
											{round.matches.map((match) => (
												<article
													key={match.id}
													data-testid={`match-${match.id}`}
													className={`rounded-lg border p-4 transition-all ${
														match.statusModifier === "completed"
															? "border-green-200 bg-green-50"
															: match.statusModifier === "in-progress"
															? "border-blue-200 bg-blue-50"
															: "border-slate-200 bg-white"
													} ${
														recentMatchId === match.id ? "ring-2 ring-blue-500" : ""
													}`}
												>
													<header className="mb-3 flex items-center justify-between">
														<span className="text-xs font-medium text-slate-500">
															#{match.position}
														</span>
														<span
															className={`rounded-full px-2 py-1 text-xs font-medium ${
																match.statusClass === "status-completed"
																	? "bg-green-100 text-green-800"
																	: match.statusClass === "status-in-progress"
																	? "bg-blue-100 text-blue-800"
																	: match.statusClass === "status-auto"
																	? "bg-purple-100 text-purple-800"
																	: "bg-slate-100 text-slate-800"
															}`}
														>
															{match.statusLabel}
														</span>
													</header>

													<div className="space-y-2">
														{/* サイドA */}
														<div
															data-testid="participant-a"
															className={`flex items-center justify-between rounded p-2 ${
																match.isCompleted && match.winnerSide === "a"
																	? "bg-green-100"
																	: match.isCompleted && match.winnerSide && match.winnerSide !== "a"
																	? "bg-red-50"
																	: match.isInProgress
																	? "bg-blue-50"
																	: "bg-slate-50"
															}`}
														>
															<div className="flex-1">
																{match.participantA.type === "pair" ? (
																	<>
																		<div className="font-medium text-slate-900">
																			{match.participantA.playerNames[0]} / {match.participantA.playerNames[1]}
																		</div>
																		{match.participantA.seed != null && (
																			<span className="text-xs text-slate-500">
																				シード {match.participantA.seed}
																			</span>
																		)}
																	</>
																) : (
																	<span className="text-slate-500">{match.participantA.label}</span>
																)}
															</div>
															<span className="ml-2 font-mono text-lg font-bold">
																{match.scoreALabel}
															</span>
														</div>

														{/* サイドB */}
														<div
															data-testid="participant-b"
															className={`flex items-center justify-between rounded p-2 ${
																match.isCompleted && match.winnerSide === "b"
																	? "bg-green-100"
																	: match.isCompleted && match.winnerSide && match.winnerSide !== "b"
																	? "bg-red-50"
																	: match.isInProgress
																	? "bg-blue-50"
																	: "bg-slate-50"
															}`}
														>
															<div className="flex-1">
																{match.participantB.type === "pair" ? (
																	<>
																		<div className="font-medium text-slate-900">
																			{match.participantB.playerNames[0]} / {match.participantB.playerNames[1]}
																		</div>
																		{match.participantB.seed != null && (
																			<span className="text-xs text-slate-500">
																				シード {match.participantB.seed}
																			</span>
																		)}
																	</>
																) : (
																	<span className="text-slate-500">{match.participantB.label}</span>
																)}
															</div>
															<span className="ml-2 font-mono text-lg font-bold">
																{match.scoreBLabel}
															</span>
														</div>
													</div>

													{/* 試合結果入力フォーム（管理画面のみ） */}
													{match.isPending && match.participantA.type === "pair" && match.participantB.type === "pair" && (
														<Form method="post" className="mt-4 space-y-3">
															<input type="hidden" name="_intent" value="record" />
															<input type="hidden" name="matchId" value={match.id} />

															<div className="grid grid-cols-2 gap-3">
																<div>
																	<label className="block text-xs font-medium text-slate-700">
																		サイドAスコア
																	</label>
																	<input
																		type="number"
																		name="scoreA"
																		min="0"
																		required
																		className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
																	/>
																</div>
																<div>
																	<label className="block text-xs font-medium text-slate-700">
																		サイドBスコア
																	</label>
																	<input
																		type="number"
																		name="scoreB"
																		min="0"
																		required
																		className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
																	/>
																</div>
															</div>

															<div>
																<label className="block text-xs font-medium text-slate-700">
																	勝者を選択
																</label>
																<select
																	name="winnerSide"
																	required
																	className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
																>
																	<option value="">選択してください</option>
																	<option value="a">サイドA</option>
																	<option value="b">サイドB</option>
																</select>
															</div>

															<button
																type="submit"
																disabled={isSubmitting}
																className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
															>
																{isSubmitting ? "記録中..." : "結果を記録"}
															</button>
														</Form>
													)}
												</article>
											))}
										</div>
									)}
								</section>
							))}
						</div>
					</div>
				)}
			</section>
		</div>
	);
}
