import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { getDatabase } from "~/repositories/database.server";
import type { TournamentRecord } from "~/repositories/tournaments";

type LoaderData = {
	eventId: string;
	eventName: string;
	tournaments: TournamentRecord[];
};

function buildTournamentUrl(eventId: string, tournamentId: string): string {
	return `/events/${eventId}/tournaments/${tournamentId}/bracket`;
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString('ja-JP', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const slug = params.slug;

	if (!slug) {
		throw new Response("Slug is required", { status: 400 });
	}

	const db = getDatabase(context);

	try {
		const event = await db.events.findEventBySlug(slug);

		if (!event) {
			throw new Response("指定したイベントが見つかりません。", { status: 404 });
		}

		const tournaments = await db.tournaments.listTournaments(event.id);
		const sortedTournaments = [...tournaments].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

		return json<LoaderData>({
			eventId: event.id,
			eventName: event.name,
			tournaments: sortedTournaments,
		});
	} catch (error) {
		console.error("[view.$slug:load] failed", {
			slug,
			error: error instanceof Error ? error.message : error,
		});
		if (error instanceof Response) {
			throw error;
		}
		throw new Response("指定したイベントが見つかりません。", { status: 404 });
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: `${data?.eventName || "イベント"} | Boost Bracket` },
	{ name: "description", content: `${data?.eventName || "イベント"}のトーナメント一覧` },
];

export default function ViewSlug() {
	const { eventId, eventName, tournaments } = useLoaderData<typeof loader>();

	return (
		<div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-50 text-slate-900">
			<section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
				<header className="flex flex-col gap-2">
					<h1 className="text-3xl font-bold text-slate-900">{eventName}</h1>
				</header>

				<section className="bg-white rounded-2xl p-7 shadow-lg border border-slate-200">
					<h2 className="text-xl font-semibold text-slate-900 mb-5">トーナメント一覧</h2>
					{tournaments.length === 0 ? (
						<p className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm">
							トーナメントがまだ登録されていません。
						</p>
					) : (
						<ul className="grid gap-3">
							{tournaments.map((tournament) => (
								<li key={tournament.id}>
									<Link
										to={buildTournamentUrl(eventId, tournament.id)}
										className="flex justify-between items-center gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 text-slate-900 no-underline transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-400"
									>
										<span className="font-semibold text-base">
											{tournament.name}
										</span>
										<span className="text-sm text-blue-700 font-semibold whitespace-nowrap">
											{formatDate(tournament.createdAt)}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			</section>
		</div>
	);
}

export function ErrorBoundary() {
	const error = useRouteError();
	const is404 = isRouteErrorResponse(error) && error.status === 404;

	return (
		<div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-50 text-slate-900">
			<section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
				<div className="bg-white rounded-2xl p-7 shadow-lg border border-slate-200 text-center">
					<h1 className="text-3xl font-bold text-slate-900 mb-4">
						{is404 ? "イベントが見つかりません" : "エラーが発生しました"}
					</h1>
					<p className="text-slate-600 mb-6">
						{is404
							? "指定されたスラッグのイベントは存在しません。URLを確認して再度お試しください。"
							: "イベントの読み込み中に問題が発生しました。しばらく時間をおいてから再度お試しください。"}
					</p>
					<div className="flex gap-4 justify-center">
						<Link
							to="/events"
							className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
						>
							イベント一覧へ戻る
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
