import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type AppLoadContext,
} from "@remix-run/cloudflare";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
	useRouteError,
} from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { getDatabase } from "~/repositories/database.server";
import type { PairImportData, PairRecord } from "~/repositories/pairs";
import type { PlayerRecord } from "~/repositories/players";

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) return undefined;
	const text = String(value).trim();
	return text.length > 0 ? text : undefined;
};

const parseSeed = (value: string | undefined): number | undefined => {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const sortPairs = (pairs: PairRecord[]) =>
	[...pairs].sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity));

type LoaderData = {
	eventId: string;
	pairs: PairRecord[];
	players: PlayerRecord[];
	pairsJson: string;
};

type MutationSource = "create" | "update" | "delete" | "import" | "editor";

type ActionSuccess = {
	type: "success";
	source: MutationSource;
	message: string;
	pair?: PairRecord;
	pairs: PairRecord[];
	pairsJson: string;
};

type ActionError = {
	type: "error";
	source: MutationSource;
	message: string;
	payload?: string;
};

type ActionData = ActionSuccess | ActionError;

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw redirect("/admin");
	}

	try {
		const db = getDatabase(context);
		const [pairs, players] = await Promise.all([
			db.pairs.listPairs(eventId),
			db.players.listPlayers(eventId),
		]);

		const sortedPairs = sortPairs(pairs);
		const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name, "ja"));

		return json<LoaderData>({
			eventId,
			pairs: sortedPairs,
			players: sortedPlayers,
			pairsJson: JSON.stringify(sortedPairs, null, 2),
		});
	} catch (error) {
		console.error("pairs loader failed", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			eventId,
			contextKeys: Object.keys(context),
			dbExists: !!context.db,
			cloudflareEnv: context.cloudflare?.env ? Object.keys(context.cloudflare.env) : "undefined"
		});
		throw error;
	}
}

async function fetchPairs(context: AppLoadContext, eventId: string) {
	try {
		const db = getDatabase(context);
		const pairs = await db.pairs.listPairs(eventId);
		const sortedPairs = sortPairs(pairs);

		return {
			pairs: sortedPairs,
			pairsJson: JSON.stringify(sortedPairs, null, 2),
		};
	} catch (error) {
		console.error("fetchPairs failed", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			eventId,
			contextKeys: Object.keys(context),
			dbExists: !!context.db,
			cloudflareEnv: context.cloudflare?.env ? Object.keys(context.cloudflare.env) : "undefined"
		});
		throw error;
	}
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

	const db = getDatabase(context);

	try {
		switch (intent) {
			case "create": {
				const player1 = normalizeText(formData.get("player1_id"));
				const player2 = normalizeText(formData.get("player2_id"));
				const seed = parseSeed(normalizeText(formData.get("seed")));

				if (!player1 || !player2) {
					return json<ActionError>(
						{
							type: "error",
							source: "create",
							message: "プレイヤー1とプレイヤー2は必須です。",
						},
						{ status: 400 },
					);
				}

				if (player1 === player2) {
					return json<ActionError>(
						{
							type: "error",
							source: "create",
							message: "同じプレイヤーをペアにすることはできません。",
						},
						{ status: 400 },
					);
				}

				const pair = await db.pairs.createPair(eventId, {
					player1_id: player1,
					player2_id: player2,
					seed,
				});
				const { pairs, pairsJson } = await fetchPairs(context, eventId);

				return json<ActionSuccess>({
					type: "success",
					source: "create",
					message: "ペアを追加しました。",
					pair,
					pairs,
					pairsJson,
				});
			}

			case "update": {
				const pairId = normalizeText(formData.get("pairId"));
				const player1 = normalizeText(formData.get("player1_id"));
				const player2 = normalizeText(formData.get("player2_id"));
				const seed = parseSeed(normalizeText(formData.get("seed")));

				if (!pairId) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "pairId が指定されていません。",
						},
						{ status: 400 },
					);
				}

				if (!player1 || !player2) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "プレイヤー1とプレイヤー2は必須です。",
						},
						{ status: 400 },
					);
				}

				if (player1 === player2) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "同じプレイヤーをペアにすることはできません。",
						},
						{ status: 400 },
					);
				}

				const existing = await db.pairs.ensurePair(pairId);
				if (existing.event_id !== eventId) {
					throw new Response('Pair not found', { status: 404 });
				}

				const pair = await db.pairs.updatePair(pairId, {
					player1_id: player1,
					player2_id: player2,
					seed,
				});
				const { pairs, pairsJson } = await fetchPairs(context, eventId);

				return json<ActionSuccess>({
					type: "success",
					source: "update",
					message: "ペアを更新しました。",
					pair,
					pairs,
					pairsJson,
				});
			}

			case "delete": {
				const pairId = normalizeText(formData.get("pairId"));

				if (!pairId) {
					return json<ActionError>(
						{
							type: "error",
							source: "delete",
							message: "pairId が指定されていません。",
						},
						{ status: 400 },
					);
				}

				const existing = await db.pairs.ensurePair(pairId);
				if (existing.event_id !== eventId) {
					throw new Response('Pair not found', { status: 404 });
				}

				await db.pairs.deletePair(pairId);
				const { pairs, pairsJson } = await fetchPairs(context, eventId);

				return json<ActionSuccess>({
					type: "success",
					source: "delete",
					message: "ペアを削除しました。",
					pairs,
					pairsJson,
				});
			}

			case "import":
			case "editor": {
				const rawPayload = formData.get("payload");
				const payload = typeof rawPayload === "string" ? rawPayload.trim() : "";
				const mode = intent ?? "import";

				if (!payload) {
					return json<ActionError>(
						{
							type: "error",
							source: mode,
							message: "JSONデータが入力されていません。",
							payload,
						},
						{ status: 400 },
					);
				}

				let parsed: unknown;
				try {
					parsed = JSON.parse(payload);
				} catch {
					return json<ActionError>(
						{
							type: "error",
							source: mode,
							message: "JSONの解析に失敗しました。",
							payload,
						},
						{ status: 400 },
					);
				}

				if (!Array.isArray(parsed)) {
					return json<ActionError>(
						{
							type: "error",
							source: mode,
							message: "配列形式のJSONを指定してください。",
							payload,
						},
						{ status: 400 },
					);
				}

				const sanitized: PairImportData[] = [];
				for (const entry of parsed) {
					if (typeof entry !== "object" || entry === null) {
						continue;
					}

					const id = Reflect.get(entry, "id");
					const player1 = Reflect.get(entry, "player1_id");
					const player2 = Reflect.get(entry, "player2_id");
					const seedValue = Reflect.get(entry, "seed");

					if (typeof player1 !== "string" || typeof player2 !== "string") {
						continue;
					}

					const seed =
						typeof seedValue === "number"
							? seedValue
							: typeof seedValue === "string"
								? parseSeed(seedValue)
								: undefined;

					sanitized.push({
						id: typeof id === "string" ? id : undefined,
						player1_id: player1,
						player2_id: player2,
						seed,
					});
				}

				const imported = await db.pairs.setPairs(eventId, sanitized);
				const pairsJson = JSON.stringify(imported, null, 2);

				return json<ActionSuccess>({
					type: "success",
					source: mode,
					message:
						mode === "editor"
							? `JSONエディタから${imported.length}件のペアを保存しました。`
							: `${imported.length}件のペアを取り込みました。`,
					pairs: imported,
					pairsJson,
				});
			}

			default:
				return json<ActionError>(
					{
						type: "error",
						source: "create",
						message: "不明な操作です。",
					},
					{ status: 400 },
				);
		}
	} catch (error) {
		console.error("pairs action failed", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			intent,
			eventId,
			contextKeys: Object.keys(context),
			dbExists: !!context.db,
			cloudflareEnv: context.cloudflare?.env ? Object.keys(context.cloudflare.env) : "undefined"
		});
		return json<ActionError>(
			{
				type: "error",
				source: intent ?? "create",
				message: `処理中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
			},
			{ status: 500 },
		);
	}
}

function usePairsState(loaderData: LoaderData, actionData: ActionData | undefined) {
	return useMemo(() => {
		const pairs =
			actionData && "pairs" in actionData
				? actionData.pairs
				: loaderData.pairs;
		const pairsJson =
			actionData && "pairsJson" in actionData
				? actionData.pairsJson
				: loaderData.pairsJson;

		return { pairs, pairsJson };
	}, [actionData, loaderData]);
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

export default function PairsRoute() {
	const loaderData = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();

	const { pairs, pairsJson } = usePairsState(loaderData, actionData ?? undefined);

	const playerNameMap = useMemo(() => {
		return new Map(loaderData.players.map((player) => [player.id, player.name]));
	}, [loaderData.players]);

	const [importPayload, setImportPayload] = useState<string>("");
	const [editorOpen, setEditorOpen] = useState(false);
	const [editorPayload, setEditorPayload] = useState(pairsJson);
	const [editorError, setEditorError] = useState<string | null>(null);
	const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

	useEffect(() => {
		const url = URL.createObjectURL(
			new Blob([pairsJson], { type: "application/json" })
		);
		setDownloadUrl(url);
		return () => {
			URL.revokeObjectURL(url);
		};
	}, [pairsJson]);

	useEffect(() => {
		if (actionData?.type === "error") {
			if (actionData.source === "import") {
				setImportPayload(actionData.payload ?? "");
			} else if (actionData.source === "editor") {
				setEditorPayload(actionData.payload ?? loaderData.pairsJson);
			}
		} else if (actionData?.type === "success") {
			if (actionData.source === "import") {
				setImportPayload("");
			}
			if (actionData.source === "editor") {
				setEditorOpen(false);
				setEditorPayload(actionData.pairsJson);
				setEditorError(null);
			}
		}
	}, [actionData, loaderData.pairsJson]);

	useEffect(() => {
		if (!editorOpen) {
			setEditorPayload(pairsJson);
			setEditorError(null);
		}
	}, [editorOpen, pairsJson]);

	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			<header className="space-y-2">
				<h1 className="text-2xl font-semibold text-slate-900">ペア管理</h1>
				<p className="text-sm text-slate-500">
					イベントID:{" "}
					<code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
						{loaderData.eventId}
					</code>
				</p>
			</header>

			<nav>
				<Link
					to="/admin"
					className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
				>
					← 管理トップに戻る
				</Link>
			</nav>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-slate-900">ペアを追加</h2>
				{actionData?.source === "create" ? (
					<div className="mt-4">
						<FlashMessage action={actionData} />
					</div>
				) : null}
				<Form method="post" className="mt-4 grid gap-4">
					<input type="hidden" name="_intent" value="create" />
					<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
						<span>
							プレイヤー1 <span className="text-rose-500">*</span>
						</span>
						<select
							name="player1_id"
							required
							className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							defaultValue=""
						>
							<option value="">選択してください</option>
							{loaderData.players.map((player) => (
								<option key={player.id} value={player.id}>
									{player.name}
								</option>
							))}
						</select>
					</label>

					<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
						<span>
							プレイヤー2 <span className="text-rose-500">*</span>
						</span>
						<select
							name="player2_id"
							required
							className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							defaultValue=""
						>
							<option value="">選択してください</option>
							{loaderData.players.map((player) => (
								<option key={player.id} value={player.id}>
									{player.name}
								</option>
							))}
						</select>
					</label>

					<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
						<span>シード順</span>
						<input
							name="seed"
							type="number"
							min={1}
							className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
						/>
					</label>

					<div>
						<button
							type="submit"
							disabled={isSubmitting}
							className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
						>
							追加
						</button>
					</div>
				</Form>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold text-slate-900">
						登録済みペア ({pairs.length})
					</h2>
					{actionData &&
					actionData.source !== "create" &&
					actionData.source !== "import" &&
					actionData.source !== "editor" ? (
						<FlashMessage action={actionData} />
					) : null}
				</div>

				{pairs.length === 0 ? (
					<p className="mt-4 text-sm text-slate-500">
						まだペアが登録されていません。
					</p>
				) : (
					<ul className="mt-4 space-y-6">
						{pairs.map((pair) => (
							<li key={pair.id} className="rounded-xl border border-slate-200 p-4">
								<Form method="post" className="grid gap-4">
									<input type="hidden" name="_intent" value="update" />
									<input type="hidden" name="pairId" value={pair.id} />

									<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
										<span>プレイヤー1</span>
										<select
											name="player1_id"
											required
											defaultValue={pair.player1_id}
											className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
										>
											{loaderData.players.map((player) => (
												<option key={player.id} value={player.id}>
													{player.name}
												</option>
											))}
										</select>
									</label>

									<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
										<span>プレイヤー2</span>
										<select
											name="player2_id"
											required
											defaultValue={pair.player2_id}
											className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
										>
											{loaderData.players.map((player) => (
												<option key={player.id} value={player.id}>
													{player.name}
												</option>
											))}
										</select>
									</label>

									<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
										<span>シード順</span>
										<input
											name="seed"
											type="number"
											min={1}
											defaultValue={pair.seed ?? ""}
											className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
										/>
									</label>

									<div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
										<span className="font-medium text-slate-700">
											{playerNameMap.get(pair.player1_id) ?? pair.player1_id} &{" "}
											{playerNameMap.get(pair.player2_id) ?? pair.player2_id}
										</span>
										{pair.seed ? (
											<span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
												シード {pair.seed}
											</span>
										) : null}
									</div>

									<div className="flex flex-wrap gap-3">
										<button
											type="submit"
											data-testid="update-pair-button"
											disabled={isSubmitting}
											className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
										>
											更新
										</button>
										<Form method="post">
											<input type="hidden" name="_intent" value="delete" />
											<input type="hidden" name="pairId" value={pair.id} />
											<button
												type="submit"
												data-testid="delete-pair-button"
												disabled={isSubmitting}
												className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-rose-200 disabled:text-rose-300"
												onClick={(event) => {
													if (!confirm("削除しますか？")) {
														event.preventDefault();
													}
												}}
											>
												削除
											</button>
										</Form>
									</div>
								</Form>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
				<div className="space-y-4">
					<h3 className="text-lg font-semibold text-slate-900">エクスポート</h3>
					<textarea
						readOnly
						rows={10}
						className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
						value={pairsJson}
					/>
					<a
						className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
						download={`pairs-${loaderData.eventId}.json`}
						href={downloadUrl ?? undefined}
					>
						JSONをダウンロード
					</a>
				</div>

				<div className="space-y-4">
					<h3 className="text-lg font-semibold text-slate-900">インポート</h3>
					{actionData?.source === "import" ? <FlashMessage action={actionData} /> : null}
					<Form method="post" className="grid gap-4">
						<input type="hidden" name="_intent" value="import" />
						<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
							<span>JSONデータ</span>
							<textarea
								name="payload"
								rows={8}
								value={importPayload}
								placeholder={`[
  { "player1_id": "player-id-1", "player2_id": "player-id-2", "seed": 1 },
  { "id": "custom-id", "player1_id": "player-id-3", "player2_id": "player-id-4" }
]`}
								onChange={(event) => setImportPayload(event.target.value)}
								className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							/>
						</label>
						<div>
							<button
								type="submit"
								disabled={isSubmitting}
								className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
							>
								取り込み
							</button>
						</div>
					</Form>
					<p className="text-xs text-slate-500">
						※ 空行や無効なエントリはスキップされ、既存ペアは上書きされます。
					</p>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">JSONエディタで編集</h2>
						<p className="text-sm text-slate-500">直接JSONを編集し、上書き保存できます。</p>
					</div>
					<button
						type="button"
						className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
							editorOpen
								? "border-blue-500 text-blue-600"
								: "border-slate-300 text-slate-600 hover:bg-slate-100"
						}`}
						onClick={() => setEditorOpen((prev) => !prev)}
					>
						{editorOpen ? "閉じる" : "JSONエディタを開く"}
					</button>
				</div>

				{editorOpen ? (
					<div className="mt-4 space-y-4">
						{actionData?.source === "editor" ? <FlashMessage action={actionData} /> : null}
						<textarea
							rows={14}
							value={editorPayload}
							onChange={(event) => {
								const nextValue = event.target.value;
								setEditorPayload(nextValue);
								try {
									JSON.parse(nextValue);
									setEditorError(null);
								} catch {
									setEditorError("JSONの形式が正しくありません。");
								}
							}}
							className={`w-full rounded-lg border px-3 py-2 text-sm ${
								editorError
									? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
									: "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
							}`}
						/>
						{editorError ? <p className="text-sm text-rose-500">{editorError}</p> : null}
						<Form method="post" className="flex flex-wrap gap-3">
							<input type="hidden" name="_intent" value="editor" />
							<input type="hidden" name="payload" value={editorPayload} />
							<button
								type="button"
								onClick={() => {
									setEditorPayload(loaderData.pairsJson);
									setEditorError(null);
								}}
								className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
							>
								元に戻す
							</button>
							<button
								type="submit"
								disabled={Boolean(editorError) || isSubmitting}
								className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
							>
								JSONを保存
							</button>
						</Form>
					</div>
				) : null}
			</section>
	</div>
	);
}

export function ErrorBoundary() {
	const error = useRouteError();
	console.error(error);
	return (
		<div className="mx-auto max-w-2xl px-6 py-12 text-center">
			<h1 className="text-2xl font-semibold text-rose-600">エラーが発生しました</h1>
			<p className="mt-4 text-sm text-slate-600">
				ペア管理の読み込み中に問題が発生しました。管理トップへ戻ってから再度お試しください。
			</p>
			<div className="mt-6">
				<Link
					to="/admin"
					className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
				>
					管理トップへ戻る
				</Link>
			</div>
		</div>
	);
}
