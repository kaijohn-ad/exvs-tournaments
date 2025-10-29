import { useEffect, useMemo, useState } from "react";
import { Link, useLoaderData, useRevalidator } from "@remix-run/react";
import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { getDatabase } from "~/repositories/database.server";
import type { TournamentRecord } from "~/repositories/tournaments";
import type { EventRecord } from "~/repositories/events";
import type { PairRecord } from "~/repositories/pairs";
import type { PlayerRecord } from "~/repositories/players";
import type { BracketMatchRecord } from "~/repositories/bracket-matches";

type LoaderData = {
	eventId: string;
	tournamentId: string;
	event: EventRecord;
	tournament: TournamentRecord;
	pairs: PairRecord[];
	players: PlayerRecord[];
	bracketMatches: BracketMatchRecord[];
	loadedAt: string;
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
		tournament = await db.tournaments.ensureTournament(eventId, tournamentId);
	} catch (error) {
		console.error("[public-tournament-bracket:load] tournament not found", {
			eventId,
			tournamentId,
			error: error instanceof Error ? error.message : error,
		});
		throw new Response("指定したトーナメントが見つかりません。", { status: 404 });
	}

	let event: EventRecord;
	try {
		event = await db.events.ensureEvent(eventId);
	} catch (error) {
		console.error("[public-tournament-bracket:load] event not found", {
			eventId,
			error: error instanceof Error ? error.message : error,
		});
		throw new Response("指定したイベントが見つかりません。", { status: 404 });
	}

	const [pairs, players, bracketMatches] = await Promise.all([
		db.pairs.listPairs(eventId),
		db.players.listPlayers(eventId),
		db.bracketMatches.listBracketMatches(tournamentId),
	]);

	return json<LoaderData>({
		eventId,
		tournamentId,
		event,
		tournament,
		pairs,
		players,
		bracketMatches,
		loadedAt: new Date().toISOString(),
	});
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

export default function PublicBracketRoute() {
	const { eventId, tournamentId, event, tournament, pairs, players, bracketMatches, loadedAt } =
		useLoaderData<typeof loader>();
	const revalidator = useRevalidator();

	// 自動リフレッシュ（5秒間隔）
	useEffect(() => {
		const interval = setInterval(() => {
			revalidator.revalidate();
		}, 5000);

		return () => clearInterval(interval);
	}, [revalidator]);

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

	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">
						{event.name} - {tournament.name}
					</h1>
					<p className="mt-2 text-sm text-slate-600">
						最終更新: {new Date(loadedAt).toLocaleString("ja-JP")}
					</p>
				</div>
				<Link
					to={`/events/${eventId}`}
					className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
				>
					← イベント一覧に戻る
				</Link>
			</header>

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
						ブラケットがまだ生成されていません。
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
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
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
													className={`rounded-lg border p-4 transition-all ${
														match.statusModifier === "completed"
															? "border-green-200 bg-green-50"
															: match.statusModifier === "in-progress"
															? "border-blue-200 bg-blue-50"
															: "border-slate-200 bg-white"
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
