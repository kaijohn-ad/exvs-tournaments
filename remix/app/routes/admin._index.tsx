import { useEffect, useMemo, useState } from "react";
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigate,
	useNavigation,
} from "@remix-run/react";
import {
	json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { getDatabase } from "~/repositories/database.server";
import type { EventRecord } from "~/repositories/events";

type LoaderData = {
	events: EventRecord[];
};

type ActionData =
	| {
			type: "success";
			source: "createEvent";
			message: string;
			createdEventId: string;
			events: EventRecord[];
	  }
	| {
			type: "error";
			source: "createEvent";
			message: string;
			events: EventRecord[];
	  };

const normalizeText = (value: FormDataEntryValue | null): string | undefined => {
	if (value == null) return undefined;
	const text = String(value).trim();
	return text.length > 0 ? text : undefined;
};

export async function loader({ context }: LoaderFunctionArgs) {
	const db = getDatabase(context);
	const events = await db.events.listEvents();

	return json<LoaderData>({
		events,
	});
}

export async function action({ request, context }: ActionFunctionArgs) {
	const formData = await request.formData();
	const intent = formData.get("_intent");

	if (intent !== "create-event") {
		return json<ActionData | null>(null);
	}

	const name = normalizeText(formData.get("name"));
	const slug = normalizeText(formData.get("slug"));

	const db = getDatabase(context);

	if (!name) {
		const events = await db.events.listEvents();
		return json<ActionData>(
			{
				type: "error",
				source: "createEvent",
				message: "イベント名を入力してください。",
				events,
			},
			{ status: 400 },
		);
	}

	try {
		const created = await db.events.createEvent({ name, slug });
		const events = await db.events.listEvents();

		return json<ActionData>({
			type: "success",
			source: "createEvent",
			message: `イベント「${created.name}」を作成しました。`,
			events,
			createdEventId: created.id,
		});
	} catch (error) {
		const events = await db.events.listEvents();
		return json<ActionData>(
			{
				type: "error",
				source: "createEvent",
				message:
					error instanceof Error
						? error.message
						: "イベントの作成に失敗しました。",
				events,
			},
			{ status: 400 },
		);
	}
}

export default function AdminIndex() {
	const { events: initialEvents } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const navigation = useNavigation();
	const navigate = useNavigate();

	const [selectedEventId, setSelectedEventId] = useState<string>("");

	const events = useMemo<EventRecord[]>(() => {
		if (actionData?.events) {
			return actionData.events;
		}
		return initialEvents || [];
	}, [actionData, initialEvents]);

	useEffect(() => {
		if (
			actionData?.type === "success" &&
			actionData.source === "createEvent" &&
			actionData.createdEventId
		) {
			setSelectedEventId(actionData.createdEventId);
			return;
		}

		if (events.length > 0) {
			setSelectedEventId(events[0].id);
		}
	}, [actionData, events]);

	const isSubmitting = navigation.state === "submitting";

	const goTo = (path: string) => {
		const trimmed = selectedEventId.trim();
		if (!trimmed) return;
		navigate(path.replace(":eventId", trimmed));
	};

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-10">
			<header className="space-y-3">
				<h1 className="text-3xl font-semibold text-slate-900">
					Boost Bracket 管理トップ
				</h1>
				<p className="text-slate-600">
					大会単位でエントリー管理・トーナメント運営を行います。イベントを選択するか、
					新しく作成して管理をはじめましょう。
				</p>
			</header>

			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<h2 className="text-xl font-semibold text-slate-900">イベントを選択</h2>
				<div className="mt-6 space-y-6">
					<label className="block text-sm font-medium text-slate-700">
						イベント一覧
						<select
							className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
							value={selectedEventId}
							onChange={(event) => setSelectedEventId(event.target.value)}
						>
							<option value="">-- イベントを選択 --</option>
							{events.map((event) => (
								<option key={event.id} value={event.id}>
									{event.name} ({event.id})
								</option>
							))}
						</select>
					</label>

					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							onClick={() =>
								goTo("/admin/events/:eventId/entries/players")
							}
							disabled={!selectedEventId}
							className="rounded-lg border border-blue-500 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
						>
							プレイヤー管理へ
						</button>
						<button
							type="button"
							onClick={() => goTo("/admin/events/:eventId/entries/pairs")}
							disabled={!selectedEventId}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
						>
							ペア管理へ
						</button>
						<button
							type="button"
							onClick={() => goTo("/admin/events/:eventId/entries/teams")}
							disabled={!selectedEventId}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
						>
							チーム管理へ
						</button>
						<button
							type="button"
							onClick={() => goTo("/admin/events/:eventId/team-battles")}
							disabled={!selectedEventId}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
						>
							団体戦管理へ
						</button>
						<button
							type="button"
							onClick={() => goTo("/admin/events/:eventId/matches")}
							disabled={!selectedEventId}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
						>
							試合ログへ
						</button>
						<button
							type="button"
							onClick={() => goTo("/admin/events/:eventId/stats")}
							disabled={!selectedEventId}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
						>
							統計表示へ
						</button>
						<button
							type="button"
							onClick={() => goTo("/admin/events/:eventId/tournaments")}
							disabled={!selectedEventId}
							className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
						>
							トーナメント設定へ
						</button>
					</div>

					{actionData?.source === "createEvent" ? (
						<div
							className={`rounded-lg border px-4 py-3 text-sm ${
								actionData.type === "success"
									? "border-emerald-300 bg-emerald-50 text-emerald-700"
									: "border-rose-300 bg-rose-50 text-rose-700"
							}`}
						>
							{actionData.message}
						</div>
					) : null}
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<h2 className="text-xl font-semibold text-slate-900">
					新しいイベントを作成
				</h2>
				<Form
					method="post"
					className="mt-6 grid gap-4"
					replace
				>
					<input type="hidden" name="_intent" value="create-event" />
					<div className="grid gap-4 md:grid-cols-2">
						<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
							<span>イベント名 *</span>
							<input
								name="name"
								required
								className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
								placeholder="例: ガンダム駅前大会 2025"
							/>
						</label>
						<label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
							<span>スラッグ (任意)</span>
							<input
								name="slug"
								className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
								placeholder="半角英数・ハイフン"
							/>
						</label>
					</div>
					<button
						type="submit"
						disabled={isSubmitting}
						className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
					>
						{isSubmitting ? "作成中..." : "イベントを作成"}
					</button>
				</Form>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-semibold text-slate-900">
						登録済みイベント
					</h2>
					<Link
						to="/"
						className="text-sm font-medium text-blue-600 transition hover:text-blue-500"
					>
						トップへ戻る
					</Link>
				</div>
				{events.length === 0 ? (
					<p className="mt-6 text-sm text-slate-500">
						まだイベントが登録されていません。
					</p>
				) : (
					<div className="mt-6 overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50">
								<tr>
									<th className="px-4 py-2 text-left font-semibold text-slate-600">
										ID
									</th>
									<th className="px-4 py-2 text-left font-semibold text-slate-600">
										イベント名
									</th>
									<th className="px-4 py-2 text-left font-semibold text-slate-600">
										Slug
									</th>
									<th className="px-4 py-2 text-left font-semibold text-slate-600">
										作成日
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200">
								{events.map((event) => (
									<tr key={event.id} className="hover:bg-slate-50">
										<td className="px-4 py-2 font-mono text-xs text-slate-600">
											{event.id}
										</td>
										<td className="px-4 py-2 text-slate-700">{event.name}</td>
										<td className="px-4 py-2 text-slate-500">
											{event.slug ?? "-"}
										</td>
										<td className="px-4 py-2 text-slate-500">
											{new Date(event.createdAt).toLocaleString("ja-JP")}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
}
