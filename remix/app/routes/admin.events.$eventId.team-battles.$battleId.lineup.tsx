import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
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
import type { PairRecord } from "~/repositories/pairs";
import type { PlayerRecord } from "~/repositories/players";
import type { TeamBattleSlotRecord } from "~/repositories/team-battle-slots";
import type { TeamBattleRecord } from "~/repositories/team-battles";
import type { TeamRecord } from "~/repositories/teams";

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) return undefined;
	const text = String(value).trim();
	return text.length > 0 ? text : undefined;
};

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
};

type MutationSource = "assignSlot";

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

const fetchBattleContext = async (db: DatabaseContext, eventId: string, battleId: string) => {
	const [battle, slots, teams, players, pairs] = await Promise.all([
		db.teamBattles.ensureTeamBattle(eventId, battleId),
		db.teamBattleSlots.listSlotsByBattle(battleId),
		db.teams.listTeams(eventId),
		db.players.listPlayers(eventId),
		db.pairs.listPairs(eventId),
	]);

	return { battle, slots, teams, players, pairs } satisfies Omit<LoaderData, "eventId" | "battleId">;
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "団体戦ラインナップ編集" }];
	return [{ title: `${data.battle ? "団体戦ラインナップ編集" : "団体戦ラインナップ編集"} | Boost Bracket` }];
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
		console.error("[team-battle-lineup] loader failed", error);
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
				source: "assignSlot",
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
				source: "assignSlot",
				message: "操作が指定されていません。",
			},
			{ status: 400 },
		);
	}

	const db = getDatabase(context);

	try {
		switch (intent) {
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
					message: `スロット${slotIndex + 1}を割り当てました。`,
				});
			}
		}

		return json<ActionError>(
			{
				type: "error",
				source: "assignSlot",
				message: "不明な操作です。",
			},
			{ status: 400 },
		);
	} catch (error) {
		console.error("[team-battle-lineup] action failed", error);
		return json<ActionError>(
			{
				type: "error",
				source: "assignSlot",
				message: "ラインナップ編集の処理中にエラーが発生しました。",
			},
			{ status: 500 },
		);
	}
}

function FlashMessage({ action }: { action: ActionData | undefined }) {
	if (!action) return null;

	return (
		<div
			className={`rounded-xl border px-4 py-3 text-sm font-medium ${
				action.type === "success"
					? "border-emerald-300 bg-emerald-50 text-emerald-700"
					: "border-rose-300 bg-rose-50 text-rose-700"
			}`}
		>
			{action.message}
		</div>
	);
}

function SlotAssignmentForm({
	teamId,
	teamName,
	slotIndex,
	slot,
	teams,
	players,
	pairs,
	isSubmitting,
	isTeamA,
}: {
	teamId: string;
	teamName: string;
	slotIndex: number;
	slot: TeamBattleSlotRecord | undefined;
	teams: TeamRecord[];
	players: PlayerRecord[];
	pairs: PairRecord[];
	isSubmitting: boolean;
	isTeamA: boolean;
}) {
	const [assignmentType, setAssignmentType] = useState<"pair" | "adhoc">(
		slot?.assignment_type === "pair" ? "pair" : "adhoc",
	);
	const [pairId, setPairId] = useState<string>(slot?.pair_id ?? "");
	const [player1Id, setPlayer1Id] = useState<string>(slot?.player1_id ?? "");
	const [player2Id, setPlayer2Id] = useState<string>(slot?.player2_id ?? "");

	const teamPlayers = useMemo(() => {
		// チームに所属するプレイヤーを取得（現状は全プレイヤーを表示）
		return players;
	}, [players]);

	const teamPairs = useMemo(() => {
		// チームに所属するペアを取得（現状は全ペアを表示）
		return pairs;
	}, [pairs]);

	const borderColor = isTeamA ? "border-blue-300" : "border-red-300";
	const focusRingColor = isTeamA ? "focus:ring-blue-200" : "focus:ring-red-200";
	const focusBorderColor = isTeamA ? "focus:border-blue-500" : "focus:border-red-500";
	const buttonColor = isTeamA ? "bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300" : "bg-red-600 hover:bg-red-500 disabled:bg-red-300";

	return (
		<Form method="post" className={`flex flex-col gap-4 rounded-xl border-2 ${borderColor} bg-white p-4 shadow-sm`}>
			<input type="hidden" name="_intent" value="assignSlot" />
			<input type="hidden" name="teamId" value={teamId} />
			<input type="hidden" name="slotIndex" value={slotIndex} />

			<div className="flex items-center justify-end">
				{slot && (
					<span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
						設定済み
					</span>
				)}
			</div>

			<label className="flex flex-col gap-2 text-sm text-slate-600">
				<span className="font-medium">割り当て方法</span>
				<select
					name="assignmentType"
					value={assignmentType}
					onChange={(e) => setAssignmentType(e.target.value as "pair" | "adhoc")}
					className={`rounded-lg border border-slate-300 px-3 py-2 ${focusBorderColor} focus:outline-none focus:ring-2 ${focusRingColor}`}
				>
					<option value="pair">ペア</option>
					<option value="adhoc">個別プレイヤー</option>
				</select>
			</label>

			{assignmentType === "pair" ? (
				<label className="flex flex-col gap-2 text-sm text-slate-600">
					<span className="font-medium">ペア</span>
					<select
						name="pairId"
						value={pairId}
						onChange={(e) => setPairId(e.target.value)}
						required
						className={`rounded-lg border border-slate-300 px-3 py-2 ${focusBorderColor} focus:outline-none focus:ring-2 ${focusRingColor}`}
					>
						<option value="">選択してください</option>
						{teamPairs.map((pair) => {
							const player1 = pair.player1_id ? players.find((p) => p.id === pair.player1_id) : null;
							const player2 = pair.player2_id ? players.find((p) => p.id === pair.player2_id) : null;
							const pairName = player1 && player2 ? `${player1.name} & ${player2.name}` : pair.id;
							return (
								<option key={pair.id} value={pair.id}>
									{pairName}
								</option>
							);
						})}
					</select>
				</label>
			) : (
				<>
					<label className="flex flex-col gap-2 text-sm text-slate-600">
						<span className="font-medium">プレイヤー1</span>
						<select
							name="player1Id"
							value={player1Id}
							onChange={(e) => setPlayer1Id(e.target.value)}
							className={`rounded-lg border border-slate-300 px-3 py-2 ${focusBorderColor} focus:outline-none focus:ring-2 ${focusRingColor}`}
						>
							<option value="">選択してください</option>
							{teamPlayers.map((player) => (
								<option key={player.id} value={player.id}>
									{player.name}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-2 text-sm text-slate-600">
						<span className="font-medium">プレイヤー2</span>
						<select
							name="player2Id"
							value={player2Id}
							onChange={(e) => setPlayer2Id(e.target.value)}
							className={`rounded-lg border border-slate-300 px-3 py-2 ${focusBorderColor} focus:outline-none focus:ring-2 ${focusRingColor}`}
						>
							<option value="">選択してください</option>
							{teamPlayers.map((player) => (
								<option key={player.id} value={player.id}>
									{player.name}
								</option>
							))}
						</select>
					</label>
				</>
			)}

			<button
				type="submit"
				disabled={isSubmitting}
				className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed ${buttonColor}`}
			>
				{isSubmitting ? "保存中..." : "保存"}
			</button>
		</Form>
	);
}

export default function TeamBattleLineupRoute() {
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

	const getTeamName = (teamId: string) => teamNameById.get(teamId) ?? "(Unknown)";

	const slotsByTeamAndIndex = useMemo(() => {
		const map = new Map<string, Map<number, TeamBattleSlotRecord>>();
		for (const slot of loaderData.slots) {
			if (!map.has(slot.team_id)) {
				map.set(slot.team_id, new Map());
			}
			map.get(slot.team_id)!.set(slot.slot_index, slot);
		}
		return map;
	}, [loaderData.slots]);

	return (
		<div className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h2 className="text-xl font-semibold text-slate-900">ラインナップ編集</h2>
				<p className="text-sm text-slate-500">
					各チームの各スロットにペアまたはプレイヤーを割り当てます。
				</p>
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

			<section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
				<header className="mb-6 flex flex-col gap-2">
					<h2 className="text-lg font-semibold text-slate-900">スロット別ラインナップ設定</h2>
					<p className="text-sm text-slate-500">
						各チームの各スロットにペアまたはプレイヤーを割り当てます。勝ち抜き戦では、スロット0が1番手、スロット1が2番手、スロット2が3番手となります。
					</p>
				</header>

				<div className="grid gap-8 lg:grid-cols-2">
					{/* チームA */}
					<div className="flex flex-col gap-6">
						<div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border border-blue-200">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
								A
							</div>
							<h3 className="text-lg font-semibold text-slate-900">
								{getTeamName(loaderData.battle.team_a_id)}
							</h3>
						</div>
						<div className="flex flex-col gap-4">
							{Array.from({ length: loaderData.battle.slots_count }).map((_, slotIndex) => {
								const teamASlots = slotsByTeamAndIndex.get(loaderData.battle.team_a_id);
								const teamASlot = teamASlots?.get(slotIndex);

								return (
									<div key={slotIndex} className="flex flex-col gap-3">
										<div className="flex items-center gap-2">
											<span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
												スロット {slotIndex + 1}
											</span>
											{loaderData.battle.format === "koth" && (
												<span className="text-xs text-slate-500">
													({slotIndex === 0 ? "1番手" : slotIndex === 1 ? "2番手" : "3番手"})
												</span>
											)}
										</div>
										<SlotAssignmentForm
											teamId={loaderData.battle.team_a_id}
											teamName={getTeamName(loaderData.battle.team_a_id)}
											slotIndex={slotIndex}
											slot={teamASlot}
											teams={loaderData.teams}
											players={loaderData.players}
											pairs={loaderData.pairs}
											isSubmitting={isSubmitting}
											isTeamA={true}
										/>
									</div>
								);
							})}
						</div>
					</div>

					{/* チームB */}
					<div className="flex flex-col gap-6">
						<div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 border border-red-200">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white">
								B
							</div>
							<h3 className="text-lg font-semibold text-slate-900">
								{getTeamName(loaderData.battle.team_b_id)}
							</h3>
						</div>
						<div className="flex flex-col gap-4">
							{Array.from({ length: loaderData.battle.slots_count }).map((_, slotIndex) => {
								const teamBSlots = slotsByTeamAndIndex.get(loaderData.battle.team_b_id);
								const teamBSlot = teamBSlots?.get(slotIndex);

								return (
									<div key={slotIndex} className="flex flex-col gap-3">
										<div className="flex items-center gap-2">
											<span className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
												スロット {slotIndex + 1}
											</span>
											{loaderData.battle.format === "koth" && (
												<span className="text-xs text-slate-500">
													({slotIndex === 0 ? "1番手" : slotIndex === 1 ? "2番手" : "3番手"})
												</span>
											)}
										</div>
										<SlotAssignmentForm
											teamId={loaderData.battle.team_b_id}
											teamName={getTeamName(loaderData.battle.team_b_id)}
											slotIndex={slotIndex}
											slot={teamBSlot}
											teams={loaderData.teams}
											players={loaderData.players}
											pairs={loaderData.pairs}
											isSubmitting={isSubmitting}
											isTeamA={false}
										/>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</section>

		</div>
	);
}

