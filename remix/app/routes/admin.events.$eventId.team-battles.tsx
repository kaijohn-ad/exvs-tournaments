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
import type { TeamBattleRecord } from "~/repositories/team-battles";
import type { TeamRecord } from "~/repositories/teams";

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) return undefined;
	const text = String(value).trim();
	return text.length > 0 ? text : undefined;
};

const parseRequiredSlotsCount = (value: string | undefined): number | null => {
	if (!value) return 3;
	const parsed = Number(value);
	if (!Number.isInteger(parsed)) return null;
	if (parsed < 1 || parsed > 5) return null;
	return parsed;
};

const parseOptionalSlotsCount = (value: string | undefined): number | undefined | null => {
	if (!value) return undefined;
	const parsed = Number(value);
	if (!Number.isInteger(parsed)) return null;
	if (parsed < 1 || parsed > 5) return null;
	return parsed;
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

type LoaderData = {
	eventId: string;
	teamBattles: TeamBattleRecord[];
	teams: TeamRecord[];
};

type MutationSource = "create" | "update" | "delete";

type ActionSuccess = {
	type: "success";
	source: MutationSource;
	message: string;
	teamBattles: TeamBattleRecord[];
};

type ActionError = {
	type: "error";
	source: MutationSource;
	message: string;
};

type ActionData = ActionSuccess | ActionError;

const fetchTeamBattles = async (
	db: DatabaseContext,
	eventId: string,
): Promise<TeamBattleRecord[]> => {
	return db.teamBattles.listTeamBattles(eventId);
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw redirect("/admin");
	}

	const db = getDatabase(context);
	const [teamBattles, teams] = await Promise.all([
		fetchTeamBattles(db, eventId),
		db.teams.listTeams(eventId),
	]);

	return json<LoaderData>({
		eventId,
		teamBattles,
		teams,
	});
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		return json<ActionError>(
			{
				type: "error",
				source: "create",
				message: "イベントIDが見つかりません。",
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
				source: "create",
				message: "操作が指定されていません。",
			},
			{ status: 400 },
		);
	}

	const db = getDatabase(context);

	const respondWithBattles = async (
		payload: Omit<ActionSuccess, "teamBattles">,
		status = 200,
	) => {
		const teamBattles = await fetchTeamBattles(db, eventId);
		return json<ActionSuccess>({ ...payload, teamBattles }, { status });
	};

	try {
		switch (intent) {
			case "create": {
				const teamAId = normalizeText(formData.get("team_a_id"));
				const teamBId = normalizeText(formData.get("team_b_id"));
				const slotsCountRaw = normalizeText(formData.get("slots_count"));
				const format = normalizeText(formData.get("format")) ?? "waseda";
				const tiebreak = normalizeText(formData.get("tiebreak")) ?? "off";

				if (!teamAId) {
					return json<ActionError>(
						{
							type: "error",
							source: "create",
							message: "チームAを選択してください。",
						},
						{ status: 400 },
					);
				}

				if (!teamBId) {
					return json<ActionError>(
						{
							type: "error",
							source: "create",
							message: "チームBを選択してください。",
						},
						{ status: 400 },
					);
				}

				if (teamAId === teamBId) {
					return json<ActionError>(
						{
							type: "error",
							source: "create",
							message: "同じチームを選択することはできません。",
						},
						{ status: 400 },
					);
				}

				const slotsCount = parseRequiredSlotsCount(slotsCountRaw);
				if (slotsCount === null) {
					return json<ActionError>(
						{
							type: "error",
							source: "create",
							message: "スロット数は1〜5の範囲で指定してください。",
						},
						{ status: 400 },
					);
				}

				try {
					await db.teams.ensureTeam(eventId, teamAId);
					await db.teams.ensureTeam(eventId, teamBId);
				} catch (error) {
					console.error("[team-battles:create] team validation failed", error);
					return json<ActionError>(
						{
							type: "error",
							source: "create",
							message: "指定されたチームが見つかりません。",
						},
						{ status: 404 },
					);
				}

				await db.teamBattles.createTeamBattle(eventId, {
					team_a_id: teamAId,
					team_b_id: teamBId,
					slots_count: slotsCount,
					format,
					tiebreak,
				});

				const teams = await db.teams.listTeams(eventId);
				const teamAName = teams.find((team) => team.id === teamAId)?.name ?? "チームA";
				const teamBName = teams.find((team) => team.id === teamBId)?.name ?? "チームB";

				return respondWithBattles({
					type: "success",
					source: "create",
					message: `団体戦「${teamAName} vs ${teamBName}」を作成しました。`,
				});
			}

			case "update": {
				const battleId = normalizeText(formData.get("battleId"));
				const teamAId = normalizeText(formData.get("team_a_id"));
				const teamBId = normalizeText(formData.get("team_b_id"));
				const slotsCountRaw = normalizeText(formData.get("slots_count"));
				const format = normalizeText(formData.get("format"));
				const tiebreak = normalizeText(formData.get("tiebreak"));

				if (!battleId) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "battleId が指定されていません。",
						},
						{ status: 400 },
					);
				}

				if (!teamAId) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "チームAを選択してください。",
						},
						{ status: 400 },
					);
				}

				if (!teamBId) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "チームBを選択してください。",
						},
						{ status: 400 },
					);
				}

				if (teamAId === teamBId) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "同じチームを選択することはできません。",
						},
						{ status: 400 },
					);
				}

				const slotsCount = parseOptionalSlotsCount(slotsCountRaw);
				if (slotsCount === null) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "スロット数は1〜5の範囲で指定してください。",
						},
						{ status: 400 },
					);
				}

				try {
					await db.teamBattles.ensureTeamBattle(eventId, battleId);
				} catch (error) {
					console.error("[team-battles:update] battle validation failed", error);
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "指定された団体戦が見つかりません。",
						},
						{ status: 404 },
					);
				}

				try {
					await db.teams.ensureTeam(eventId, teamAId);
					await db.teams.ensureTeam(eventId, teamBId);
				} catch (error) {
					console.error("[team-battles:update] team validation failed", error);
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "指定されたチームが見つかりません。",
						},
						{ status: 404 },
					);
				}

				await db.teamBattles.updateTeamBattle(eventId, battleId, {
					team_a_id: teamAId,
					team_b_id: teamBId,
					slots_count: slotsCount ?? undefined,
					format: format ?? undefined,
					tiebreak: tiebreak ?? undefined,
				});

				const teams = await db.teams.listTeams(eventId);
				const teamAName = teams.find((team) => team.id === teamAId)?.name ?? "チームA";
				const teamBName = teams.find((team) => team.id === teamBId)?.name ?? "チームB";

				return respondWithBattles({
					type: "success",
					source: "update",
					message: `団体戦「${teamAName} vs ${teamBName}」を更新しました。`,
				});
			}

			case "delete": {
				const battleId = normalizeText(formData.get("battleId"));
				if (!battleId) {
					return json<ActionError>(
						{
							type: "error",
							source: "delete",
							message: "battleId が指定されていません。",
						},
						{ status: 400 },
					);
				}

				try {
					await db.teamBattles.deleteTeamBattle(eventId, battleId);
				} catch (error) {
					console.error("[team-battles:delete] failed", error);
					return json<ActionError>(
						{
							type: "error",
							source: "delete",
							message: "指定された団体戦が見つかりません。",
						},
						{ status: 404 },
					);
				}

				return respondWithBattles({
					type: "success",
					source: "delete",
					message: "団体戦を削除しました。",
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
		console.error("[team-battles] action failed", error);
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

function FlashMessage({ action }: { action: ActionData | undefined | null }) {
	if (!action?.message) return null;
	const tone = action.type === "success" ? "success" : "error";
	const classes =
		tone === "success"
			? "border-emerald-300 bg-emerald-50 text-emerald-700"
			: "border-rose-300 bg-rose-50 text-rose-700";
	return (
		<div className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>
			{action.message}
		</div>
	);
}

function BattleEditForm({
	battle,
	teams,
	onCancel,
	isSubmitting,
}: {
	battle: TeamBattleRecord;
	teams: TeamRecord[];
	onCancel: () => void;
	isSubmitting: boolean;
}) {
	return (
		<Form method="post" className="grid gap-4">
			<input type="hidden" name="_intent" value="update" />
			<input type="hidden" name="battleId" value={battle.id} />

			<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
				<span>
					チームA <span className="text-rose-500">*</span>
				</span>
				<select
					name="team_a_id"
					required
					defaultValue={battle.team_a_id}
					className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				>
					{teams.map((team) => (
						<option key={team.id} value={team.id}>
							{team.name}
						</option>
					))}
				</select>
			</label>

			<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
				<span>
					チームB <span className="text-rose-500">*</span>
				</span>
				<select
					name="team_b_id"
					required
					defaultValue={battle.team_b_id}
					className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				>
					{teams.map((team) => (
						<option key={team.id} value={team.id}>
							{team.name}
						</option>
					))}
				</select>
			</label>

			<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
				<span>
					スロット数 <span className="text-rose-500">*</span>
				</span>
				<select
					name="slots_count"
					defaultValue={String(battle.slots_count)}
					className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				>
					{[1, 2, 3, 4, 5].map((value) => (
						<option key={value} value={value}>
							{value}
						</option>
					))}
				</select>
			</label>

			<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
				<span>形式</span>
				<select
					name="format"
					defaultValue={battle.format}
					className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				>
					<option value="waseda">早稲田式</option>
				</select>
			</label>

			<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
				<span>タイブレーク</span>
				<select
					name="tiebreak"
					defaultValue={battle.tiebreak}
					className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
				>
					<option value="off">なし</option>
					<option value="representative">代表戦</option>
				</select>
			</label>

			<div className="flex flex-wrap items-center gap-3">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
				>
					キャンセル
				</button>
				<button
					type="submit"
					disabled={isSubmitting}
					className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
				>
					更新
				</button>
			</div>
		</Form>
	);
}

export default function TeamBattlesRoute() {
	const loaderData = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const [editingBattleId, setEditingBattleId] = useState<string | null>(null);

	useEffect(() => {
		if (actionData?.type === "success" && actionData.source === "update") {
			setEditingBattleId(null);
		}
	}, [actionData]);

	const teamMap = useMemo(() => {
		const map = new Map<string, TeamRecord>();
		for (const team of loaderData.teams) {
			map.set(team.id, team);
		}
		return map;
	}, [loaderData.teams]);

	const teamBattles = useMemo(() => {
		if (actionData?.type === "success") {
			return actionData.teamBattles;
		}
		return loaderData.teamBattles;
	}, [actionData, loaderData.teamBattles]);

	const getTeamName = (teamId: string) => teamMap.get(teamId)?.name ?? "(Unknown)";
	const hasEnoughTeams = loaderData.teams.length >= 2;
	const isSubmitting = navigation.state === "submitting";
	const showCreateError = actionData?.source === "create" && actionData.type === "error";
	const showListMessage = actionData && !(actionData.source === "create" && actionData.type === "error");

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold text-slate-900">団体戦管理</h1>
					<p className="text-sm text-slate-500">
						イベントID: {" "}
						<code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
							{loaderData.eventId}
						</code>
					</p>
				</div>
				<Link
					to="/admin"
					className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
				>
					← 管理トップに戻る
				</Link>
			</header>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">団体戦を作成</h2>
				{showCreateError ? <FlashMessage action={actionData} /> : null}
				{hasEnoughTeams ? (
					<Form method="post" className="mt-4 grid gap-4">
						<input type="hidden" name="_intent" value="create" />

						<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
							<span>
								チームA <span className="text-rose-500">*</span>
							</span>
							<select
								name="team_a_id"
								required
								className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							>
								<option value="">選択してください</option>
								{loaderData.teams.map((team) => (
									<option key={team.id} value={team.id}>
										{team.name}
									</option>
								))}
							</select>
						</label>

						<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
							<span>
								チームB <span className="text-rose-500">*</span>
							</span>
							<select
								name="team_b_id"
								required
								className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							>
								<option value="">選択してください</option>
								{loaderData.teams.map((team) => (
									<option key={team.id} value={team.id}>
										{team.name}
									</option>
								))}
							</select>
						</label>

						<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
							<span>
								スロット数 <span className="text-rose-500">*</span>
							</span>
							<select
								name="slots_count"
								defaultValue="3"
								className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							>
								{[1, 2, 3, 4, 5].map((value) => (
									<option key={value} value={value}>
										{value}
									</option>
								))}
							</select>
						</label>

						<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
							<span>形式</span>
							<select
								name="format"
								defaultValue="waseda"
								className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							>
								<option value="waseda">早稲田式</option>
							</select>
						</label>

						<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
							<span>タイブレーク</span>
							<select
								name="tiebreak"
								defaultValue="off"
								className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							>
								<option value="off">なし</option>
								<option value="representative">代表戦</option>
							</select>
						</label>

						<div className="flex items-center">
							<button
								type="submit"
								disabled={isSubmitting}
								className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
							>
								作成
							</button>
						</div>
					</Form>
				) : (
					<p className="mt-4 text-sm text-slate-500">
						団体戦を作成するには、少なくとも2つのチームが必要です。
						<Link
							to={`/admin/events/${loaderData.eventId}/entries/teams`}
							className="ml-2 text-blue-600 underline"
						>
							チーム管理ページ
						</Link>
						でチームを追加してください。
					</p>
				)}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-lg font-semibold text-slate-900">
						登録済み団体戦 ({teamBattles.length}件)
					</h2>
					{showListMessage ? <FlashMessage action={actionData} /> : null}
				</div>

				{teamBattles.length === 0 ? (
					<p className="mt-4 text-sm text-slate-500">まだ団体戦が登録されていません。</p>
				) : (
					<ul className="mt-6 space-y-6">
						{teamBattles.map((battle) => {
							const isEditing = editingBattleId === battle.id;
							return (
								<li key={battle.id} className="rounded-xl border border-slate-200 p-5 shadow-sm">
									{isEditing ? (
										<BattleEditForm
											battle={battle}
											teams={loaderData.teams}
											onCancel={() => setEditingBattleId(null)}
											isSubmitting={isSubmitting}
										/>
									) : (
										<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
											<div className="space-y-3">
												<h3 className="text-lg font-semibold text-slate-900">
													<Link
														to={`/admin/events/${loaderData.eventId}/team-battles/${battle.id}`}
														className="transition hover:text-blue-600"
													>
														{getTeamName(battle.team_a_id)} vs {getTeamName(battle.team_b_id)}
													</Link>
												</h3>
												<div className="flex flex-wrap gap-3 text-sm text-slate-500">
													<span>スロット数: {battle.slots_count}</span>
													<span>形式: {battle.format}</span>
													{battle.tiebreak !== "off" ? <span>タイブレーク: {battle.tiebreak}</span> : null}
												</div>
												<div className="flex flex-wrap items-center gap-3">
													<span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(battle.status)}`}>
														{getStatusLabel(battle.status)}
													</span>
													{battle.result ? (
														<span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
															{getResultLabel(battle.result)}
														</span>
													) : null}
												</div>
											</div>
											<div className="flex flex-col gap-3 md:items-end">
												<div className="flex gap-2">
													<button
														type="button"
														onClick={() => setEditingBattleId(battle.id)}
														className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
													>
														編集
													</button>
													<Form method="post">
														<input type="hidden" name="_intent" value="delete" />
														<input type="hidden" name="battleId" value={battle.id} />
														<button
															type="submit"
															disabled={isSubmitting}
															onClick={(event) => {
															if (!confirm("この団体戦を削除しますか？")) {
																event.preventDefault();
															}
														}}
															className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-rose-200 disabled:text-rose-300"
														>
															削除
														</button>
													</Form>
												</div>
												<div className="flex flex-col gap-2 text-sm text-blue-600">
													<Link
														to={`/admin/events/${loaderData.eventId}/team-battles/${battle.id}`}
														className="transition hover:text-blue-500"
													>
														進行管理 →
													</Link>
													<Link
														to={`/admin/events/${loaderData.eventId}/team-battles/${battle.id}/lineup`}
														className="transition hover:text-blue-500"
													>
														ラインナップ編集 →
													</Link>
												</div>
											</div>
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">📝 団体戦について</h2>
				<p className="mt-3 text-sm text-slate-600">
					団体戦（早稲田式）の管理機能です。チーム同士の対戦を設定し、各スロットにプレイヤーを配置してラインナップを管理できます。
				</p>
				<p className="mt-2 text-xs text-slate-500">
					※ ラインナップ編集は各団体戦カードの「ラインナップ編集」から行えます。
				</p>
			</section>
		</div>
	);
}

