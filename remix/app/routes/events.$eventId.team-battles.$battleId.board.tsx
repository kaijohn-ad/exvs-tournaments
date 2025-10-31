import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import { useEffect, useMemo } from "react";
import { getDatabase } from "~/repositories/database.server";
import type { EventRecord } from "~/repositories/events";
import type { MatchRecord } from "~/repositories/matches";
import type { PairRecord } from "~/repositories/pairs";
import type { PlayerRecord } from "~/repositories/players";
import type { TeamBattleSlotRecord } from "~/repositories/team-battle-slots";
import type { TeamBattleRecord } from "~/repositories/team-battles";
import type { TeamRecord } from "~/repositories/teams";

const statusLabelMap: Record<string, string> = {
	completed: "完了",
	in_progress: "進行中",
	scheduled: "予定",
	pending: "未開始",
	tiebreak_required: "タイブレーク待ち",
};

const statusClassMap: Record<string, string> = {
	completed: "bg-emerald-100 text-emerald-700 border border-emerald-200",
	in_progress: "bg-indigo-100 text-indigo-700 border border-indigo-200",
	scheduled: "bg-sky-100 text-sky-700 border border-sky-200",
	pending: "bg-slate-100 text-slate-600 border border-slate-200",
	tiebreak_required: "bg-amber-100 text-amber-700 border border-amber-200",
};

const resultLabelMap: Record<string, string> = {
	team_a_win: "チームA勝利",
	team_b_win: "チームB勝利",
	draw: "引き分け",
};

const getStatusLabel = (value: string | null | undefined) =>
	statusLabelMap[value ?? "pending"] ?? value ?? "";

const getStatusClass = (value: string | null | undefined) =>
	statusClassMap[value ?? "pending"] ?? statusClassMap.pending;

const getResultLabel = (value: string | null | undefined) =>
	value ? resultLabelMap[value] ?? value : null;

type LoaderData = {
	event: EventRecord;
	battle: TeamBattleRecord;
	teams: TeamRecord[];
	slots: TeamBattleSlotRecord[];
	matches: MatchRecord[];
	players: PlayerRecord[];
	pairs: PairRecord[];
	loadedAt: string;
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	const battleId = params.battleId;

	if (!eventId || !battleId) {
		throw new Response("イベントIDまたは団体戦IDが見つかりません。", { status: 400 });
	}

	const db = getDatabase(context);

	try {
		const [event, battle, teams, slots, matches, players, pairs] = await Promise.all([
			db.events.ensureEvent(eventId),
			db.teamBattles.ensureTeamBattle(eventId, battleId),
			db.teams.listTeams(eventId),
			db.teamBattleSlots.listSlotsByBattle(battleId),
			db.matches.listMatches("teamBattle", battleId),
			db.players.listPlayers(eventId),
			db.pairs.listPairs(eventId),
		]);

		return json<LoaderData>({
			event,
			battle,
			teams,
			slots,
			matches,
			players,
			pairs,
			loadedAt: new Date().toISOString(),
		});
	} catch (error) {
		console.error("[events.$eventId.team-battles.$battleId.board:load] failed", {
			eventId,
			battleId,
			error: error instanceof Error ? error.message : error,
		});
		if (error instanceof Response) {
			throw error;
		}
		throw new Response("指定した団体戦が見つかりません。", { status: 404 });
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) {
		return [{ title: "団体戦 | Boost Bracket" }];
	}

	const teamA = data.teams.find((t) => t.id === data.battle.team_a_id);
	const teamB = data.teams.find((t) => t.id === data.battle.team_b_id);
	const teamAName = teamA?.name ?? "チームA";
	const teamBName = teamB?.name ?? "チームB";

	return [
		{ title: `${teamAName} vs ${teamBName} | Boost Bracket` },
		{ name: "description", content: `${teamAName} vs ${teamBName} の団体戦進行状況を閲覧できます。` },
	];
};

export default function TeamBattleBoardRoute() {
	const { event, battle, teams, slots, matches, players, pairs, loadedAt } =
		useLoaderData<typeof loader>();
	const revalidator = useRevalidator();

	// 自動リフレッシュ（5秒間隔）
	useEffect(() => {
		const interval = setInterval(() => {
			revalidator.revalidate();
		}, 5000);

		return () => clearInterval(interval);
	}, [revalidator]);

	const teamNameById = useMemo(() => {
		const map = new Map<string, string>();
		for (const team of teams) {
			map.set(team.id, team.name);
		}
		return map;
	}, [teams]);

	const playerNameById = useMemo(() => {
		const map = new Map<string, string>();
		for (const player of players) {
			map.set(player.id, player.name);
		}
		return map;
	}, [players]);

	const pairById = useMemo(() => {
		const map = new Map<string, PairRecord>();
		for (const pair of pairs) {
			map.set(pair.id, pair);
		}
		return map;
	}, [pairs]);

	const getTeamName = (teamId: string) => teamNameById.get(teamId) ?? "(Unknown)";
	const getPlayerName = (playerId: string | null | undefined) => {
		if (!playerId) return "(未登録)";
		return playerNameById.get(playerId) ?? "(Unknown)";
	};

	const teamAName = getTeamName(battle.team_a_id);
	const teamBName = getTeamName(battle.team_b_id);

	// スロットごとに集計
	const slotsByIndex = useMemo(() => {
		const map = new Map<number, { teamA?: TeamBattleSlotRecord; teamB?: TeamBattleSlotRecord }>();
		for (const slot of slots) {
			const existing = map.get(slot.slot_index) ?? {};
			if (slot.team_id === battle.team_a_id) {
				existing.teamA = slot;
			} else if (slot.team_id === battle.team_b_id) {
				existing.teamB = slot;
			}
			map.set(slot.slot_index, existing);
		}
		return map;
	}, [slots, battle.team_a_id, battle.team_b_id]);

	// 試合ごとの勝数集計
	const score = useMemo(() => {
		let teamAWins = 0;
		let teamBWins = 0;

		for (const match of matches) {
			if (match.winner_side === "a") {
				teamAWins++;
			} else if (match.winner_side === "b") {
				teamBWins++;
			}
		}

		return { teamAWins, teamBWins };
	}, [matches]);

	const getSlotPlayers = (slot: TeamBattleSlotRecord): string[] => {
		if (slot.assignment_type === "pair" && slot.pair_id) {
			const pair = pairById.get(slot.pair_id);
			if (pair) {
				return [pair.player1_id, pair.player2_id].filter((id): id is string => !!id);
			}
		} else {
			return [slot.player1_id, slot.player2_id].filter((id): id is string => !!id);
		}
		return [];
	};

	const formatSlotPlayers = (slot: TeamBattleSlotRecord): string => {
		const playerIds = getSlotPlayers(slot);
		if (playerIds.length === 0) {
			return "未割当";
		}
		const names = playerIds.map((id) => getPlayerName(id));
		return names.join(" / ");
	};

	const sortedSlotIndices = useMemo(() => {
		return Array.from(slotsByIndex.keys()).sort((a, b) => a - b);
	}, [slotsByIndex]);

	const matchesBySlotIndex = useMemo(() => {
		const map = new Map<number, MatchRecord>();
		for (const match of matches) {
			if (match.slot_index !== null && match.slot_index !== undefined) {
				map.set(match.slot_index, match);
			}
		}
		return map;
	}, [matches]);

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
			<section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
				<header className="flex flex-col gap-4 border-b border-slate-200 pb-6">
					<div className="flex items-center justify-between flex-wrap gap-4">
						<div>
							<h1 className="text-3xl font-bold text-slate-900">
								{teamAName} vs {teamBName}
							</h1>
							<p className="mt-2 text-sm text-slate-500">
								イベント: {event.name} | 団体戦ID: {battle.id}
							</p>
						</div>
						<div className="flex items-center gap-3">
							<span className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusClass(battle.status)}`}>
								{getStatusLabel(battle.status)}
							</span>
							{getResultLabel(battle.result) && (
								<span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
									{getResultLabel(battle.result)}
								</span>
							)}
						</div>
					</div>
					<div className="text-xs text-slate-400">
						最終更新: {new Date(loadedAt).toLocaleString("ja-JP")} (5秒ごとに自動更新)
					</div>
				</header>

				{/* スコアボード */}
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-xl font-semibold text-slate-900 mb-4">スコア</h2>
					<div className="grid grid-cols-2 gap-4">
						<div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100 p-4">
							<div className="text-sm font-medium text-indigo-700 mb-1">{teamAName}</div>
							<div className="text-3xl font-bold text-indigo-900">{score.teamAWins}</div>
						</div>
						<div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-violet-100 p-4">
							<div className="text-sm font-medium text-violet-700 mb-1">{teamBName}</div>
							<div className="text-3xl font-bold text-violet-900">{score.teamBWins}</div>
						</div>
					</div>
				</section>

				{/* ラインナップ */}
				<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-xl font-semibold text-slate-900 mb-4">ラインナップ</h2>
					<div className="grid gap-4">
						{sortedSlotIndices.map((slotIndex) => {
							const slotData = slotsByIndex.get(slotIndex);
							const teamASlot = slotData?.teamA;
							const teamBSlot = slotData?.teamB;
							const match = matchesBySlotIndex.get(slotIndex);

							return (
								<div
									key={slotIndex}
									className="rounded-xl border border-slate-200 bg-slate-50 p-4"
								>
									<div className="text-sm font-semibold text-slate-500 mb-3">
										スロット {slotIndex + 1}
									</div>
									<div className="grid md:grid-cols-2 gap-4">
										<div className="rounded-lg border border-indigo-200 bg-white p-3">
											<div className="text-xs font-medium text-indigo-700 mb-1">{teamAName}</div>
											<div className="text-sm font-semibold text-slate-900">
												{teamASlot ? formatSlotPlayers(teamASlot) : "未割当"}
											</div>
										</div>
										<div className="rounded-lg border border-violet-200 bg-white p-3">
											<div className="text-xs font-medium text-violet-700 mb-1">{teamBName}</div>
											<div className="text-sm font-semibold text-slate-900">
												{teamBSlot ? formatSlotPlayers(teamBSlot) : "未割当"}
											</div>
										</div>
									</div>
									{match && (
										<div className="mt-3 pt-3 border-t border-slate-200">
											<div className="flex items-center justify-center gap-4 text-lg font-semibold">
												<span
													className={`px-3 py-1 rounded ${
														match.winner_side === "a"
															? "bg-indigo-100 text-indigo-700"
															: "text-slate-500"
													}`}
												>
													{match.score_a}
												</span>
												<span className="text-slate-400">-</span>
												<span
													className={`px-3 py-1 rounded ${
														match.winner_side === "b"
															? "bg-violet-100 text-violet-700"
															: "text-slate-500"
													}`}
												>
													{match.score_b}
												</span>
											</div>
											<div className="text-center text-xs text-slate-500 mt-1">
												勝者: {match.winner_side === "a" ? teamAName : teamBName}
											</div>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</section>

				{/* 試合一覧 */}
				{matches.length > 0 && (
					<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<h2 className="text-xl font-semibold text-slate-900 mb-4">試合一覧</h2>
						<div className="grid gap-3">
							{matches
								.slice()
								.sort((a, b) => {
									const slotA = a.slot_index ?? Number.MAX_SAFE_INTEGER;
									const slotB = b.slot_index ?? Number.MAX_SAFE_INTEGER;
									if (slotA !== slotB) return slotA - slotB;
									return a.played_at.localeCompare(b.played_at);
								})
								.map((match) => (
									<div
										key={match.id}
										className="rounded-lg border border-slate-200 bg-slate-50 p-4"
									>
										<div className="flex items-center justify-between">
											<div className="flex-1">
												<div className="text-sm font-semibold text-slate-900 mb-2">
													スロット {match.slot_index !== null && match.slot_index !== undefined ? match.slot_index + 1 : "-"}
												</div>
												<div className="flex items-center gap-4 text-base">
													<span
														className={`font-semibold ${
															match.winner_side === "a"
																? "text-indigo-700"
																: "text-slate-500"
														}`}
													>
														{teamAName}: {match.score_a}
													</span>
													<span className="text-slate-400">-</span>
													<span
														className={`font-semibold ${
															match.winner_side === "b"
																? "text-violet-700"
																: "text-slate-500"
														}`}
													>
														{match.score_b} :{teamBName}
													</span>
												</div>
											</div>
											<div className="text-xs text-slate-500">
												{new Date(match.played_at).toLocaleString("ja-JP")}
											</div>
										</div>
									</div>
								))}
						</div>
					</section>
				)}
			</section>
		</div>
	);
}

export function ErrorBoundary() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900 flex items-center justify-center">
			<div className="text-center">
				<h1 className="text-2xl font-bold text-slate-900 mb-2">エラーが発生しました</h1>
				<p className="text-slate-600">指定した団体戦が見つかりません。</p>
			</div>
		</div>
	);
}

