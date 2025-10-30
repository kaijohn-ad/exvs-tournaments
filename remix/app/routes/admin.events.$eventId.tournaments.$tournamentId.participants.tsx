import { useEffect, useMemo, useState } from "react";
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
import type { TournamentRecord } from "~/repositories/tournaments";
import type { TournamentParticipantRecord } from "~/repositories/tournament-participants";
import type { PairRecord } from "~/repositories/pairs";
import type { PlayerRecord } from "~/repositories/players";

type LoaderData = {
	eventId: string;
	tournamentId: string;
	tournament: TournamentRecord;
	participants: TournamentParticipantRecord[];
	pairs: PairRecord[];
	players: PlayerRecord[];
};

type ActionData =
	| {
			type: "success";
			source: "addPair" | "addSolo" | "remove" | "setSeed";
			message: string;
			participants: TournamentParticipantRecord[];
	  }
	| {
			type: "error";
			source: "addPair" | "addSolo" | "remove" | "setSeed";
			message: string;
	  };

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) {
		return undefined;
	}
	const text = String(value).trim();
	return text.length > 0 ? text : undefined;
};

const parseSeed = (value: FormDataEntryValue | null): number | null => {
	if (!value) {
		return null;
	}
	const parsed = Number(value.toString().trim());
	if (!Number.isFinite(parsed) || parsed < 1) {
		return null;
	}
	return Math.trunc(parsed);
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	const tournamentId = params.tournamentId;

	if (!eventId || !tournamentId) {
		throw new Response("Event ID and Tournament ID are required", { status: 400 });
	}

	const db = getDatabase(context);

	const tournament = await db.tournaments.ensureTournament(tournamentId);
	if (tournament.eventId !== eventId) {
		throw new Response("Tournament not found", { status: 404 });
	}

	const [participants, pairs, players] = await Promise.all([
		db.tournamentParticipants.listParticipants(tournamentId),
		db.pairs.listPairs(eventId),
		db.players.listPlayers(eventId),
	]);

	return json<LoaderData>({
		eventId,
		tournamentId,
		tournament,
		participants,
		pairs,
		players,
	});
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const eventId = params.eventId;
	const tournamentId = params.tournamentId;

	if (!eventId || !tournamentId) {
		throw new Response("Event ID and Tournament ID are required", { status: 400 });
	}

	const db = getDatabase(context);

	const tournament = await db.tournaments.ensureTournament(tournamentId);
	if (tournament.eventId !== eventId) {
		throw new Response("Tournament not found", { status: 404 });
	}

	const formData = await request.formData();
	const intent = normalizeText(formData.get("_intent")) as
		| "addPair"
		| "addSolo"
		| "remove"
		| "setSeed"
		| undefined;

	try {
		if (intent === "addPair") {
			if (tournament.entryMode !== "pair") {
				return json<ActionData>(
					{
						type: "error",
						source: "addPair",
						message: "このトーナメントはペア参加モードではありません。",
					},
					{ status: 400 }
				);
			}

			const pairId = normalizeText(formData.get("pairId"));
			const seed = parseSeed(formData.get("seed"));

			if (!pairId) {
				return json<ActionData>(
					{
						type: "error",
						source: "addPair",
						message: "ペアを選択してください。",
					},
					{ status: 400 }
				);
			}

			await db.tournamentParticipants.addPair(tournamentId, pairId, { seed });
			const participants = await db.tournamentParticipants.listParticipants(tournamentId);

			return json<ActionData>({
				type: "success",
				source: "addPair",
				message: "ペアを追加しました。",
				participants,
			});
		}

		if (intent === "addSolo") {
			if (tournament.entryMode !== "solo") {
				return json<ActionData>(
					{
						type: "error",
						source: "addSolo",
						message: "このトーナメントは個別参加モードではありません。",
					},
					{ status: 400 }
				);
			}

			const playerId = normalizeText(formData.get("playerId"));

			if (!playerId) {
				return json<ActionData>(
					{
						type: "error",
						source: "addSolo",
						message: "プレイヤーを選択してください。",
					},
					{ status: 400 }
				);
			}

			await db.tournamentParticipants.addSolo(tournamentId, playerId);
			const participants = await db.tournamentParticipants.listParticipants(tournamentId);

			return json<ActionData>({
				type: "success",
				source: "addSolo",
				message: "プレイヤーを追加しました。",
				participants,
			});
		}

		if (intent === "remove") {
			const participantId = normalizeText(formData.get("participantId"));

			if (!participantId) {
				return json<ActionData>(
					{
						type: "error",
						source: "remove",
						message: "参加者IDが指定されていません。",
					},
					{ status: 400 }
				);
			}

			await db.tournamentParticipants.removeById(tournamentId, participantId);
			const participants = await db.tournamentParticipants.listParticipants(tournamentId);

			return json<ActionData>({
				type: "success",
				source: "remove",
				message: "参加者を削除しました。",
				participants,
			});
		}

		if (intent === "setSeed") {
			if (tournament.entryMode !== "pair") {
				return json<ActionData>(
					{
						type: "error",
						source: "setSeed",
						message: "シードはペア参加モードでのみ設定できます。",
					},
					{ status: 400 }
				);
			}

			const participantId = normalizeText(formData.get("participantId"));
			const seed = parseSeed(formData.get("seed"));

			if (!participantId) {
				return json<ActionData>(
					{
						type: "error",
						source: "setSeed",
						message: "参加者IDが指定されていません。",
					},
					{ status: 400 }
				);
			}

			await db.tournamentParticipants.setSeed(tournamentId, participantId, seed);
			const participants = await db.tournamentParticipants.listParticipants(tournamentId);

			return json<ActionData>({
				type: "success",
				source: "setSeed",
				message: "シードを更新しました。",
				participants,
			});
		}

		return json<ActionData>(
			{
				type: "error",
				source: "addPair",
				message: "不明な操作です。",
			},
			{ status: 400 }
		);
	} catch (error) {
		return json<ActionData>(
			{
				type: "error",
				source: intent ?? "addPair",
				message: error instanceof Error ? error.message : "操作に失敗しました。",
			},
			{ status: 400 }
		);
	}
}

function FlashMessage({ action }: { action: ActionData | undefined }) {
	if (!action?.message) return null;

	const base =
		action.type === "success"
			? "border-emerald-300 bg-emerald-50 text-emerald-700"
			: "border-rose-300 bg-rose-50 text-rose-700";

	return (
		<div className={`rounded-lg border px-4 py-3 text-sm ${base}`}>
			{action.message}
		</div>
	);
}

export default function TournamentParticipantsRoute() {
	const loaderData = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();

	const participants = useMemo(() => {
		if (actionData?.type === "success" && actionData.participants) {
			return actionData.participants;
		}
		return loaderData.participants;
	}, [actionData, loaderData.participants]);

	const playerNameMap = useMemo(() => {
		return new Map(loaderData.players.map((player) => [player.id, player.name]));
	}, [loaderData.players]);

	const pairMap = useMemo(() => {
		return new Map(loaderData.pairs.map((pair) => [pair.id, pair]));
	}, [loaderData.pairs]);

	const getPairDisplayName = (pairId: string): string => {
		const pair = pairMap.get(pairId);
		if (!pair) {
			return "(不明なペア)";
		}
		const player1Name = playerNameMap.get(pair.player1_id) ?? "?";
		const player2Name = playerNameMap.get(pair.player2_id) ?? "?";
		return `${player1Name} / ${player2Name}`;
	};

	const isSubmitting = navigation.state === "submitting";
	const entryMode = loaderData.tournament.entryMode;

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			<header className="space-y-2">
				<h1 className="text-2xl font-semibold text-slate-900">
					{loaderData.tournament.name} - 参加者管理
				</h1>
				<div className="flex items-center gap-4 text-sm text-slate-500">
					<span>
						イベントID:{" "}
						<code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
							{loaderData.eventId}
						</code>
					</span>
					<span>
						参加モード:{" "}
						<span className="font-medium">
							{entryMode === "pair" ? "ペア参加" : "個別参加"}
						</span>
					</span>
				</div>
			</header>

			<nav>
				<Link
					to={`/admin/events/${loaderData.eventId}/tournaments`}
					className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
				>
					← トーナメント設定に戻る
				</Link>
			</nav>

			<FlashMessage action={actionData ?? undefined} />

			{/* 追加フォーム */}
			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900 mb-4">
					{entryMode === "pair" ? "ペアを追加" : "プレイヤーを追加"}
				</h2>
				<Form method="post" className="space-y-4">
					{entryMode === "pair" ? (
						<>
							<input type="hidden" name="_intent" value="addPair" />
							<div>
								<label className="block text-sm font-medium text-slate-700 mb-2">
									ペアを選択
								</label>
								<select
									name="pairId"
									required
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								>
									<option value="">選択してください</option>
									{loaderData.pairs.map((pair) => {
										const displayName = getPairDisplayName(pair.id);
										const isAlreadyAdded = participants.some(
											(p) => p.participant_type === "pair" && p.pair_id === pair.id
										);
										return (
											<option key={pair.id} value={pair.id} disabled={isAlreadyAdded}>
												{displayName}
												{isAlreadyAdded ? " (追加済み)" : ""}
											</option>
										);
									})}
								</select>
							</div>
							<div>
								<label className="block text-sm font-medium text-slate-700 mb-2">
									シード（任意）
								</label>
								<input
									type="number"
									name="seed"
									min="1"
									placeholder="例: 1"
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								/>
							</div>
						</>
					) : (
						<>
							<input type="hidden" name="_intent" value="addSolo" />
							<div>
								<label className="block text-sm font-medium text-slate-700 mb-2">
									プレイヤーを選択
								</label>
								<select
									name="playerId"
									required
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								>
									<option value="">選択してください</option>
									{loaderData.players.map((player) => {
										const isAlreadyAdded = participants.some(
											(p) => p.participant_type === "solo" && p.player_id === player.id
										);
										return (
											<option key={player.id} value={player.id} disabled={isAlreadyAdded}>
												{player.name}
												{isAlreadyAdded ? " (追加済み)" : ""}
											</option>
										);
									})}
								</select>
							</div>
						</>
					)}
					<div className="flex justify-end">
						<button
							type="submit"
							disabled={isSubmitting}
							className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
						>
							{isSubmitting ? "追加中..." : "追加"}
						</button>
					</div>
				</Form>
			</section>

			{/* 参加者一覧 */}
			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900 mb-4">
					参加者一覧 ({participants.length})
				</h2>
				{participants.length === 0 ? (
					<p className="text-sm text-slate-500">まだ参加者が登録されていません。</p>
				) : (
					<div className="space-y-4">
						{participants.map((participant) => (
							<div
								key={participant.id}
								className="rounded-lg border border-slate-200 bg-slate-50 p-4"
							>
								<div className="flex items-center justify-between">
									<div className="flex-1">
										{participant.participant_type === "pair" ? (
											<>
												<div className="font-medium text-slate-900">
													{getPairDisplayName(participant.pair_id!)}
												</div>
												{participant.seed != null && (
													<span className="text-xs text-slate-500">
														シード: {participant.seed}
													</span>
												)}
											</>
										) : (
											<div className="font-medium text-slate-900">
												{playerNameMap.get(participant.player_id!) ?? "(不明なプレイヤー)"}
											</div>
										)}
									</div>
									<div className="flex items-center gap-2">
										{entryMode === "pair" && (
											<Form method="post" className="inline">
												<input type="hidden" name="_intent" value="setSeed" />
												<input type="hidden" name="participantId" value={participant.id} />
												<input
													type="number"
													name="seed"
													min="1"
													placeholder="シード"
													defaultValue={participant.seed ?? ""}
													className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
												/>
												<button
													type="submit"
													disabled={isSubmitting}
													className="ml-2 rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
												>
													更新
												</button>
											</Form>
										)}
										<Form method="post" className="inline">
											<input type="hidden" name="_intent" value="remove" />
											<input type="hidden" name="participantId" value={participant.id} />
											<button
												type="submit"
												disabled={isSubmitting}
												onClick={(e) => {
													if (!confirm("参加者を削除しますか？")) {
														e.preventDefault();
													}
												}}
												className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
											>
												削除
											</button>
										</Form>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}

