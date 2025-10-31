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
	isRouteErrorResponse,
} from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { getDatabase } from "~/repositories/database.server";
import type { PlayerImportData, PlayerRecord } from "~/repositories/players";

const collator = new Intl.Collator("ja");

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) return undefined;
	const text = String(value).trim();
	return text.length > 0 ? text : undefined;
};

const sortPlayers = (players: PlayerRecord[]) =>
	[...players].sort((a, b) => collator.compare(a.name, b.name));

type LoaderData = {
	eventId: string;
	players: PlayerRecord[];
	playersJson: string;
};

type MutationSource = "create" | "update" | "delete" | "import" | "editor";

type ActionSuccess = {
	type: "success";
	source: MutationSource;
	message: string;
	player?: PlayerRecord;
	players: PlayerRecord[];
	playersJson: string;
	payload?: string;
};

type ActionError = {
	type: "error";
	source: MutationSource;
	message: string;
	payload?: string;
};

type ActionData = ActionSuccess | ActionError | null;

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw redirect("/admin");
	}

	try {
		const db = getDatabase(context);
		const players = await db.players.listPlayers(eventId);
		const sortedPlayers = sortPlayers(players);

		return json<LoaderData>({
			eventId,
			players: sortedPlayers,
			playersJson: JSON.stringify(sortedPlayers, null, 2),
		});
	} catch (error) {
		console.error("players loader failed", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			eventId,
			contextKeys: Object.keys(context),
			dbExists: !!context.db,
			cloudflareEnv: context.cloudflare?.env ? Object.keys(context.cloudflare.env) : "undefined"
		});

		// データベース接続エラーの場合、より明確なエラーメッセージを返す
		if (error instanceof Error && error.message.includes("D1 database is not available")) {
			throw new Response(
				"D1データベースが利用できません。データベースの設定を確認してください。",
				{ status: 503 }
			);
		}

		// その他のエラーはそのまま再スロー
		throw error;
	}
}

async function fetchPlayers(ctx: AppLoadContext, eventId: string) {
	try {
		const db = getDatabase(ctx);
		const players = await db.players.listPlayers(eventId);
		const sortedPlayers = sortPlayers(players);

		return {
			players: sortedPlayers,
			playersJson: JSON.stringify(sortedPlayers, null, 2),
		};
	} catch (error) {
		console.error("fetchPlayers failed", {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			eventId,
			contextKeys: Object.keys(ctx),
			dbExists: !!ctx.db,
			cloudflareEnv: ctx.cloudflare?.env ? Object.keys(ctx.cloudflare.env) : "undefined"
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
				const name = normalizeText(formData.get("name"));
				const note = normalizeText(formData.get("note"));

				if (!name) {
					return json<ActionError>(
						{
							type: "error",
							source: "create",
							message: "名前は必須です。",
						},
						{ status: 400 },
					);
				}

				const player = await db.players.createPlayer(eventId, { name, note });
				const { players, playersJson } = await fetchPlayers(context, eventId);

				return json<ActionSuccess>({
					type: "success",
					source: "create",
					message: `プレイヤー「${player.name}」を追加しました。`,
					player,
					players,
					playersJson,
				});
			}

			case "update": {
				const playerId = normalizeText(formData.get("playerId"));
				const name = normalizeText(formData.get("name"));
				const note = normalizeText(formData.get("note"));

				if (!playerId) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "playerId が指定されていません。",
						},
						{ status: 400 },
					);
				}

				if (!name) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "名前は必須です。",
						},
						{ status: 400 },
					);
				}

				const existing = await db.players.ensurePlayer(playerId);
				if (existing.event_id !== eventId) {
					throw new Response('Player not found', { status: 404 });
				}

				const player = await db.players.updatePlayer(playerId, { name, note });
				const { players, playersJson } = await fetchPlayers(context, eventId);

				return json<ActionSuccess>({
					type: "success",
					source: "update",
					message: `プレイヤー「${player.name}」を更新しました。`,
					player,
					players,
					playersJson,
				});
			}

			case "delete": {
				const playerId = normalizeText(formData.get("playerId"));

				if (!playerId) {
					return json<ActionError>(
						{
							type: "error",
							source: "delete",
							message: "playerId が指定されていません。",
						},
						{ status: 400 },
					);
				}

				const existing = await db.players.ensurePlayer(playerId);
				if (existing.event_id !== eventId) {
					throw new Response('Player not found', { status: 404 });
				}

				await db.players.deletePlayer(playerId);
				const { players, playersJson } = await fetchPlayers(context, eventId);

				return json<ActionSuccess>({
					type: "success",
					source: "delete",
					message: "プレイヤーを削除しました。",
					players,
					playersJson,
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

				const sanitized: PlayerImportData[] = [];
				for (const entry of parsed) {
					if (typeof entry !== "object" || entry === null) {
						continue;
					}

					const id = Reflect.get(entry, "id");
					const name = Reflect.get(entry, "name");
					const note = Reflect.get(entry, "note");

					if (typeof name !== "string") {
						continue;
					}

					sanitized.push({
						id: typeof id === "string" ? id : undefined,
						name,
						note: typeof note === "string" ? note : undefined,
					});
				}

				const imported = await db.players.setPlayers(eventId, sanitized);
				const playersJson = JSON.stringify(imported, null, 2);

				return json<ActionSuccess>({
					type: "success",
					source: mode,
					message:
						mode === "editor"
							? `JSONエディタから${imported.length}件のプレイヤーを保存しました。`
							: `${imported.length}件のプレイヤーを取り込みました。`,
					players: imported,
					playersJson,
				});
			}

			default: {
				return json<ActionError>(
					{
						type: "error",
						source: "create",
						message: "不明な操作です。",
					},
					{ status: 400 },
				);
			}
		}
	} catch (error) {
		console.error("players action failed", {
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

function usePlayersState(loaderData: LoaderData, actionData: ActionData | undefined) {
	return useMemo(() => {
		const players = actionData && "players" in actionData && actionData.players
			? actionData.players
			: loaderData.players;
		const playersJson =
			actionData && "playersJson" in actionData && actionData.playersJson
				? actionData.playersJson
				: loaderData.playersJson;

		return { players, playersJson };
	}, [actionData, loaderData]);
}

function FlashMessage({
	action,
}: {
	action: ActionData | undefined;
}) {
	if (!action?.type || !action?.message) return null;
	return (
		<div
			className={`rounded-lg border px-4 py-3 text-sm ${
				action.type === "success"
					? "border-emerald-300 bg-emerald-50 text-emerald-700"
					: "border-rose-300 bg-rose-50 text-rose-700"
			}`}
		>
			{action.message}
		</div>
	);
}

export default function PlayersRoute() {
	const loaderData = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();

	const { players, playersJson } = usePlayersState(loaderData, actionData);

	const [importPayload, setImportPayload] = useState<string>("");
	const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

	useEffect(() => {
		const nextPayload =
			actionData?.source === "import" || actionData?.source === "editor"
				? actionData.payload ?? ""
				: "";
		setImportPayload(nextPayload);
	}, [actionData]);

	useEffect(() => {
		// SSR時は実行しない（クライアント側でのみ実行）
		if (typeof window === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") {
			return;
		}

		try {
			const blob = new Blob([playersJson], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			setDownloadUrl(url);
			return () => {
				URL.revokeObjectURL(url);
			};
		} catch (error) {
			// Blob作成に失敗した場合は何もしない（SSR環境など）
			console.warn("Failed to create blob URL:", error);
		}
	}, [playersJson]);

	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			<header className="space-y-2">
				<h1 className="text-2xl font-semibold text-slate-900">プレイヤー管理</h1>
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
				<h2 className="text-lg font-semibold text-slate-900">プレイヤーを追加</h2>
				{actionData?.source === "create" ? <FlashMessage action={actionData} /> : null}
				<Form method="post" className="mt-4 grid gap-4">
					<input type="hidden" name="_intent" value="create" />
					<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
						<span>
							名前 <span className="text-rose-500">*</span>
						</span>
						<input
							name="name"
							required
							className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
						/>
					</label>
					<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
						<span>メモ</span>
						<textarea
							name="note"
							rows={2}
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
						登録済みプレイヤー ({players.length})
					</h2>
					{actionData?.source && actionData.source !== "create" && (
						<FlashMessage action={actionData} />
					)}
				</div>
				{players.length === 0 ? (
					<p className="mt-4 text-sm text-slate-500">
						まだプレイヤーが登録されていません。
					</p>
				) : (
					<ul className="mt-4 space-y-6">
						{players.map((player) => (
							<li key={player.id} className="rounded-xl border border-slate-200 p-4">
								<Form method="post" className="grid gap-4">
									<input type="hidden" name="_intent" value="update" />
									<input type="hidden" name="playerId" value={player.id} />

									<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
										<span>名前</span>
										<input
											name="name"
											required
											defaultValue={player.name}
											className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
										/>
									</label>

									<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
										<span>メモ</span>
										<textarea
											name="note"
											rows={2}
											defaultValue={player.note ?? ""}
											className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
										/>
									</label>

									<div className="flex flex-wrap gap-3">
										<button
											type="submit"
											disabled={isSubmitting}
											className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
										>
											更新
										</button>
									</div>
								</Form>

								<Form method="post" className="mt-3 inline-flex">
									<input type="hidden" name="_intent" value="delete" />
									<input type="hidden" name="playerId" value={player.id} />
									<button
										type="submit"
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
						value={playersJson}
					/>
					<a
						className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
						download={`players-${loaderData.eventId}.json`}
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
								onChange={(event) => setImportPayload(event.target.value)}
								placeholder={`[
  { "name": "Player A" },
  { "id": "custom-id", "name": "Player B", "note": "Ace" }
]`}
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
						※ 空行や無効なエントリはスキップされ、既存プレイヤーは上書きされます。
					</p>
				</div>
			</section>
		</div>
	);
}

export function ErrorBoundary() {
	const error = useRouteError();
	console.error("Players route error:", error);

	const isRouteError = isRouteErrorResponse(error);
	const errorMessage =
		error instanceof Error
			? error.message
			: isRouteError
				? error.statusText || "不明なエラー"
				: "不明なエラー";
	const errorDetails =
		error instanceof Error && error.stack
			? error.stack
			: isRouteError
				? `Status: ${error.status}`
				: String(error);

	// 開発環境またはプレビュー環境では詳細を表示
	// サーバーサイドとクライアントサイドの両方で動作するように判定を改善
	// プレビュー環境（develop.exvs-tournaments.pages.devなど）では常に詳細を表示
	const isDevelopment =
		(typeof window !== "undefined" &&
			window.location &&
			(window.location.hostname === "localhost" ||
				window.location.hostname.includes("127.0.0.1") ||
				window.location.hostname.includes("dev") ||
				window.location.hostname.includes("preview") ||
				window.location.hostname.includes("pages.dev"))) ||
		(typeof process !== "undefined" &&
			(process.env.NODE_ENV === "development" ||
				process.env.ENVIRONMENT_STAGE === "preview"));

	return (
		<div className="mx-auto max-w-2xl px-6 py-12">
			<div className="text-center">
				<h1 className="text-2xl font-semibold text-rose-600">エラーが発生しました</h1>
				<p className="mt-4 text-sm text-slate-600">
					プレイヤー管理の読み込み中に問題が発生しました。管理トップへ戻ってから再度お試しください。
				</p>
				{isDevelopment && (
					<div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-left">
						<p className="text-sm font-semibold text-rose-800">エラー詳細:</p>
						<p className="mt-2 text-xs text-rose-700">{errorMessage}</p>
						{errorDetails && (
							<details className="mt-2">
								<summary className="cursor-pointer text-xs text-rose-600">
									スタックトレースを表示
								</summary>
								<pre className="mt-2 overflow-auto rounded bg-rose-100 p-2 text-xs text-rose-800">
									{errorDetails}
								</pre>
							</details>
						)}
					</div>
				)}
				<div className="mt-6">
					<Link
						to="/admin"
						className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
					>
						管理トップへ戻る
					</Link>
				</div>
			</div>
		</div>
	);
}
