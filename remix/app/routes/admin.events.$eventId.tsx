import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { NavLink, Outlet, useLoaderData } from "@remix-run/react";
import { getDatabase } from "~/repositories/database.server";

type LoaderData = {
	eventId: string;
	event: {
		id: string;
		name: string;
		slug: string | null;
		createdAt: string;
	};
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw new Response("Event ID is required", { status: 400 });
	}

	const db = getDatabase(context);

	try {
		const event = await db.events.ensureEvent(eventId);
		return json<LoaderData>({
			eventId,
			event: {
				id: event.id,
				name: event.name,
				slug: event.slug,
				createdAt: event.createdAt,
			},
		});
	} catch (error) {
		console.error("[admin.events.$eventId:load] event not found", {
			eventId,
			error: error instanceof Error ? error.message : error,
		});
		throw new Response("指定したイベントが見つかりません。", { status: 404 });
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: `${data?.event.name || "イベント"} - 管理 | Boost Bracket` },
	{ name: "description", content: `${data?.event.name || "イベント"}の管理画面` },
];

export default function AdminEventLayout() {
	const { eventId, event } = useLoaderData<typeof loader>();

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
			<header className="flex items-center justify-between">
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-bold text-slate-900">{event.name}</h1>
					<p className="text-sm text-slate-600">
						イベントID: <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono">{eventId}</code>
					</p>
				</div>
				<NavLink
					to="/admin"
					className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
				>
					← 管理トップに戻る
				</NavLink>
			</header>

			<nav className="flex gap-2 border-b border-slate-200">
				<NavLink
					to={`/admin/events/${eventId}/participants`}
					className={({ isActive }) =>
						`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
							isActive
								? "border-blue-600 text-blue-600"
								: "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
						}`
					}
				>
					参加者
				</NavLink>
				<NavLink
					to={`/admin/events/${eventId}/schedule`}
					className={({ isActive }) =>
						`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
							isActive
								? "border-blue-600 text-blue-600"
								: "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
						}`
					}
				>
					スケジュール
				</NavLink>
				<NavLink
					to={`/admin/events/${eventId}/results`}
					className={({ isActive }) =>
						`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
							isActive
								? "border-blue-600 text-blue-600"
								: "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
						}`
					}
				>
					結果
				</NavLink>
				<NavLink
					to={`/admin/events/${eventId}/tournaments`}
					className={({ isActive }) =>
						`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
							isActive
								? "border-blue-600 text-blue-600"
								: "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
						}`
					}
				>
					トーナメント
				</NavLink>
			</nav>

			<Outlet />
		</div>
	);
}

