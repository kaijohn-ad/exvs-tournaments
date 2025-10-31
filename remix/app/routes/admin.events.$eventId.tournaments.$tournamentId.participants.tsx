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
import { chooseDisjointPairs } from "~/utils/participants";

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
			source: "addPair" | "addSolo" | "remove" | "setSeed" | "pairManual" | "pairAuto" | "addAll" | "removeAll";
			message: string;
			participants: TournamentParticipantRecord[];
	  }
	| {
			type: "error";
			source: "addPair" | "addSolo" | "remove" | "setSeed" | "pairManual" | "pairAuto" | "addAll" | "removeAll";
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
		| "pairManual"
		| "pairAuto"
		| "addAll"
		| "removeAll"
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

		if (intent === "pairManual") {
			if (tournament.entryMode !== "solo") {
				return json<ActionData>(
					{
						type: "error",
						source: "pairManual",
						message: "手動ペアリングは個別参加モードでのみ利用できます。",
					},
					{ status: 400 }
				);
			}

			const player1Id = normalizeText(formData.get("player1Id"));
			const player2Id = normalizeText(formData.get("player2Id"));

			if (!player1Id || !player2Id) {
				return json<ActionData>(
					{
						type: "error",
						source: "pairManual",
						message: "プレイヤーを2名選択してください。",
					},
					{ status: 400 }
				);
			}

			if (player1Id === player2Id) {
				return json<ActionData>(
					{
						type: "error",
						source: "pairManual",
						message: "同じプレイヤーをペアにすることはできません。",
					},
					{ status: 400 }
				);
			}

			// 既存ペアをチェック
			const existingPairs = await db.pairs.listPairs(eventId);
			const existingPair = existingPairs.find(
				p =>
					(p.player1_id === player1Id && p.player2_id === player2Id) ||
					(p.player1_id === player2Id && p.player2_id === player1Id)
			);

			if (!existingPair) {
				// 新規ペアを作成
				await db.pairs.createPair(eventId, {
					player1_id: player1Id,
					player2_id: player2Id
				});
			}

			const participants = await db.tournamentParticipants.listParticipants(tournamentId);

			return json<ActionData>({
				type: "success",
				source: "pairManual",
				message: existingPair ? "既存のペアが見つかりました。" : "ペアを作成しました。",
				participants,
			});
		}

		if (intent === "pairAuto") {
			if (tournament.entryMode !== "solo") {
				return json<ActionData>(
					{
						type: "error",
						source: "pairAuto",
						message: "自動ペアリングは個別参加モードでのみ利用できます。",
					},
					{ status: 400 }
				);
			}

			try {
				const { pairSoloParticipants } = await import('~/repositories/solo-pairing');
				await pairSoloParticipants(
					eventId,
					tournamentId,
					{
						listParticipants: (tid) => db.tournamentParticipants.listParticipants(tid),
						listPairs: (eid) => db.pairs.listPairs(eid),
						createPair: (eid, data) => db.pairs.createPair(eid, data)
					}
				);

				const participants = await db.tournamentParticipants.listParticipants(tournamentId);

				return json<ActionData>({
					type: "success",
					source: "pairAuto",
					message: "自動ペアリングを実行しました。",
					participants,
				});
			} catch (error) {
				return json<ActionData>(
					{
						type: "error",
						source: "pairAuto",
						message: error instanceof Error ? error.message : "自動ペアリングに失敗しました。",
					},
					{ status: 400 }
				);
			}
		}

		if (intent === "addAll") {
			const existingParticipants = await db.tournamentParticipants.listParticipants(tournamentId);
			
			if (tournament.entryMode === "pair") {
				// ペアモード: イベント内の全ペアを取得
				const allPairs = await db.pairs.listPairs(eventId);
				
				// seed昇順でソート（nullは末尾）
				const sortedPairs = [...allPairs].sort((a, b) => {
					if (a.seed === null && b.seed === null) return 0;
					if (a.seed === null) return 1;
					if (b.seed === null) return -1;
					return a.seed - b.seed;
				});

				// 既存参加者から使用済みプレイヤーIDとペアIDを取得
				const usedPlayerIds = new Set<string>();
				const existingPairIds = new Set<string>();

				for (const participant of existingParticipants) {
					if (participant.participant_type === "pair" && participant.pair_id) {
						existingPairIds.add(participant.pair_id);
						// ペアのプレイヤーIDを取得
						const pair = allPairs.find(p => p.id === participant.pair_id);
						if (pair) {
							usedPlayerIds.add(pair.player1_id);
							usedPlayerIds.add(pair.player2_id);
						}
					} else if (participant.participant_type === "solo" && participant.player_id) {
						usedPlayerIds.add(participant.player_id);
					}
				}

				// 重複しないペアを選択
				const pairsToAdd = chooseDisjointPairs(sortedPairs, usedPlayerIds, existingPairIds);

				// 選択したペアを追加
				let addedCount = 0;
				for (const pair of pairsToAdd) {
					try {
						await db.tournamentParticipants.addPair(tournamentId, pair.id, {
							seed: pair.seed ?? null
						});
						addedCount++;
					} catch (error) {
						// 個別のエラーは無視（既に追加済みなど）
					}
				}

				const participants = await db.tournamentParticipants.listParticipants(tournamentId);

				return json<ActionData>({
					type: "success",
					source: "addAll",
					message: `${addedCount}組のペアを追加しました。`,
					participants,
				});
			} else if (tournament.entryMode === "solo") {
				// ソロモード: イベント内の全プレイヤーを取得
				const allPlayers = await db.players.listPlayers(eventId);
				// ペアも取得（ペア参加者のプレイヤーIDを取得するため）
				const allPairs = await db.pairs.listPairs(eventId);

				// 既存参加者から使用済みプレイヤーIDを取得
				const usedPlayerIds = new Set<string>();
				for (const participant of existingParticipants) {
					if (participant.participant_type === "pair" && participant.pair_id) {
						// ペア参加者の場合は両方のプレイヤーを記録
						const pair = allPairs.find(p => p.id === participant.pair_id);
						if (pair) {
							usedPlayerIds.add(pair.player1_id);
							usedPlayerIds.add(pair.player2_id);
						}
					} else if (participant.participant_type === "solo" && participant.player_id) {
						usedPlayerIds.add(participant.player_id);
					}
				}

				// 未使用のプレイヤーを追加
				let addedCount = 0;
				for (const player of allPlayers) {
					if (!usedPlayerIds.has(player.id)) {
						try {
							await db.tournamentParticipants.addSolo(tournamentId, player.id);
							addedCount++;
						} catch (error) {
							// 個別のエラーは無視
						}
					}
				}

				const participants = await db.tournamentParticipants.listParticipants(tournamentId);

				return json<ActionData>({
					type: "success",
					source: "addAll",
					message: `${addedCount}名のプレイヤーを追加しました。`,
					participants,
				});
			}
		}

		if (intent === "removeAll") {
			await db.tournamentParticipants.removeAll(tournamentId);
			const participants = await db.tournamentParticipants.listParticipants(tournamentId);

			return json<ActionData>({
				type: "success",
				source: "removeAll",
				message: "すべての参加者を削除しました。",
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
				
				{entryMode === "solo" && (
					<div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
						<h3 className="text-sm font-semibold text-blue-900 mb-2">ペアリング機能</h3>
						<p className="text-xs text-blue-700 mb-4">
							個別参加モードでは、ブラケット生成前に参加者を2人1組のペアに組み合わせる必要があります。
						</p>
						
						{/* 手動ペアリング */}
						<div className="mb-4 rounded border border-blue-100 bg-white p-3">
							<h4 className="text-sm font-medium text-slate-700 mb-2">手動ペアリング</h4>
							<Form method="post" className="space-y-3">
								<input type="hidden" name="_intent" value="pairManual" />
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="block text-xs font-medium text-slate-600 mb-1">
											プレイヤー1
										</label>
										<select
											name="player1Id"
											required
											className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										>
											<option value="">選択してください</option>
											{loaderData.players.map((player) => (
												<option key={player.id} value={player.id}>
													{player.name}
												</option>
											))}
										</select>
									</div>
									<div>
										<label className="block text-xs font-medium text-slate-600 mb-1">
											プレイヤー2
										</label>
										<select
											name="player2Id"
											required
											className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										>
											<option value="">選択してください</option>
											{loaderData.players.map((player) => (
												<option key={player.id} value={player.id}>
													{player.name}
												</option>
											))}
										</select>
									</div>
								</div>
								<button
									type="submit"
									disabled={isSubmitting}
									className="w-full rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
								>
									{isSubmitting ? "処理中..." : "ペアを作成"}
								</button>
							</Form>
						</div>
						
						{/* 自動ペアリング */}
						<div className="rounded border border-green-100 bg-white p-3">
							<h4 className="text-sm font-medium text-slate-700 mb-2">自動ペアリング</h4>
							<p className="text-xs text-slate-600 mb-3">
								参加登録済みの個別参加者を自動的に2人1組にペアリングします。
								既存のペアは優先的に再利用されます。
							</p>
							<Form method="post">
								<input type="hidden" name="_intent" value="pairAuto" />
								<button
									type="submit"
									disabled={isSubmitting}
									className="w-full rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
								>
									{isSubmitting ? "処理中..." : "自動ペアリングを実行"}
								</button>
							</Form>
						</div>
					</div>
				)}
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
									data-testid="pair-select"
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
							data-testid="add-pair-button"
							disabled={isSubmitting}
							className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
						>
							{isSubmitting ? "追加中..." : "追加"}
						</button>
					</div>
				</Form>

				{/* 一括操作 */}
				<div className="mt-6 border-t border-slate-200 pt-6">
					<h3 className="text-sm font-semibold text-slate-900 mb-3">一括操作</h3>
					<div className="flex gap-3">
						<Form method="post" className="flex-1">
							<input type="hidden" name="_intent" value="addAll" />
							<button
								type="submit"
								disabled={isSubmitting}
								className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
							>
								{isSubmitting ? "処理中..." : entryMode === "pair" ? "全ペアを追加" : "全プレイヤーを追加"}
							</button>
						</Form>
						<Form method="post" className="flex-1">
							<input type="hidden" name="_intent" value="removeAll" />
							<button
								type="submit"
								disabled={isSubmitting || participants.length === 0}
								onClick={(e) => {
									if (!confirm("すべての参加者を削除しますか？この操作は取り消せません。")) {
										e.preventDefault();
									}
								}}
								className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isSubmitting ? "処理中..." : "全員削除"}
							</button>
						</Form>
					</div>
				</div>
			</section>

			{/* 参加者一覧 */}
			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="participants-list">
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
								data-testid={`participant-${participant.id}`}
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

