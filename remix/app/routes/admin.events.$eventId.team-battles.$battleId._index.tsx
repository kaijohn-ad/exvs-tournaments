import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
} from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { getDatabase, type DatabaseContext } from "~/repositories/database.server";
import type { MatchRecord } from "~/repositories/matches";
import type { PairRecord } from "~/repositories/pairs";
import type { PlayerRecord } from "~/repositories/players";
import type { TeamBattleSlotRecord } from "~/repositories/team-battle-slots";
import type { TeamBattleRecord } from "~/repositories/team-battles";
import type { TeamRecord } from "~/repositories/teams";
import { computeKothState, type KothState } from "~/utils/team-battles/koth";

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) return undefined;
	const text = String(value).trim();
	return text.length > 0 ? text : undefined;
};

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
	value ? resultLabelMap[value] ?? value : "-";

const parseInteger = (value: string | undefined): number | null => {
	if (value == null) return null;
	const parsed = Number(value);
	if (!Number.isInteger(parsed)) return null;
	return parsed;
};

type LoaderData = {
	eventId: string;
	battleId: string;
	battle: TeamBattleRecord;
	slots: TeamBattleSlotRecord[];
	teams: TeamRecord[];
	players: PlayerRecord[];
	pairs: PairRecord[];
	matches: MatchRecord[];
};

type MutationSource =
	| "recordSlotResult"
	| "assignSlot"
	| "deleteSlotResult"
	| "finalizeBattle"
	| "recordTiebreaker"
	| "recordKothMatch"
	| "deleteKothMatch"
	| "recordKothFriendlyMatch";

type ActionSuccess = {
	type: "success";
	source: MutationSource;
	message: string;
};

type ActionError = {
	type: "error";
	source: MutationSource;
	message: string;
};

type ActionData = ActionSuccess | ActionError;

type SlotResult = {
	slot_index: number;
	winner_team_id: string;
	score_a: number;
	score_b: number;
};

const fetchBattleContext = async (db: DatabaseContext, eventId: string, battleId: string) => {
	const [battle, slots, teams, players, pairs, matches] = await Promise.all([
		db.teamBattles.ensureTeamBattle(eventId, battleId),
		db.teamBattleSlots.listSlotsByBattle(battleId),
		db.teams.listTeams(eventId),
		db.players.listPlayers(eventId),
		db.pairs.listPairs(eventId),
		db.matches.listMatches("teamBattle", battleId),
	]);

	return { battle, slots, teams, players, pairs, matches } satisfies Omit<LoaderData, "eventId" | "battleId">;
};

const calculateBattleResult = (
	slotResults: SlotResult[],
	teamAId: string,
	teamBId: string,
) => {
	let teamAWins = 0;
	let teamBWins = 0;

	for (const slotResult of slotResults) {
		if (slotResult.winner_team_id === teamAId) {
			teamAWins++;
		} else if (slotResult.winner_team_id === teamBId) {
			teamBWins++;
		}
	}

	let result: "team_a_win" | "team_b_win" | "draw";
	if (teamAWins > teamBWins) {
		result = "team_a_win";
	} else if (teamBWins > teamAWins) {
		result = "team_b_win";
	} else {
		result = "draw";
	}

	return { result, teamAWins, teamBWins };
};

const resolveSlotPlayers = async (
	db: DatabaseContext,
	eventId: string,
	slot: TeamBattleSlotRecord,
) => {
	const players: string[] = [];

	if (slot.assignment_type === "pair" && slot.pair_id) {
		const pair = await db.pairs.ensurePair(slot.pair_id);
		if (pair.player1_id) players.push(pair.player1_id);
		if (pair.player2_id) players.push(pair.player2_id);
	} else {
		if (slot.player1_id) players.push(slot.player1_id);
		if (slot.player2_id) players.push(slot.player2_id);
	}

	return players;
};

const recordSlotMatch = async (
	db: DatabaseContext,
	eventId: string,
	battleId: string,
	slotIndex: number,
	teamASlot: TeamBattleSlotRecord,
	teamBSlot: TeamBattleSlotRecord,
	scoreA: number,
	scoreB: number,
	winnerTeamId: string,
) => {
	const existingMatches = await db.matches.listMatches("teamBattle", battleId);
	const existingMatch = existingMatches.find((match) => match.slot_index === slotIndex);

	if (existingMatch) {
		throw new Response(`スロット${slotIndex + 1}の結果はすでに記録されています。`, {
			status: 400,
		});
	}

	const winnerSide = winnerTeamId === teamASlot.team_id ? "a" : "b";

	const [teamAPlayers, teamBPlayers] = await Promise.all([
		resolveSlotPlayers(db, eventId, teamASlot),
		resolveSlotPlayers(db, eventId, teamBSlot),
	]);

	const [teamAPlayer1, teamAPlayer2] =
		teamAPlayers.length > 0 ? teamAPlayers : [teamASlot.player1_id, teamASlot.player2_id];
	const [teamBPlayer1, teamBPlayer2] =
		teamBPlayers.length > 0 ? teamBPlayers : [teamBSlot.player1_id, teamBSlot.player2_id];

	await db.matches.createMatch({
		context: "teamBattle",
		context_id: battleId,
		slot_index: slotIndex,
		side_a_type: teamASlot.assignment_type,
		side_a_pair_id: teamASlot.pair_id,
		side_a_player1_id: teamAPlayer1 ?? undefined,
		side_a_player2_id: teamAPlayer2 ?? undefined,
		side_b_type: teamBSlot.assignment_type,
		side_b_pair_id: teamBSlot.pair_id,
		side_b_player1_id: teamBPlayer1 ?? undefined,
		side_b_player2_id: teamBPlayer2 ?? undefined,
		score_a: scoreA,
		score_b: scoreB,
		winner_side: winnerSide,
	});

	for (const playerId of teamAPlayers) {
		await db.playerStats.incrementPlayerStats(playerId, "teamBattle", battleId, winnerSide === "a");
	}

	for (const playerId of teamBPlayers) {
		await db.playerStats.incrementPlayerStats(playerId, "teamBattle", battleId, winnerSide === "b");
	}
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw redirect("/admin");
	}

	const battleId = params.battleId;
	if (!battleId) {
		throw redirect(`/admin/events/${eventId}/team-battles`);
	}

	const db = getDatabase(context);

	try {
		const battleContext = await fetchBattleContext(db, eventId, battleId);

		return json<LoaderData>({
			eventId,
			battleId,
			...battleContext,
		});
	} catch (error) {
		console.error("[team-battle-detail] loader failed", error);
		throw new Response("団体戦が見つかりませんでした。", { status: 404 });
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const eventId = params.eventId;
	const battleId = params.battleId;

	if (!eventId || !battleId) {
		return json<ActionError>(
			{
				type: "error",
				source: "recordSlotResult",
				message: "イベントIDまたは団体戦IDが見つかりません。",
			},
			{ status: 400 },
		);
	}

	const formData = await request.formData();
	const intent = normalizeText(formData.get("_intent")) as MutationSource | undefined;

	if (!intent) {
		return json<ActionError>(
			{
				type: "error",
				source: "recordSlotResult",
				message: "操作が指定されていません。",
			},
			{ status: 400 },
		);
	}

	const db = getDatabase(context);

	try {
		switch (intent) {
			case "recordSlotResult": {
				const slotIndexRaw = normalizeText(formData.get("slotIndex"));
				const scoreARaw = normalizeText(formData.get("scoreA"));
				const scoreBRaw = normalizeText(formData.get("scoreB"));
				const winnerTeamId = normalizeText(formData.get("winnerTeamId"));

				const slotIndex = parseInteger(slotIndexRaw ?? "");
				const scoreA = parseInteger(scoreARaw ?? "");
				const scoreB = parseInteger(scoreBRaw ?? "");

				if (slotIndex === null || slotIndex < 0) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "スロット番号が不正です。",
						},
						{ status: 400 },
					);
				}

				if (scoreA === null || scoreB === null || scoreA < 0 || scoreB < 0) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "スコアは0以上の整数で入力してください。",
						},
						{ status: 400 },
					);
				}

				if (!winnerTeamId) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "勝者を選択してください。",
						},
						{ status: 400 },
					);
				}

				const battle = await db.teamBattles.ensureTeamBattle(eventId, battleId);

				if (winnerTeamId !== battle.team_a_id && winnerTeamId !== battle.team_b_id) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "勝者として選択されたチームが無効です。",
						},
						{ status: 400 },
					);
				}

				const slots = await db.teamBattleSlots.listSlotsByBattle(battleId);
				const teamASlot = slots.find(
					(slot) => slot.team_id === battle.team_a_id && slot.slot_index === slotIndex,
				);
				const teamBSlot = slots.find(
					(slot) => slot.team_id === battle.team_b_id && slot.slot_index === slotIndex,
				);

				if (!teamASlot || !teamBSlot) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "スロット設定が見つかりません。",
						},
						{ status: 400 },
					);
				}

				try {
					await recordSlotMatch(
						db,
						eventId,
						battleId,
						slotIndex,
						teamASlot,
						teamBSlot,
						scoreA,
						scoreB,
						winnerTeamId,
					);
				} catch (error) {
					if (error instanceof Response) {
						return json<ActionError>(
							{
								type: "error",
								source: intent,
								message: await error.text(),
							},
							{ status: error.status },
						);
					}
					throw error;
				}

				if (battle.status === "pending") {
					await db.teamBattles.updateTeamBattle(eventId, battleId, {
						...battle,
						status: "in_progress",
					});
				}

				return json<ActionSuccess>({
					type: "success",
					source: intent,
					message: `スロット${slotIndex + 1}の結果を記録しました。`,
				});
			}

			case "assignSlot": {
				const teamId = normalizeText(formData.get("teamId"));
				const slotIndexRaw = normalizeText(formData.get("slotIndex"));
				const assignmentType = normalizeText(formData.get("assignmentType")) as
					| "pair"
					| "adhoc"
					| undefined;
				const pairId = normalizeText(formData.get("pairId"));
				const player1Id = normalizeText(formData.get("player1Id"));
				const player2Id = normalizeText(formData.get("player2Id"));

				const slotIndex = parseInteger(slotIndexRaw ?? "");

				if (!teamId || slotIndex === null || slotIndex < 0 || !assignmentType) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "スロット割り当ての入力が不正です。",
						},
						{ status: 400 },
					);
				}

				if (assignmentType === "pair" && !pairId) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "ペア割り当てにはペアを指定してください。",
						},
						{ status: 400 },
					);
				}

				const slots = await db.teamBattleSlots.listSlotsByBattle(battleId);
				const existingSlot = slots.find(
					(slot) => slot.team_id === teamId && slot.slot_index === slotIndex,
				);

				const slotPayload = {
					team_battle_id: battleId,
					team_id: teamId,
					slot_index: slotIndex,
					assignment_type: assignmentType,
					pair_id: assignmentType === "pair" ? pairId ?? undefined : undefined,
					player1_id: assignmentType === "adhoc" ? player1Id ?? undefined : undefined,
					player2_id: assignmentType === "adhoc" ? player2Id ?? undefined : undefined,
				} satisfies Parameters<typeof db.teamBattleSlots.createSlot>[0];

				if (existingSlot) {
					await db.teamBattleSlots.updateSlot(existingSlot.id, slotPayload);
				} else {
					await db.teamBattleSlots.createSlot(slotPayload);
				}

				return json<ActionSuccess>({
					type: "success",
					source: intent,
					message: "スロットを割り当てました。",
				});
			}

			case "deleteSlotResult": {
				const matchId = normalizeText(formData.get("matchId"));
				if (!matchId) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "対象の試合IDが指定されていません。",
						},
						{ status: 400 },
					);
				}

				await db.matches.deleteMatch(matchId);

				return json<ActionSuccess>({
					type: "success",
					source: intent,
					message: "スロット結果を削除しました。",
				});
			}

			case "finalizeBattle": {
				const battle = await db.teamBattles.ensureTeamBattle(eventId, battleId);
				const matches = await db.matches.listMatches("teamBattle", battleId);

				if (matches.length < battle.slots_count) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: `全${battle.slots_count}スロットの結果を入力してください。`,
						},
						{ status: 400 },
					);
				}

				const slotResults: SlotResult[] = matches.map((match, index) => ({
					slot_index: typeof match.slot_index === "number" ? match.slot_index : index,
					winner_team_id: match.winner_side === "a" ? battle.team_a_id : battle.team_b_id,
					score_a: match.score_a,
					score_b: match.score_b,
				}));

				const { result, teamAWins, teamBWins } = calculateBattleResult(
					slotResults,
					battle.team_a_id,
					battle.team_b_id,
				);

				let finalStatus: TeamBattleRecord["status"] = "completed";
				let finalResult: TeamBattleRecord["result"] = result;

				if (result === "draw" && battle.tiebreak === "representative") {
					finalStatus = "tiebreak_required";
					finalResult = "draw";
				}

				await db.teamBattles.updateTeamBattle(eventId, battleId, {
					...battle,
					status: finalStatus,
					result: finalResult ?? undefined,
				});

				return json<ActionSuccess>({
					type: "success",
					source: intent,
					message: `団体戦を確定しました (チームA: ${teamAWins}勝, チームB: ${teamBWins}勝)。`,
				});
			}

			case "recordTiebreaker": {
				const scoreARaw = normalizeText(formData.get("scoreA"));
				const scoreBRaw = normalizeText(formData.get("scoreB"));
				const winnerTeamId = normalizeText(formData.get("winnerTeamId"));

				const scoreA = parseInteger(scoreARaw ?? "");
				const scoreB = parseInteger(scoreBRaw ?? "");

				if (scoreA === null || scoreB === null || scoreA < 0 || scoreB < 0) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "スコアは0以上の整数で入力してください。",
						},
						{ status: 400 },
					);
				}

				if (!winnerTeamId) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "勝者を選択してください。",
						},
						{ status: 400 },
					);
				}

				const battle = await db.teamBattles.ensureTeamBattle(eventId, battleId);

				if (battle.status !== "tiebreak_required") {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "この団体戦ではタイブレークは不要です。",
						},
						{ status: 400 },
					);
				}

				if (winnerTeamId !== battle.team_a_id && winnerTeamId !== battle.team_b_id) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "勝者として選択されたチームが無効です。",
						},
						{ status: 400 },
					);
				}

				const winnerSide = winnerTeamId === battle.team_a_id ? "a" : "b";
				const finalResult = winnerTeamId === battle.team_a_id ? "team_a_win" : "team_b_win";

				await db.matches.createMatch({
					context: "tiebreak",
					context_id: battleId,
					side_a_type: "adhoc",
					side_b_type: "adhoc",
					score_a: scoreA,
					score_b: scoreB,
					winner_side: winnerSide,
				});

				await db.teamBattles.updateTeamBattle(eventId, battleId, {
					...battle,
					status: "completed",
					result: finalResult,
				});

				return json<ActionSuccess>({
					type: "success",
					source: intent,
					message: "タイブレークの結果を記録しました。",
				});
			}

			case "recordKothMatch": {
				const scoreARaw = normalizeText(formData.get("scoreA"));
				const scoreBRaw = normalizeText(formData.get("scoreB"));
				const winnerTeamId = normalizeText(formData.get("winnerTeamId"));

				const scoreA = parseInteger(scoreARaw ?? "");
				const scoreB = parseInteger(scoreBRaw ?? "");

				if (scoreA === null || scoreB === null || scoreA < 0 || scoreB < 0) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "スコアは0以上の整数で入力してください。",
						},
						{ status: 400 },
					);
				}

				if (!winnerTeamId) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "勝者を選択してください。",
						},
						{ status: 400 },
					);
				}

				const battle = await db.teamBattles.ensureTeamBattle(eventId, battleId);

				if (battle.format !== "koth") {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "この団体戦は勝ち抜き戦ではありません。",
						},
						{ status: 400 },
					);
				}

				if (winnerTeamId !== battle.team_a_id && winnerTeamId !== battle.team_b_id) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "勝者として選択されたチームが無効です。",
						},
						{ status: 400 },
					);
				}

				const existingMatches = await db.matches.listMatches("teamBattle", battleId);
				const mainMatches = existingMatches.filter((m) => m.slot_index !== null);
				const kothState = computeKothState(
					battle.slots_count,
					battle.team_a_id,
					battle.team_b_id,
					mainMatches,
				);

				if (kothState.finished) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "この団体戦は既に終了しています。",
						},
						{ status: 400 },
					);
				}

				const slots = await db.teamBattleSlots.listSlotsByBattle(battleId);
				const teamASlot = slots.find(
					(slot) => slot.team_id === battle.team_a_id && slot.slot_index === kothState.aCurrentIndex,
				);
				const teamBSlot = slots.find(
					(slot) => slot.team_id === battle.team_b_id && slot.slot_index === kothState.bCurrentIndex,
				);

				if (!teamASlot || !teamBSlot) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "現在の出場枠のラインナップが設定されていません。ラインナップ編集ページで設定してください。",
						},
						{ status: 400 },
					);
				}

				const winnerSide = winnerTeamId === battle.team_a_id ? "a" : "b";
				const matchIndex = kothState.nextMatchIndex;

				const [teamAPlayers, teamBPlayers] = await Promise.all([
					resolveSlotPlayers(db, eventId, teamASlot),
					resolveSlotPlayers(db, eventId, teamBSlot),
				]);

				const [teamAPlayer1, teamAPlayer2] =
					teamAPlayers.length > 0 ? teamAPlayers : [teamASlot.player1_id, teamASlot.player2_id];
				const [teamBPlayer1, teamBPlayer2] =
					teamBPlayers.length > 0 ? teamBPlayers : [teamBSlot.player1_id, teamBSlot.player2_id];

				await db.matches.createMatch({
					context: "teamBattle",
					context_id: battleId,
					slot_index: matchIndex,
					side_a_type: teamASlot.assignment_type,
					side_a_pair_id: teamASlot.pair_id,
					side_a_player1_id: teamAPlayer1 ?? undefined,
					side_a_player2_id: teamAPlayer2 ?? undefined,
					side_b_type: teamBSlot.assignment_type,
					side_b_pair_id: teamBSlot.pair_id,
					side_b_player1_id: teamBPlayer1 ?? undefined,
					side_b_player2_id: teamBPlayer2 ?? undefined,
					score_a: scoreA,
					score_b: scoreB,
					winner_side: winnerSide,
				});

				for (const playerId of teamAPlayers) {
					await db.playerStats.incrementPlayerStats(playerId, "teamBattle", battleId, winnerSide === "a");
				}

				for (const playerId of teamBPlayers) {
					await db.playerStats.incrementPlayerStats(playerId, "teamBattle", battleId, winnerSide === "b");
				}

				// 試合後の状態を再計算して、終了判定
				const updatedMatches = await db.matches.listMatches("teamBattle", battleId);
				const mainUpdatedMatches = updatedMatches.filter((m) => m.slot_index !== null);
				const updatedState = computeKothState(
					battle.slots_count,
					battle.team_a_id,
					battle.team_b_id,
					mainUpdatedMatches,
				);

				let finalStatus: TeamBattleRecord["status"] = battle.status;
				let finalResult: TeamBattleRecord["result"] = battle.result;

				if (updatedState.finished) {
					finalStatus = "completed";
					finalResult = updatedState.winnerTeamId === battle.team_a_id ? "team_a_win" : "team_b_win";
				} else if (battle.status === "pending") {
					finalStatus = "in_progress";
				}

				await db.teamBattles.updateTeamBattle(eventId, battleId, {
					...battle,
					status: finalStatus,
					result: finalResult ?? undefined,
				});

				return json<ActionSuccess>({
					type: "success",
					source: intent,
					message: updatedState.finished
						? `試合結果を記録しました。団体戦終了: ${updatedState.winnerTeamId === battle.team_a_id ? "チームA" : "チームB"}の勝利`
						: `試合${matchIndex + 1}の結果を記録しました。`,
				});
			}

			case "deleteKothMatch": {
				const matchId = normalizeText(formData.get("matchId"));
				if (!matchId) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "対象の試合IDが指定されていません。",
						},
						{ status: 400 },
					);
				}

				const battle = await db.teamBattles.ensureTeamBattle(eventId, battleId);

				if (battle.format !== "koth") {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "この団体戦は勝ち抜き戦ではありません。",
						},
						{ status: 400 },
					);
				}

				const matches = await db.matches.listMatches("teamBattle", battleId);
				const matchToDelete = matches.find((m) => m.id === matchId);

				if (!matchToDelete) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "指定された試合が見つかりません。",
						},
						{ status: 404 },
					);
				}

				// 最後の試合のみ削除可能
				const sortedMatches = matches.sort((a, b) => {
					const aIdx = a.slot_index ?? 0;
					const bIdx = b.slot_index ?? 0;
					return bIdx - aIdx;
				});

				if (sortedMatches.length === 0 || sortedMatches[0].id !== matchId) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "最後の試合のみ削除できます。",
						},
						{ status: 400 },
					);
				}

				await db.matches.deleteMatch(matchId);

				// 状態を再計算して更新
				const remainingMatches = matches.filter((m) => m.id !== matchId);
				const mainRemainingMatches = remainingMatches.filter((m) => m.slot_index !== null);
				const updatedState = computeKothState(
					battle.slots_count,
					battle.team_a_id,
					battle.team_b_id,
					mainRemainingMatches,
				);

				let finalStatus: TeamBattleRecord["status"] = "pending";
				let finalResult: TeamBattleRecord["result"] = undefined;

				if (remainingMatches.length > 0) {
					finalStatus = "in_progress";
				}

				await db.teamBattles.updateTeamBattle(eventId, battleId, {
					...battle,
					status: finalStatus,
					result: finalResult,
				});

				return json<ActionSuccess>({
					type: "success",
					source: intent,
					message: "最後の試合結果を削除しました。",
				});
			}

			case "recordKothFriendlyMatch": {
				const slotAIdRaw = normalizeText(formData.get("slotAId"));
				const slotBIdRaw = normalizeText(formData.get("slotBId"));
				const scoreARaw = normalizeText(formData.get("scoreA"));
				const scoreBRaw = normalizeText(formData.get("scoreB"));
				const winnerSideRaw = normalizeText(formData.get("winnerSide"));

				if (!slotAIdRaw || !slotBIdRaw) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "Side AとSide Bのスロットを選択してください。",
						},
						{ status: 400 },
					);
				}

				if (slotAIdRaw === slotBIdRaw) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "Side AとSide Bは異なるスロットを選択してください。",
						},
						{ status: 400 },
					);
				}

				const scoreA = parseInteger(scoreARaw ?? "");
				const scoreB = parseInteger(scoreBRaw ?? "");

				if (scoreA === null || scoreB === null || scoreA < 0 || scoreB < 0) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "スコアは0以上の整数で入力してください。",
						},
						{ status: 400 },
					);
				}

				if (winnerSideRaw !== "a" && winnerSideRaw !== "b") {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "勝者を選択してください。",
						},
						{ status: 400 },
					);
				}

				const battle = await db.teamBattles.ensureTeamBattle(eventId, battleId);

				if (battle.format !== "koth") {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "この団体戦は勝ち抜き戦ではありません。",
						},
						{ status: 400 },
					);
				}

				// KOTH状態を計算して終了確認
				const existingMatches = await db.matches.listMatches("teamBattle", battleId);
				const mainMatches = existingMatches.filter((m) => m.slot_index !== null);
				const kothState = computeKothState(
					battle.slots_count,
					battle.team_a_id,
					battle.team_b_id,
					mainMatches,
				);

				if (!kothState.finished || !kothState.winnerTeamId) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "追加対戦は、団体戦が終了した後にのみ登録できます。",
						},
						{ status: 400 },
					);
				}

				// スロットを取得
				const slots = await db.teamBattleSlots.listSlotsByBattle(battleId);
				const slotA = slots.find((s) => s.id === slotAIdRaw);
				const slotB = slots.find((s) => s.id === slotBIdRaw);

				if (!slotA || !slotB) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "選択されたスロットが見つかりません。",
						},
						{ status: 404 },
					);
				}

				// 両方のスロットが勝者側チームに属していることを確認
				if (slotA.team_id !== kothState.winnerTeamId || slotB.team_id !== kothState.winnerTeamId) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "追加対戦は勝者側チームのスロットのみ使用できます。",
						},
						{ status: 400 },
					);
				}

				// 両方のスロットが現在のインデックスより後ろにあることを確認
				const winnerCurrentIndex =
					kothState.winnerTeamId === battle.team_a_id
						? kothState.aCurrentIndex
						: kothState.bCurrentIndex;

				if (
					slotA.slot_index <= winnerCurrentIndex ||
					slotB.slot_index <= winnerCurrentIndex
				) {
					return json<ActionError>(
						{
							type: "error",
							source: intent,
							message: "追加対戦は、現在の出場順より後ろのスロットのみ使用できます。",
						},
						{ status: 400 },
					);
				}

				// プレイヤー情報を取得
				const [slotAPlayers, slotBPlayers] = await Promise.all([
					resolveSlotPlayers(db, eventId, slotA),
					resolveSlotPlayers(db, eventId, slotB),
				]);

				const [slotAPlayer1, slotAPlayer2] =
					slotAPlayers.length > 0 ? slotAPlayers : [slotA.player1_id, slotA.player2_id];
				const [slotBPlayer1, slotBPlayer2] =
					slotBPlayers.length > 0 ? slotBPlayers : [slotB.player1_id, slotB.player2_id];

				// 追加対戦を記録（slot_index: null）
				await db.matches.createMatch({
					context: "teamBattle",
					context_id: battleId,
					slot_index: null,
					side_a_type: slotA.assignment_type,
					side_a_pair_id: slotA.pair_id,
					side_a_player1_id: slotAPlayer1 ?? undefined,
					side_a_player2_id: slotAPlayer2 ?? undefined,
					side_b_type: slotB.assignment_type,
					side_b_pair_id: slotB.pair_id,
					side_b_player1_id: slotBPlayer1 ?? undefined,
					side_b_player2_id: slotBPlayer2 ?? undefined,
					score_a: scoreA,
					score_b: scoreB,
					winner_side: winnerSideRaw,
				});

				// プレイヤー統計やバトルステータスは更新しない

				return json<ActionSuccess>({
					type: "success",
					source: intent,
					message: "追加対戦（エキシビション）を記録しました。",
				});
			}
		}

		return json<ActionError>(
			{
				type: "error",
				source: intent,
				message: "不明な操作です。",
			},
			{ status: 400 },
		);
	} catch (error) {
		console.error("[team-battle-detail] action failed", error);
		return json<ActionError>(
			{
				type: "error",
				source: intent,
				message: "団体戦の処理中にエラーが発生しました。",
			},
			{ status: 500 },
		);
	}
}

function KothBattleUI({
	battle,
	slots,
	kothState,
	kothMatches,
	teamNameById,
	pairsById,
	playersById,
	getTeamName,
	battleCompleted,
	isSubmitting,
}: {
	battle: TeamBattleRecord;
	slots: TeamBattleSlotRecord[];
	kothState: KothState | null;
	kothMatches: MatchRecord[];
	teamNameById: Map<string, string>;
	pairsById: Map<string, PairRecord>;
	playersById: Map<string, PlayerRecord>;
	getTeamName: (teamId: string) => string;
	battleCompleted: boolean;
	isSubmitting: boolean;
}) {
	if (!kothState) return null;

	const teamASlot = slots.find(
		(slot) => slot.team_id === battle.team_a_id && slot.slot_index === kothState.aCurrentIndex,
	);
	const teamBSlot = slots.find(
		(slot) => slot.team_id === battle.team_b_id && slot.slot_index === kothState.bCurrentIndex,
	);

	// 大将まで到達していない場合の残ったプレイヤーを取得
	const hasRemainingPlayers = kothState.finished && 
		(kothState.aCurrentIndex < battle.slots_count - 1 || kothState.bCurrentIndex < battle.slots_count - 1);
	
	const remainingTeamASlots = hasRemainingPlayers && kothState.aCurrentIndex < battle.slots_count - 1
		? slots.filter(
				(slot) => slot.team_id === battle.team_a_id && slot.slot_index > kothState.aCurrentIndex
			)
		: [];
	
	const remainingTeamBSlots = hasRemainingPlayers && kothState.bCurrentIndex < battle.slots_count - 1
		? slots.filter(
				(slot) => slot.team_id === battle.team_b_id && slot.slot_index > kothState.bCurrentIndex
			)
		: [];

	// 勝者側チームの残りスロットを取得（追加対戦用）
	const winnerTeamId = kothState.winnerTeamId;
	const winnerRemainingSlots = winnerTeamId === battle.team_a_id 
		? remainingTeamASlots 
		: winnerTeamId === battle.team_b_id 
		? remainingTeamBSlots 
		: [];
	const canPlayFriendlyMatch = kothState.finished && winnerRemainingSlots.length >= 2;

	return (
		<>
			<article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="koth-next-match-card">
				<header className="mb-6 flex flex-col gap-2">
					<h2 className="text-lg font-semibold text-slate-900">
						{kothState.finished ? "試合終了" : "次の対戦カード"}
					</h2>
					<p className="text-sm text-slate-500">
						{kothState.finished
							? "この団体戦は終了しています。"
							: "次の対戦のラインナップと結果を入力してください。"}
					</p>
				</header>

				{!kothState.finished && teamASlot && teamBSlot ? (
					<div className="flex flex-col gap-4">
						<div className="grid items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[1fr_auto_1fr]">
							<SlotAssignment
								title="チームA"
								slot={teamASlot}
								teamName={getTeamName(battle.team_a_id)}
								pairsById={pairsById}
								playersById={playersById}
							/>
							<div className="flex items-center justify-center text-sm font-semibold text-slate-500">
								VS
							</div>
							<SlotAssignment
								title="チームB"
								slot={teamBSlot}
								teamName={getTeamName(battle.team_b_id)}
								pairsById={pairsById}
								playersById={playersById}
							/>
						</div>

						<Form method="post" className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-inner">
							<input type="hidden" name="_intent" value="recordKothMatch" />

							<div className="grid gap-4 sm:grid-cols-2">
								<label className="flex flex-col gap-2 text-sm text-slate-600">
									<span className="font-medium">スコアA</span>
									<input
										type="number"
										name="scoreA"
										min={0}
										max={10}
										required
										data-testid="koth-score-a"
										className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
									/>
								</label>
								<label className="flex flex-col gap-2 text-sm text-slate-600">
									<span className="font-medium">スコアB</span>
									<input
										type="number"
										name="scoreB"
										min={0}
										max={10}
										required
										data-testid="koth-score-b"
										className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
									/>
								</label>
							</div>

							<label className="flex flex-col gap-2 text-sm text-slate-600">
								<span className="font-medium">勝者</span>
								<select
									name="winnerTeamId"
									required
									data-testid="koth-winner-select"
									className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
								>
									<option value="">選択してください</option>
									<option value={battle.team_a_id}>{getTeamName(battle.team_a_id)}</option>
									<option value={battle.team_b_id}>{getTeamName(battle.team_b_id)}</option>
								</select>
							</label>

							<div className="flex justify-end">
								<button
									type="submit"
									disabled={isSubmitting}
									data-testid="koth-record-result-button"
									className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
								>
									結果を記録
								</button>
							</div>
						</Form>
					</div>
				) : !kothState.finished ? (
					<div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-center text-sm text-slate-500">
						両チームの現在の出場枠のラインナップが未設定です。ラインナップ編集ページで割り当ててください。
					</div>
				) : canPlayFriendlyMatch ? (
					<div className="flex flex-col gap-4" data-testid="koth-friendly-card">
						<div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-4">
							<div className="mb-2 flex items-center gap-2">
								<span className="text-lg">🎮</span>
								<h3 className="text-base font-semibold text-indigo-900">追加対戦（エキシビション）</h3>
							</div>
							<p className="text-sm text-indigo-800">
								勝者側チーム（{getTeamName(winnerTeamId ?? "")}）の残ったプレイヤー同士で追加対戦を楽しむことができます。
							</p>
						</div>

						<Form method="post" className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-inner">
							<input type="hidden" name="_intent" value="recordKothFriendlyMatch" />

							<div className="grid gap-4 md:grid-cols-2">
								<label className="flex flex-col gap-2 text-sm text-slate-600">
									<span className="font-medium">Side A（勝者側チームのスロット）</span>
									<select
										name="slotAId"
										required
										data-testid="koth-friendly-side-a-select"
										className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
									>
										<option value="">選択してください</option>
										{winnerRemainingSlots.map((slot) => (
											<option key={slot.id} value={slot.id}>
												{slot.slot_index + 1}番手:{" "}
												{slot.assignment_type === "pair" ? (
													(() => {
														const pair = slot.pair_id ? pairsById.get(slot.pair_id) : undefined;
														const player1 = pair?.player1_id ? playersById.get(pair.player1_id) : undefined;
														const player2 = pair?.player2_id ? playersById.get(pair.player2_id) : undefined;
														return pair
															? `${player1?.name ?? "(Unknown)"} / ${player2?.name ?? "(Unknown)"}`
															: "ペア情報が見つかりません";
													})()
												) : (
													`${slot.player1_id ? playersById.get(slot.player1_id)?.name ?? "(Unknown)" : "-"} / ${slot.player2_id ? playersById.get(slot.player2_id)?.name ?? "(Unknown)" : "-"}`
												)}
											</option>
										))}
									</select>
								</label>

								<label className="flex flex-col gap-2 text-sm text-slate-600">
									<span className="font-medium">Side B（勝者側チームのスロット）</span>
									<select
										name="slotBId"
										required
										data-testid="koth-friendly-side-b-select"
										className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
									>
										<option value="">選択してください</option>
										{winnerRemainingSlots.map((slot) => (
											<option key={slot.id} value={slot.id}>
												{slot.slot_index + 1}番手:{" "}
												{slot.assignment_type === "pair" ? (
													(() => {
														const pair = slot.pair_id ? pairsById.get(slot.pair_id) : undefined;
														const player1 = pair?.player1_id ? playersById.get(pair.player1_id) : undefined;
														const player2 = pair?.player2_id ? playersById.get(pair.player2_id) : undefined;
														return pair
															? `${player1?.name ?? "(Unknown)"} / ${player2?.name ?? "(Unknown)"}`
															: "ペア情報が見つかりません";
													})()
												) : (
													`${slot.player1_id ? playersById.get(slot.player1_id)?.name ?? "(Unknown)" : "-"} / ${slot.player2_id ? playersById.get(slot.player2_id)?.name ?? "(Unknown)" : "-"}`
												)}
											</option>
										))}
									</select>
								</label>
							</div>

							<div className="grid gap-4 sm:grid-cols-2">
								<label className="flex flex-col gap-2 text-sm text-slate-600">
									<span className="font-medium">スコアA</span>
									<input
										type="number"
										name="scoreA"
										min={0}
										max={10}
										required
										data-testid="koth-friendly-score-a"
										className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
									/>
								</label>
								<label className="flex flex-col gap-2 text-sm text-slate-600">
									<span className="font-medium">スコアB</span>
									<input
										type="number"
										name="scoreB"
										min={0}
										max={10}
										required
										data-testid="koth-friendly-score-b"
										className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
									/>
								</label>
							</div>

							<label className="flex flex-col gap-2 text-sm text-slate-600">
								<span className="font-medium">勝者</span>
								<select
									name="winnerSide"
									required
									data-testid="koth-friendly-winner-select"
									className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
								>
									<option value="">選択してください</option>
									<option value="a">Side A</option>
									<option value="b">Side B</option>
								</select>
							</label>

							<div className="flex justify-end">
								<button
									type="submit"
									disabled={isSubmitting}
									data-testid="koth-friendly-record-button"
									className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
								>
									追加対戦を記録
								</button>
							</div>
						</Form>
					</div>
				) : hasRemainingPlayers ? (
					<div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5" data-testid="koth-remaining-players-message">
						<div className="mb-3 flex items-center gap-2">
							<span className="text-lg">🎮</span>
							<h3 className="text-base font-semibold text-amber-900">残ったプレイヤーがいます</h3>
						</div>
						<p className="mb-4 text-sm text-amber-800">
							この団体戦は終了しましたが、勝者側チームの残りプレイヤーが2人未満のため、追加対戦を登録できません。
						</p>
						<div className="space-y-3">
							{remainingTeamASlots.length > 0 && (
								<div className="rounded-lg border border-amber-200 bg-white/60 px-4 py-3">
									<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
										{getTeamName(battle.team_a_id)}の残ったプレイヤー
									</p>
									<div className="space-y-1 text-sm text-amber-900">
										{remainingTeamASlots.map((slot, idx) => (
											<div key={slot.id} className="flex items-center gap-2">
												<span className="text-xs text-amber-600">
													{slot.slot_index + 1}番手:
												</span>
												<span>
													{slot.assignment_type === "pair" ? (
														(() => {
															const pair = slot.pair_id ? pairsById.get(slot.pair_id) : undefined;
															const player1 = pair?.player1_id ? playersById.get(pair.player1_id) : undefined;
															const player2 = pair?.player2_id ? playersById.get(pair.player2_id) : undefined;
															return pair ? (
																<>
																	{player1?.name ?? "(Unknown)"} / {player2?.name ?? "(Unknown)"}
																</>
															) : (
																<span className="text-rose-500">ペア情報が見つかりません</span>
															);
														})()
													) : (
														<>
															{slot.player1_id ? playersById.get(slot.player1_id)?.name ?? "(Unknown)" : "-"} /{" "}
															{slot.player2_id ? playersById.get(slot.player2_id)?.name ?? "(Unknown)" : "-"}
														</>
													)}
												</span>
											</div>
										))}
									</div>
								</div>
							)}
							{remainingTeamBSlots.length > 0 && (
								<div className="rounded-lg border border-amber-200 bg-white/60 px-4 py-3">
									<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
										{getTeamName(battle.team_b_id)}の残ったプレイヤー
									</p>
									<div className="space-y-1 text-sm text-amber-900">
										{remainingTeamBSlots.map((slot, idx) => (
											<div key={slot.id} className="flex items-center gap-2">
												<span className="text-xs text-amber-600">
													{slot.slot_index + 1}番手:
												</span>
												<span>
													{slot.assignment_type === "pair" ? (
														(() => {
															const pair = slot.pair_id ? pairsById.get(slot.pair_id) : undefined;
															const player1 = pair?.player1_id ? playersById.get(pair.player1_id) : undefined;
															const player2 = pair?.player2_id ? playersById.get(pair.player2_id) : undefined;
															return pair ? (
																<>
																	{player1?.name ?? "(Unknown)"} / {player2?.name ?? "(Unknown)"}
																</>
															) : (
																<span className="text-rose-500">ペア情報が見つかりません</span>
															);
														})()
													) : (
														<>
															{slot.player1_id ? playersById.get(slot.player1_id)?.name ?? "(Unknown)" : "-"} /{" "}
															{slot.player2_id ? playersById.get(slot.player2_id)?.name ?? "(Unknown)" : "-"}
														</>
													)}
												</span>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				) : null}
			</article>

			{kothMatches.length > 0 && (
				<article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="koth-match-history">
					<header className="mb-6 flex flex-col gap-2">
						<h2 className="text-lg font-semibold text-slate-900">試合履歴</h2>
						<p className="text-sm text-slate-500">
							これまでに行われた試合の一覧です。最後の試合のみ削除できます。
						</p>
					</header>

					<div className="space-y-4">
						{kothMatches.map((match, idx) => {
							const isLast = idx === kothMatches.length - 1;
							return (
								<div
									key={match.id}
									data-testid={`koth-match-${idx + 1}`}
									className={`flex flex-col gap-3 rounded-2xl border p-4 ${
										match.winner_side === "a"
											? "border-indigo-200 bg-indigo-50/70"
											: "border-violet-200 bg-violet-50/70"
									}`}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span className="text-sm font-semibold text-slate-700">
												試合 {idx + 1}
											</span>
											{match.slot_index === null && (
												<span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
													エキシビション
												</span>
											)}
										</div>
										{isLast && !battleCompleted && match.slot_index !== null && (
											<Form method="post" className="inline-block">
												<input type="hidden" name="_intent" value="deleteKothMatch" />
												<input type="hidden" name="matchId" value={match.id} />
												<button
													type="submit"
													disabled={isSubmitting}
													data-testid="koth-delete-last-match-button"
													className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
												>
													削除
												</button>
											</Form>
										)}
									</div>
									<div className="flex items-baseline justify-center gap-4 text-2xl font-semibold">
										<span
											className={`rounded px-2 py-1 ${
												match.winner_side === "a"
													? "bg-indigo-100 text-indigo-700"
													: "text-slate-500"
											}`}
										>
											{match.score_a}
										</span>
										<span className="text-lg font-medium text-slate-400">-</span>
										<span
											className={`rounded px-2 py-1 ${
												match.winner_side === "b"
													? "bg-violet-100 text-violet-700"
													: "text-slate-500"
											}`}
										>
											{match.score_b}
										</span>
									</div>
									<div className="text-center text-sm text-slate-600">
										勝者:{" "}
										{match.winner_side === "a"
											? getTeamName(battle.team_a_id)
											: getTeamName(battle.team_b_id)}
									</div>
								</div>
							);
						})}
					</div>
				</article>
			)}
		</>
	);
}

const SlotAssignment = ({
	title,
	slot,
	teamName,
	pairsById,
	playersById,
}: {
	title: string;
	slot: TeamBattleSlotRecord | undefined;
	teamName: string;
	pairsById: Map<string, PairRecord>;
	playersById: Map<string, PlayerRecord>;
}) => {
	return (
		<div className="flex flex-col gap-2 rounded-xl bg-slate-50 px-4 py-3">
			<span className="text-sm font-semibold text-slate-500">{title}</span>
			<span className="text-lg font-semibold text-slate-900">{teamName}</span>
			<div className="text-sm text-slate-600">
				{slot ? (
					slot.assignment_type === "pair" ? (
						(() => {
							const pair = slot.pair_id ? pairsById.get(slot.pair_id) : undefined;
							const player1 = pair?.player1_id ? playersById.get(pair.player1_id) : undefined;
							const player2 = pair?.player2_id ? playersById.get(pair.player2_id) : undefined;
							return pair ? (
								<>
									{player1?.name ?? "(Unknown)"} / {player2?.name ?? "(Unknown)"}
								</>
							) : (
								<span className="text-rose-500">ペア情報が見つかりません</span>
							);
						})()
					) : (
						<>
							{slot.player1_id ? playersById.get(slot.player1_id)?.name ?? "(Unknown)" : "-"} /{" "}
							{slot.player2_id ? playersById.get(slot.player2_id)?.name ?? "(Unknown)" : "-"}
						</>
					)
				) : (
					<span className="text-slate-400">未割当</span>
				)}
			</div>
		</div>
	);
};

export default function TeamBattleDetailRoute() {
	const loaderData = useLoaderData<typeof loader>();
	const actionData = useActionData<ActionData>();
	const navigation = useNavigation();
	const isSubmitting = navigation.state !== "idle";

	const [flashMessage, setFlashMessage] = useState<string | null>(null);
	const [flashTone, setFlashTone] = useState<"success" | "error">("success");

	useEffect(() => {
		if (!actionData) {
			return;
		}

		setFlashMessage(actionData.message);
		setFlashTone(actionData.type === "success" ? "success" : "error");

		const timeout = setTimeout(() => setFlashMessage(null), actionData.type === "success" ? 4000 : 5000);
		return () => clearTimeout(timeout);
	}, [actionData]);

	const teamNameById = useMemo(() => {
		const map = new Map<string, string>();
		for (const team of loaderData.teams) {
			map.set(team.id, team.name);
		}
		return map;
	}, [loaderData.teams]);

	const playersById = useMemo(() => {
		const map = new Map<string, PlayerRecord>();
		for (const player of loaderData.players) {
			map.set(player.id, player);
		}
		return map;
	}, [loaderData.players]);

	const pairsById = useMemo(() => {
		const map = new Map<string, PairRecord>();
		for (const pair of loaderData.pairs) {
			map.set(pair.id, pair);
		}
		return map;
	}, [loaderData.pairs]);

	const matchesBySlot = useMemo(() => {
		const map = new Map<number, MatchRecord>();
		for (const match of loaderData.matches) {
			if (typeof match.slot_index === "number") {
				map.set(match.slot_index, match);
			}
		}
		return map;
	}, [loaderData.matches]);

	const currentScore = useMemo(() => {
		return loaderData.matches.reduce(
			(acc, match) => {
				if (match.winner_side === "a") acc.teamA += 1;
				if (match.winner_side === "b") acc.teamB += 1;
				return acc;
			},
			{ teamA: 0, teamB: 0 },
		);
	}, [loaderData.matches]);

	const canFinalize =
		loaderData.matches.filter((match) => match.context === "teamBattle").length ===
		loaderData.battle.slots_count;
	const needsTiebreaker = loaderData.battle.status === "tiebreak_required";
	const battleCompleted = loaderData.battle.status === "completed";
	const isKoth = loaderData.battle.format === "koth";

	const kothState = useMemo<KothState | null>(() => {
		if (!isKoth) return null;
		const mainMatches = loaderData.matches.filter(
			(m) => m.context === "teamBattle" && m.slot_index !== null,
		);
		return computeKothState(
			loaderData.battle.slots_count,
			loaderData.battle.team_a_id,
			loaderData.battle.team_b_id,
			mainMatches,
		);
	}, [isKoth, loaderData.battle, loaderData.matches]);

	const kothMatches = useMemo(() => {
		if (!isKoth) return [];
		return loaderData.matches
			.filter((m) => m.context === "teamBattle")
			.sort((a, b) => {
				// slot_index === null の試合（エキシビション）は後ろに
				if (a.slot_index === null && b.slot_index !== null) return 1;
				if (a.slot_index !== null && b.slot_index === null) return -1;
				if (a.slot_index === null && b.slot_index === null) {
					// 両方エキシビションの場合は played_at でソート
					return a.played_at.localeCompare(b.played_at);
				}
				// 両方通常の試合の場合は slot_index でソート
				const aIdx = a.slot_index ?? 0;
				const bIdx = b.slot_index ?? 0;
				return aIdx - bIdx;
			});
	}, [isKoth, loaderData.matches]);

	const getTeamName = (teamId: string) => teamNameById.get(teamId) ?? "(Unknown)";

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h2 className="text-xl font-semibold text-slate-900">団体戦進行管理</h2>
			</header>

			{flashMessage ? (
				<div
					className={`rounded-xl border px-4 py-3 text-sm font-medium ${
						flashTone === "success"
							? "border-emerald-300 bg-emerald-50 text-emerald-700"
							: "border-rose-300 bg-rose-50 text-rose-700"
					}`}
				>
					{flashMessage}
				</div>
			) : null}

			<section className="grid gap-6">
				<article className="rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 shadow-sm" data-testid="battle-info-card">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div>
							<h2 className="text-xl font-semibold text-slate-900">
								{getTeamName(loaderData.battle.team_a_id)} vs {getTeamName(loaderData.battle.team_b_id)}
							</h2>
							<p className="mt-1 text-sm text-slate-500">団体戦ID: {loaderData.battleId}</p>
						</div>
						<span
							className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(loaderData.battle.status)}`}
							data-testid={battleCompleted ? "battle-finished" : undefined}
						>
							{getStatusLabel(loaderData.battle.status)}
						</span>
					</div>

					<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-xs">
							<p className="text-xs font-medium uppercase tracking-wide text-indigo-500">形式</p>
							<p className="mt-1 text-lg font-semibold text-slate-900">
								{loaderData.battle.format === "koth" ? "勝ち抜き戦" : "早稲田式"}
							</p>
						</div>
						<div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-xs">
							<p className="text-xs font-medium uppercase tracking-wide text-indigo-500">スロット数</p>
							<p className="mt-1 text-lg font-semibold text-slate-900">
								{loaderData.battle.slots_count}
							</p>
						</div>
						<div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-xs">
							<p className="text-xs font-medium uppercase tracking-wide text-indigo-500">タイブレーク</p>
							<p className="mt-1 text-lg font-semibold text-slate-900">
								{loaderData.battle.tiebreak === "off" ? "なし" : "代表戦"}
							</p>
						</div>
						<div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-xs">
							<p className="text-xs font-medium uppercase tracking-wide text-indigo-500">結果</p>
							<p className="mt-1 text-lg font-semibold text-slate-900">
								{loaderData.battle.result ? getResultLabel(loaderData.battle.result) : "-"}
							</p>
						</div>
					</div>

					<div className="mt-6 flex items-center justify-center gap-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm" data-testid="koth-score-display">
						<div className="flex flex-col items-center gap-1">
							<span className="text-sm font-medium text-slate-500">
								{getTeamName(loaderData.battle.team_a_id)}
							</span>
							<span className="text-4xl font-bold text-slate-900">
								{isKoth && kothState ? kothState.bLosses : currentScore.teamA}
							</span>
							{isKoth && kothState && (
								<span className="text-xs text-slate-400">勝数</span>
							)}
						</div>
						<span className="text-3xl font-semibold text-slate-400">-</span>
						<div className="flex flex-col items-center gap-1">
							<span className="text-4xl font-bold text-slate-900">
								{isKoth && kothState ? kothState.aLosses : currentScore.teamB}
							</span>
							<span className="text-sm font-medium text-slate-500">
								{getTeamName(loaderData.battle.team_b_id)}
							</span>
							{isKoth && kothState && (
								<span className="text-xs text-slate-400">勝数</span>
							)}
						</div>
					</div>
				</article>

				{isKoth ? (
					<KothBattleUI
						battle={loaderData.battle}
						slots={loaderData.slots}
						kothState={kothState}
						kothMatches={kothMatches}
						teamNameById={teamNameById}
						pairsById={pairsById}
						playersById={playersById}
						getTeamName={getTeamName}
						battleCompleted={battleCompleted}
						isSubmitting={isSubmitting}
					/>
				) : (
					<article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
						<header className="mb-6 flex flex-col gap-2">
							<h2 className="text-lg font-semibold text-slate-900">スロット別試合結果</h2>
							<p className="text-sm text-slate-500">
								各スロットのラインナップと試合結果を管理します。結果入力済みのスロットは青色で表示されます。
							</p>
						</header>

					<div className="grid gap-6 lg:grid-cols-2">
						{Array.from({ length: loaderData.battle.slots_count }).map((_, slotIndex) => {
							const teamASlot = loaderData.slots.find(
								(slot) =>
									slot.team_id === loaderData.battle.team_a_id && slot.slot_index === slotIndex,
							);
							const teamBSlot = loaderData.slots.find(
								(slot) =>
									slot.team_id === loaderData.battle.team_b_id && slot.slot_index === slotIndex,
							);
							const slotResult = matchesBySlot.get(slotIndex);

							const hasResult = Boolean(slotResult);

							return (
								<div
									key={slotIndex}
									className={`flex flex-col gap-4 rounded-2xl border p-5 shadow-sm transition ${
										hasResult
											? "border-indigo-200 bg-indigo-50/70"
											: "border-slate-200 bg-slate-50/60"
									}`}
								>
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-base font-semibold text-slate-900">
											スロット {slotIndex + 1}
										</h3>
										{hasResult ? (
											<span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
												結果入力済み
											</span>
										) : null}
									</div>

									<div className="grid gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-inner">
										<div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
											<SlotAssignment
												title="チームA"
												slot={teamASlot}
												teamName={getTeamName(loaderData.battle.team_a_id)}
												pairsById={pairsById}
												playersById={playersById}
											/>
											<div className="flex items-center justify-center text-sm font-semibold text-slate-500">
												VS
											</div>
											<SlotAssignment
												title="チームB"
												slot={teamBSlot}
												teamName={getTeamName(loaderData.battle.team_b_id)}
												pairsById={pairsById}
												playersById={playersById}
											/>
										</div>
									</div>

									{slotResult ? (
										<div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-sm text-slate-700">
											<div className="flex items-baseline justify-center gap-4 text-2xl font-semibold">
												<span
													className={`rounded px-2 py-1 ${
														slotResult.winner_side === "a"
															? "bg-indigo-100 text-indigo-700"
															: "text-slate-500"
													}`}
												>
													{slotResult.score_a}
												</span>
												<span className="text-lg font-medium text-slate-400">-</span>
												<span
													className={`rounded px-2 py-1 ${
														slotResult.winner_side === "b"
															? "bg-indigo-100 text-indigo-700"
															: "text-slate-500"
													}`}
												>
													{slotResult.score_b}
												</span>
											</div>
											<div className="text-center text-sm">
												勝者:{" "}
												{slotResult.winner_side === "a"
													? getTeamName(loaderData.battle.team_a_id)
													: getTeamName(loaderData.battle.team_b_id)}
											</div>
											{!battleCompleted ? (
												<Form method="post" className="flex justify-end">
													<input type="hidden" name="_intent" value="deleteSlotResult" />
													<input type="hidden" name="matchId" value={slotResult.id} />
													<button
														type="submit"
														disabled={isSubmitting}
														className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
													>
														削除
													</button>
												</Form>
											) : null}
										</div>
									) : teamASlot && teamBSlot && !battleCompleted ? (
										<Form method="post" className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-inner">
											<input type="hidden" name="_intent" value="recordSlotResult" />
											<input type="hidden" name="slotIndex" value={slotIndex} />

											<div className="grid gap-4 sm:grid-cols-2">
												<label className="flex flex-col gap-2 text-sm text-slate-600">
													<span className="font-medium">スコアA</span>
													<input
														type="number"
														name="scoreA"
														min={0}
														max={10}
														required
														className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
													/>
												</label>
												<label className="flex flex-col gap-2 text-sm text-slate-600">
													<span className="font-medium">スコアB</span>
													<input
														type="number"
														name="scoreB"
														min={0}
														max={10}
														required
														className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
													/>
												</label>
											</div>

											<label className="flex flex-col gap-2 text-sm text-slate-600">
												<span className="font-medium">勝者</span>
												<select
													name="winnerTeamId"
													required
													className="rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
												>
													<option value="">選択してください</option>
													<option value={loaderData.battle.team_a_id}>
														{getTeamName(loaderData.battle.team_a_id)}
													</option>
													<option value={loaderData.battle.team_b_id}>
														{getTeamName(loaderData.battle.team_b_id)}
													</option>
												</select>
											</label>

											<div className="flex justify-end">
												<button
													type="submit"
													disabled={isSubmitting}
													className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
												>
													結果を記録
												</button>
											</div>
										</Form>
									) : (
										<div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-center text-sm text-slate-500">
											両チームのラインナップが未設定です。ラインナップ編集ページで割り当ててください。
										</div>
									)}
								</div>
							);
						})}
					</div>
				</article>
				)}

				{needsTiebreaker && !isKoth ? (
					<article className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100 p-6 shadow-sm">
						<header className="mb-4">
							<h2 className="text-lg font-semibold text-amber-800">🏆 タイブレーク（代表戦）</h2>
							<p className="mt-2 text-sm font-medium text-amber-700">
								スコアが同点のため、代表戦の結果を入力してください。
							</p>
						</header>
						<Form method="post" className="flex flex-col gap-4">
							<input type="hidden" name="_intent" value="recordTiebreaker" />
							<div className="grid gap-4 sm:grid-cols-2">
								<label className="flex flex-col gap-2 text-sm text-slate-600">
									<span className="font-medium">{getTeamName(loaderData.battle.team_a_id)} スコア</span>
									<input
										type="number"
										name="scoreA"
										min={0}
										max={10}
										required
										className="rounded-lg border border-slate-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
									/>
								</label>
								<label className="flex flex-col gap-2 text-sm text-slate-600">
									<span className="font-medium">{getTeamName(loaderData.battle.team_b_id)} スコア</span>
									<input
										type="number"
										name="scoreB"
										min={0}
										max={10}
										required
										className="rounded-lg border border-slate-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
									/>
								</label>
							</div>
							<label className="flex flex-col gap-2 text-sm text-slate-600">
								<span className="font-medium">勝者</span>
								<select
									name="winnerTeamId"
									required
									className="rounded-lg border border-slate-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
								>
									<option value="">選択してください</option>
									<option value={loaderData.battle.team_a_id}>
										{getTeamName(loaderData.battle.team_a_id)}
									</option>
									<option value={loaderData.battle.team_b_id}>
										{getTeamName(loaderData.battle.team_b_id)}
									</option>
								</select>
							</label>
							<div className="flex justify-end">
								<button
									type="submit"
									disabled={isSubmitting}
									className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-300"
								>
									タイブレーク結果を記録
								</button>
							</div>
						</Form>
					</article>
				) : null}

				{canFinalize && !battleCompleted && !needsTiebreaker && !isKoth ? (
					<article className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-6 text-center shadow-sm">
						<h2 className="text-lg font-semibold text-emerald-800">団体戦の確定</h2>
						<p className="mt-2 text-sm font-medium text-emerald-700">
							全スロットの結果が入力されました。団体戦を確定しますか？
						</p>
						<Form method="post" className="mt-4 flex justify-center">
							<input type="hidden" name="_intent" value="finalizeBattle" />
							<button
								type="submit"
								disabled={isSubmitting}
								className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
							>
								団体戦を確定する
							</button>
						</Form>
					</article>
				) : null}
			</section>
		</div>
	);
}
