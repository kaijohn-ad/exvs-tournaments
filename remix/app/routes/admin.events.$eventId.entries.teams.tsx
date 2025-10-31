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
import type { TeamImportData, TeamRecord } from "~/repositories/teams";

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) return undefined;
	const text = String(value).trim();
	return text.length > 0 ? text : undefined;
};

const sortTeams = (teams: TeamRecord[]) =>
	[...teams].sort((a, b) => a.name.localeCompare(b.name, "ja"));

type LoaderData = {
	eventId: string;
	teams: TeamRecord[];
	teamsJson: string;
};

type MutationSource = "create" | "update" | "delete" | "import" | "editor";

type ActionSuccess = {
	type: "success";
	source: MutationSource;
	message: string;
	team?: TeamRecord;
	teams: TeamRecord[];
	teamsJson: string;
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

	const db = getDatabase(context);
	const teams = await db.teams.listTeams(eventId);
	const sortedTeams = sortTeams(teams);

	return json<LoaderData>({
		eventId,
		teams: sortedTeams,
		teamsJson: JSON.stringify(sortedTeams, null, 2),
	});
}

async function fetchTeams(context: AppLoadContext, eventId: string) {
	const db = getDatabase(context);
	const teams = await db.teams.listTeams(eventId);
	const sortedTeams = sortTeams(teams);

	return {
		teams: sortedTeams,
		teamsJson: JSON.stringify(sortedTeams, null, 2),
	};
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

				if (!name) {
					return json<ActionError>(
						{
							type: "error",
							source: "create",
							message: "チーム名は必須です。",
						},
						{ status: 400 },
					);
				}

				const team = await db.teams.createTeam(eventId, { name });
				const { teams, teamsJson } = await fetchTeams(context, eventId);

				return json<ActionSuccess>({
					type: "success",
					source: "create",
					message: `チーム「${team.name}」を追加しました。`,
					team,
					teams,
					teamsJson,
				});
			}

			case "update": {
				const teamId = normalizeText(formData.get("teamId"));
				const name = normalizeText(formData.get("name"));

				if (!teamId) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "teamId が指定されていません。",
						},
						{ status: 400 },
					);
				}

				if (!name) {
					return json<ActionError>(
						{
							type: "error",
							source: "update",
							message: "チーム名は必須です。",
						},
						{ status: 400 },
					);
				}

				const team = await db.teams.updateTeam(eventId, teamId, { name });
				const { teams, teamsJson } = await fetchTeams(context, eventId);

				return json<ActionSuccess>({
					type: "success",
					source: "update",
					message: `チーム「${team.name}」を更新しました。`,
					team,
					teams,
					teamsJson,
				});
			}

			case "delete": {
				const teamId = normalizeText(formData.get("teamId"));

				if (!teamId) {
					return json<ActionError>(
						{
							type: "error",
							source: "delete",
							message: "teamId が指定されていません。",
						},
						{ status: 400 },
					);
				}

				await db.teams.deleteTeam(eventId, teamId);
				const { teams, teamsJson } = await fetchTeams(context, eventId);

				return json<ActionSuccess>({
					type: "success",
					source: "delete",
					message: "チームを削除しました。",
					teams,
					teamsJson,
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

				const sanitized: TeamImportData[] = [];
				for (const entry of parsed) {
					if (typeof entry !== "object" || entry === null) {
						continue;
					}

					const id = Reflect.get(entry, "id");
					const name = Reflect.get(entry, "name");

					if (typeof name !== "string" || !name.trim()) {
						continue;
					}

					sanitized.push({
						id: typeof id === "string" ? id : undefined,
						name,
					});
				}

				const imported = await db.teams.setTeams(eventId, sanitized);
				const teamsJson = JSON.stringify(imported, null, 2);

				return json<ActionSuccess>({
					type: "success",
					source: mode,
					message:
						mode === "editor"
							? `JSONエディタから${imported.length}件のチームを保存しました。`
							: `${imported.length}件のチームを取り込みました。`,
					teams: imported,
					teamsJson,
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
		console.error("teams action failed", error);
		return json<ActionError>(
			{
				type: "error",
				source: intent ?? "create",
				message: "処理中にエラーが発生しました。",
			},
			{ status: 500 },
		);
	}
}

function useTeamsState(loaderData: LoaderData, actionData: ActionData | undefined) {
	return useMemo(() => {
		const teams =
			actionData && "teams" in actionData ? actionData.teams : loaderData.teams;
		const teamsJson =
			actionData && "teamsJson" in actionData
				? actionData.teamsJson
				: loaderData.teamsJson;

		return { teams, teamsJson };
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

export default function TeamsRoute() {
	const loaderData = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();

	const { teams, teamsJson } = useTeamsState(loaderData, actionData ?? undefined);

	const [importPayload, setImportPayload] = useState<string>("");
	const [editorOpen, setEditorOpen] = useState(false);
	const [editorPayload, setEditorPayload] = useState(teamsJson);
	const [editorError, setEditorError] = useState<string | null>(null);
	const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

	useEffect(() => {
		// SSR時は実行しない（クライアント側でのみ実行）
		if (typeof window === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") {
			return;
		}

		try {
			const blob = new Blob([teamsJson], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			setDownloadUrl(url);
			return () => {
				URL.revokeObjectURL(url);
			};
		} catch (error) {
			// Blob作成に失敗した場合は何もしない（SSR環境など）
			console.warn("Failed to create blob URL:", error);
		}
	}, [teamsJson]);

	useEffect(() => {
		if (actionData?.type === "error") {
			if (actionData.source === "import") {
				setImportPayload(actionData.payload ?? "");
			} else if (actionData.source === "editor") {
				setEditorPayload(actionData.payload ?? loaderData.teamsJson);
			}
		} else if (actionData?.type === "success") {
			if (actionData.source === "import") {
				setImportPayload("");
			}
			if (actionData.source === "editor") {
				setEditorOpen(false);
				setEditorPayload(actionData.teamsJson);
				setEditorError(null);
			}
		}
	}, [actionData, loaderData.teamsJson]);

	useEffect(() => {
		if (!editorOpen) {
			setEditorPayload(teamsJson);
			setEditorError(null);
		}
	}, [editorOpen, teamsJson]);

	const isSubmitting = navigation.state === "submitting";

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			<header className="space-y-2">
				<h1 className="text-2xl font-semibold text-slate-900">チーム管理</h1>
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
				<h2 className="text-lg font-semibold text-slate-900">チームを追加</h2>
				{actionData?.source === "create" ? (
					<div className="mt-4">
						<FlashMessage action={actionData} />
					</div>
				) : null}
				<Form method="post" className="mt-4 grid gap-4">
					<input type="hidden" name="_intent" value="create" />
					<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
						<span>
							チーム名 <span className="text-rose-500">*</span>
						</span>
						<input
							name="name"
							type="text"
							required
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
						登録済みチーム ({teams.length})
					</h2>
					{actionData &&
					actionData.source !== "create" &&
					actionData.source !== "import" &&
					actionData.source !== "editor" ? (
						<FlashMessage action={actionData} />
					) : null}
				</div>

				{teams.length === 0 ? (
					<p className="mt-4 text-sm text-slate-500">
						まだチームが登録されていません。
					</p>
				) : (
					<ul className="mt-4 space-y-4">
						{teams.map((team) => (
							<li key={team.id} className="rounded-xl border border-slate-200 p-4">
								<Form method="post" className="grid gap-4">
									<input type="hidden" name="_intent" value="update" />
									<input type="hidden" name="teamId" value={team.id} />

									<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
										<span>チーム名</span>
										<input
											name="name"
											type="text"
											required
											defaultValue={team.name}
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
										<Form method="post">
											<input type="hidden" name="_intent" value="delete" />
											<input type="hidden" name="teamId" value={team.id} />
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
						value={teamsJson}
					/>
					<a
						className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
						download={`teams-${loaderData.eventId}.json`}
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
  { "name": "チームA" },
  { "id": "custom-id", "name": "チームB" }
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
						※ 空行や無効なエントリはスキップされ、既存チームは上書きされます。
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
									setEditorPayload(loaderData.teamsJson);
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
				チーム管理の読み込み中に問題が発生しました。管理トップへ戻ってから再度お試しください。
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
