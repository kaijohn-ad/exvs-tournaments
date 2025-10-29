import { useEffect, useMemo, useState } from "react";
import {
	Form,
	Link,
	Outlet,
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
import { generateAndStoreSingleEliminationBracket } from "~/repositories/bracket-generator";

type LoaderData = {
	eventId: string;
	tournaments: TournamentRecord[];
	tournamentsJson: string;
};

type ActionData =
	| {
			type: "success";
			source: "create" | "update" | "delete" | "import" | "generate" | "editor";
			message: string;
			tournaments: TournamentRecord[];
			tournamentsJson: string;
			tournament?: TournamentRecord;
			tournamentId?: string;
	  }
	| {
			type: "error";
			source: "create" | "update" | "delete" | "import" | "generate" | "editor";
			message: string;
			tournaments?: TournamentRecord[];
			tournamentsJson?: string;
			tournamentId?: string;
	  };

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) {
		return undefined;
	}

	const text = String(value).trim();

	return text.length > 0 ? text : undefined;
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw new Response("Event ID is required", { status: 400 });
	}

	const db = getDatabase(context);
	const tournaments = await db.tournaments.listTournaments(eventId);
	const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

	return json<LoaderData>({
		eventId,
		tournaments: sortedTournaments,
		tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
	});
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw new Response("Event ID is required", { status: 400 });
	}

	const formData = await request.formData();
	const intent = formData.get("_intent");

	const db = getDatabase(context);

	if (intent === "create") {
		const name = normalizeText(formData.get("name"));
		const format = normalizeText(formData.get("format")) as 'single-elimination' | undefined;
		const seedingMode = normalizeText(formData.get("seedingMode")) as 'random' | 'manual' | undefined;

		if (!name) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "create",
					message: "トーナメント名は必須です。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		try {
			const tournament = await db.tournaments.createTournament(eventId, { name, format, seedingMode });
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

			return json<ActionData>({
				type: "success",
				source: "create",
				message: `トーナメント「${tournament.name}」を作成しました。`,
				tournament,
				tournaments: sortedTournaments,
				tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
			});
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "create",
					message: error instanceof Error ? error.message : "トーナメントの作成に失敗しました。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}
	}

	if (intent === "update") {
		const tournamentId = normalizeText(formData.get("tournamentId"));
		const name = normalizeText(formData.get("name"));
		const format = normalizeText(formData.get("format")) as 'single-elimination' | undefined;
		const seedingMode = normalizeText(formData.get("seedingMode")) as 'random' | 'manual' | undefined;

		if (!tournamentId) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "update",
					message: "tournamentId が指定されていません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		if (!name) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "update",
					message: "トーナメント名は必須です。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		try {
			const tournament = await db.tournaments.updateTournament(eventId, tournamentId, { name, format, seedingMode });
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

			return json<ActionData>({
				type: "success",
				source: "update",
				message: `トーナメント「${tournament.name}」を更新しました。`,
				tournament,
				tournaments: sortedTournaments,
				tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
			});
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "update",
					message: "指定したトーナメントが見つかりません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 404 }
			);
		}
	}

	if (intent === "delete") {
		const tournamentId = normalizeText(formData.get("tournamentId"));

		if (!tournamentId) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "delete",
					message: "tournamentId が指定されていません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		try {
			await db.tournaments.deleteTournament(eventId, tournamentId);
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "delete",
					message: "指定したトーナメントが見つかりません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 404 }
			);
		}

		const tournaments = await db.tournaments.listTournaments(eventId);
		const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

		return json<ActionData>({
			type: "success",
			source: "delete",
			message: "トーナメントを削除しました。",
			tournaments: sortedTournaments,
			tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
		});
	}

	if (intent === "import") {
		const rawPayload = formData.get("payload");
		const payload = typeof rawPayload === 'string' ? rawPayload.trim() : '';
		const mode = normalizeText(formData.get("mode")) ?? 'import';

		if (!payload) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: mode as any,
					message: "JSONデータが入力されていません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(payload);
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: mode as any,
					message: "JSONの解析に失敗しました。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		if (!Array.isArray(parsed)) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: mode as any,
					message: "配列形式のJSONを指定してください。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		const sanitized = parsed
			.map((entry) => {
				if (typeof entry !== 'object' || entry === null) return null;
				const maybeId = Reflect.get(entry, 'id');
				const maybeName = Reflect.get(entry, 'name');
				const maybeFormat = Reflect.get(entry, 'format');
				const maybeSeedingMode = Reflect.get(entry, 'seedingMode');

				if (typeof maybeName !== 'string') {
					return null;
				}

				return {
					id: typeof maybeId === 'string' ? maybeId : undefined,
					name: maybeName,
					format: typeof maybeFormat === 'string' ? maybeFormat as 'single-elimination' : undefined,
					seedingMode: typeof maybeSeedingMode === 'string' ? maybeSeedingMode as 'random' | 'manual' : undefined
				};
			})
			.filter(Boolean);

		try {
			const imported = await db.tournaments.setTournaments(eventId, sanitized as any);
			const tournamentsJson = JSON.stringify(imported, null, 2);
			const message =
				mode === 'editor'
					? `JSONエディタから${imported.length}件のトーナメントを保存しました。`
					: `${imported.length}件のトーナメントを取り込みました。`;

			return json<ActionData>({
				type: "success",
				source: mode as any,
				message,
				tournamentsJson,
				tournaments: imported
			});
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: mode as any,
					message: error instanceof Error ? error.message : "インポートに失敗しました。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}
	}

	if (intent === "generate") {
		const tournamentId = normalizeText(formData.get("tournamentId"));
		const seedingOverride = normalizeText(formData.get("seedingMode")) as 'random' | 'manual' | undefined;

		if (!tournamentId) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "generate",
					message: "tournamentId が指定されていません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
				},
				{ status: 400 }
			);
		}

		let tournament: TournamentRecord;
		try {
			tournament = await db.tournaments.ensureTournament(eventId, tournamentId);
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "generate",
					message: "指定したトーナメントが見つかりません。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
					tournamentId
				},
				{ status: 404 }
			);
		}

		const pairs = await db.pairs.listPairs(eventId);
		if (pairs.length < 2) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "generate",
					message: "ブラケットを生成するには、少なくとも2組のペアが必要です。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
					tournamentId
				},
				{ status: 400 }
			);
		}

		const seedingMode = seedingOverride ?? tournament.seedingMode ?? 'random';
		if (tournament.format && tournament.format !== 'single-elimination') {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "generate",
					message: "ブラケット生成はシングルエリミネーション形式でのみ利用できます。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
					tournamentId
				},
				{ status: 400 }
			);
		}

		try {
			await generateAndStoreSingleEliminationBracket({
				tournamentId,
				pairs,
				seedingMode,
				setMatches: (targetTournamentId, matches) =>
					db.bracketMatches.setBracketMatches(targetTournamentId, matches)
			});

			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			const tournamentsJson = JSON.stringify(sortedTournaments, null, 2);

			return json<ActionData>({
				type: "success",
				source: "generate",
				message: `トーナメント「${tournament.name}」のブラケットを生成しました。`,
				tournaments: sortedTournaments,
				tournamentsJson,
				tournamentId
			});
		} catch (error) {
			const tournaments = await db.tournaments.listTournaments(eventId);
			const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return json<ActionData>(
				{
					type: "error",
					source: "generate",
					message: error instanceof Error ? error.message : "ブラケット生成に失敗しました。",
					tournaments: sortedTournaments,
					tournamentsJson: JSON.stringify(sortedTournaments, null, 2),
					tournamentId
				},
				{ status: 400 }
			);
		}
	}

	return json<ActionData | null>(null);
}

function FlashMessage({ action }: { action: ActionData | undefined }) {
	if (!action) return null;

	const isError = action.type === "error";
	const isSuccess = action.type === "success";

	if (!isError && !isSuccess) return null;

	return (
		<div
			className={`rounded-lg p-4 mb-4 ${
				isError
					? "bg-red-50 border border-red-200 text-red-800"
					: "bg-green-50 border border-green-200 text-green-800"
			}`}
		>
			{action.message}
		</div>
	);
}

export default function TournamentsRoute() {
	const { eventId, tournaments: initialTournaments, tournamentsJson: initialTournamentsJson } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();

	const [importPayload, setImportPayload] = useState("");
	const [editorMode, setEditorMode] = useState(false);
	const [editorPayload, setEditorPayload] = useState(initialTournamentsJson);
	const [editorError, setEditorError] = useState<string | null>(null);
	const [generatingTournamentId, setGeneratingTournamentId] = useState<string | null>(null);

	const tournaments = useMemo(() => {
		if (actionData?.tournaments) {
			return actionData.tournaments;
		}
		return initialTournaments || [];
	}, [actionData, initialTournaments]);

	const tournamentsJson = useMemo(() => {
		if (actionData?.tournamentsJson) {
			return actionData.tournamentsJson;
		}
		return initialTournamentsJson || "";
	}, [actionData, initialTournamentsJson]);

	const isSubmitting = navigation.state === "submitting";

	const importExample = JSON.stringify(
		[
			{ name: 'Spring Tournament', format: 'single-elimination', seedingMode: 'random' },
			{ id: 'custom-id', name: 'Summer Championship', seedingMode: 'manual' }
		],
		null,
		2
	);

	const resetEditor = () => {
		setEditorPayload(tournamentsJson);
		setEditorError(null);
	};

	const validateEditorPayload = () => {
		try {
			setEditorError(null);
			JSON.parse(editorPayload);
		} catch (error) {
			setEditorError('JSONの形式が正しくありません。');
		}
	};

	useEffect(() => {
		if (actionData?.source === 'generate') {
			setGeneratingTournamentId(null);
		}
	}, [actionData]);

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">トーナメント設定</h1>
					<p className="mt-2 text-sm text-slate-600">
						イベントID: <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono">{eventId}</code>
					</p>
				</div>
				<Link
					to={`/admin/events/${eventId}`}
					className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
				>
					← イベント詳細に戻る
				</Link>
			</header>

			{/* トーナメント作成フォーム */}
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<h2 className="text-xl font-semibold text-slate-900 mb-6">トーナメントを作成</h2>
				<FlashMessage action={actionData?.source === 'create' ? actionData : undefined} />
				<Form method="post" className="space-y-4">
					<input type="hidden" name="_intent" value="create" />
					<div>
						<label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
							トーナメント名 <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							id="name"
							name="name"
							required
							placeholder="例: 春季大会"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label htmlFor="format" className="block text-sm font-medium text-slate-700 mb-2">
							形式
						</label>
						<select
							id="format"
							name="format"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						>
							<option value="single-elimination">シングルエリミネーション</option>
						</select>
					</div>

					<div>
						<label htmlFor="seedingMode" className="block text-sm font-medium text-slate-700 mb-2">
							シード方式
						</label>
						<select
							id="seedingMode"
							name="seedingMode"
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						>
							<option value="random">ランダム</option>
							<option value="manual">手動</option>
						</select>
					</div>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={isSubmitting}
							className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
						>
							{isSubmitting ? "作成中..." : "作成"}
						</button>
					</div>
				</Form>
			</section>

			{/* 登録済みトーナメント一覧 */}
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<h2 className="text-xl font-semibold text-slate-900 mb-6">
					登録済みトーナメント ({tournaments.length})
				</h2>
				<FlashMessage action={actionData && actionData.source !== 'create' && actionData.source !== 'editor' ? actionData : undefined} />

				{tournaments.length === 0 ? (
					<p className="text-sm text-slate-500">まだトーナメントが作成されていません。</p>
				) : (
					<div className="space-y-4">
						{tournaments.map((tournament) => (
							<div key={tournament.id} className="rounded-lg border border-slate-200 bg-slate-50 p-6">
								<Form method="post" className="space-y-4">
									<input type="hidden" name="_intent" value="update" />
									<input type="hidden" name="tournamentId" value={tournament.id} />

									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">
											トーナメント名
										</label>
										<input
											type="text"
											name="name"
											defaultValue={tournament.name}
											required
											className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										/>
									</div>

									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">
											形式
										</label>
										<select
											name="format"
											defaultValue={tournament.format}
											className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										>
											<option value="single-elimination">シングルエリミネーション</option>
										</select>
									</div>

									<div>
										<label className="block text-sm font-medium text-slate-700 mb-2">
											シード方式
										</label>
										<select
											name="seedingMode"
											defaultValue={tournament.seedingMode}
											className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
										>
											<option value="random">ランダム</option>
											<option value="manual">手動</option>
										</select>
									</div>

									<div className="text-xs text-slate-500">
										作成日時: {new Date(tournament.createdAt).toLocaleString('ja-JP')}
									</div>

									<div className="flex justify-end">
										<button
											type="submit"
											disabled={isSubmitting}
											className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
										>
											{isSubmitting ? "更新中..." : "更新"}
										</button>
									</div>
								</Form>

								<div className="mt-4 flex flex-wrap gap-2">
									<Link
										to={`/admin/events/${eventId}/tournaments/${tournament.id}/bracket`}
										className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
									>
										ブラケットを見る
									</Link>

									<Form method="post" className="inline">
										<input type="hidden" name="_intent" value="generate" />
										<input type="hidden" name="tournamentId" value={tournament.id} />
										<select
											name="seedingMode"
											defaultValue={tournament.seedingMode}
											className="mr-2 rounded border border-slate-300 px-2 py-1 text-xs"
										>
											<option value="random">ランダムで生成</option>
											<option value="manual">手動シードで生成</option>
										</select>
										<button
											type="submit"
											disabled={isSubmitting}
											className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
										>
											{isSubmitting ? '生成中…' : 'ブラケット生成'}
										</button>
									</Form>

									<Form method="post" className="inline">
										<input type="hidden" name="_intent" value="delete" />
										<input type="hidden" name="tournamentId" value={tournament.id} />
										<button
											type="submit"
											disabled={isSubmitting}
											onClick={(e) => {
												if (!confirm('削除しますか？')) {
													e.preventDefault();
												}
											}}
											className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
										>
											削除
										</button>
									</Form>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{/* インポート/エクスポート */}
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<h2 className="text-xl font-semibold text-slate-900 mb-6">インポート / エクスポート</h2>
				
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* エクスポート */}
					<div>
						<h3 className="text-lg font-medium text-slate-900 mb-4">エクスポート</h3>
						<textarea
							readOnly
							rows={8}
							value={tournamentsJson}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
						<a
							href={`data:application/json;charset=utf-8,${encodeURIComponent(tournamentsJson)}`}
							download={`tournaments-${eventId}.json`}
							className="mt-2 inline-flex items-center rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
						>
							JSONをダウンロード
						</a>
					</div>

					{/* インポート */}
					<div>
						<h3 className="text-lg font-medium text-slate-900 mb-4">インポート</h3>
						<FlashMessage action={actionData?.source === 'import' ? actionData : undefined} />
						<Form method="post" className="space-y-4">
							<input type="hidden" name="_intent" value="import" />
							<div>
								<label className="block text-sm font-medium text-slate-700 mb-2">
									JSONデータ
								</label>
								<textarea
									name="payload"
									rows={8}
									value={importPayload}
									onChange={(e) => setImportPayload(e.target.value)}
									placeholder={importExample}
									className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								/>
							</div>
							<div className="flex justify-end">
								<button
									type="submit"
									disabled={isSubmitting}
									className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
								>
									{isSubmitting ? "取り込み中..." : "取り込み"}
								</button>
							</div>
						</Form>
						<p className="mt-2 text-xs text-slate-500">
							※ 空行や無効なエントリはスキップされます。既存トーナメントは上書きされます。
						</p>
					</div>
				</div>
			</section>

			{/* JSONエディタ */}
			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="text-xl font-semibold text-slate-900">JSONエディタで編集</h2>
						<p className="text-sm text-slate-600">直接JSONを編集し、上書き保存できます。</p>
					</div>
					<button
						type="button"
						onClick={() => {
							setEditorMode(!editorMode);
							if (!editorMode) {
								resetEditor();
							}
						}}
						className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
							editorMode
								? "bg-blue-100 text-blue-700"
								: "bg-slate-100 text-slate-700 hover:bg-slate-200"
						}`}
					>
						{editorMode ? '閉じる' : 'JSONエディタを開く'}
					</button>
				</div>

				{editorMode && (
					<>
						<FlashMessage action={actionData?.source === 'editor' ? actionData : undefined} />

						<div className={`space-y-4 ${editorError ? 'border-red-300' : ''}`}>
							<textarea
								rows={14}
								value={editorPayload}
								onChange={(e) => {
									setEditorPayload(e.target.value);
									validateEditorPayload();
								}}
								className={`w-full rounded-lg border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 ${
									editorError
										? "border-red-300 focus:border-red-500 focus:ring-red-500"
										: "border-slate-300 focus:border-blue-500 focus:ring-blue-500"
								}`}
							/>
							{editorError && (
								<p className="text-sm text-red-600">⚠️ {editorError}</p>
							)}
						</div>

						<Form method="post" className="mt-4">
							<input type="hidden" name="_intent" value="import" />
							<input type="hidden" name="mode" value="editor" />
							<input type="hidden" name="payload" value={editorPayload} />
							<div className="flex justify-end gap-2">
								<button
									type="button"
									onClick={resetEditor}
									className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
								>
									元に戻す
								</button>
								<button
									type="submit"
									disabled={isSubmitting || Boolean(editorError)}
									className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
								>
									{isSubmitting ? "保存中..." : "JSONを保存"}
								</button>
							</div>
						</Form>
					</>
				)}
			</section>

			{/* 子ルートのコンテンツを表示 */}
			<Outlet />
		</div>
	);
}
