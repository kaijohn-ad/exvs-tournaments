import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { getDatabase } from "~/repositories/database.server";
import type { EventRecord } from "~/repositories/events";
import type { TournamentRecord } from "~/repositories/tournaments";

export type EventSummary = EventRecord & {
	tournaments: TournamentRecord[];
};

type LoaderData = {
	events: EventSummary[];
};

export async function loader({ context }: LoaderFunctionArgs) {
	const db = getDatabase(context);

	const events = await db.events.listEvents();

	const summaries: EventSummary[] = await Promise.all(
		events.map(async (record) => {
			const tournaments = await db.tournaments.listTournaments(record.id);
			return {
				...record,
				tournaments,
			};
		})
	);

	return json<LoaderData>({
		events: summaries,
	});
}

export const meta: MetaFunction = () => [
	{ title: "公開イベント一覧 | Boost Bracket" },
	{ name: "description", content: "公開設定された大会イベントとトーナメントを閲覧できます。" },
];

const formatDate = (isoString: string | undefined) => {
	if (!isoString) {
		return "未定";
	}

	const date = new Date(isoString);
	if (Number.isNaN(date.getTime())) {
		return "未定";
	}

	return date.toLocaleDateString("ja-JP", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
};

const buildTournamentUrl = (eventId: string, tournamentId: string) =>
	`/events/${eventId}/tournaments/${tournamentId}/bracket`;

export default function EventsIndex() {
	const { events } = useLoaderData<typeof loader>();

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
			<section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-7 py-12">
				<header className="flex flex-col gap-3">
					<h1 className="text-3xl font-bold text-slate-900">公開イベント一覧</h1>
					<p className="text-slate-600 leading-relaxed">
						登録済みイベントのトーナメントを観覧できます。リンクを共有してライブ進行をチェックしましょう。
					</p>
				</header>

				{events.length === 0 ? (
					<p className="mx-auto py-10 text-center text-lg font-semibold text-blue-700 bg-blue-50 border border-dashed border-blue-200 rounded-2xl">
						まだ公開中のイベントはありません。
					</p>
				) : (
					<div className="grid gap-7 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
						{events.map((event) => (
							<article
								key={event.id}
								className="bg-white rounded-2xl p-7 shadow-lg border border-slate-200 flex flex-col gap-5"
							>
								<header className="flex flex-col gap-2">
									<h2 className="text-xl font-bold text-slate-900">{event.name}</h2>
									{event.slug && (
										<p className="text-sm text-slate-500 flex items-baseline gap-2">
											<span>共有URL:</span>
											<code className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-900">
												/view/{event.slug}
											</code>
										</p>
									)}
								</header>

								<dl className="grid gap-3">
									<div className="grid gap-1">
										<dt className="text-sm font-semibold text-slate-500">イベントID</dt>
										<dd className="text-base font-semibold text-slate-900">{event.id}</dd>
									</div>
									<div className="grid gap-1">
										<dt className="text-sm font-semibold text-slate-500">開催日</dt>
										<dd className="text-base font-semibold text-slate-900">
											{formatDate(event.createdAt)}
										</dd>
									</div>
								</dl>

								<section className="flex flex-col gap-3">
									<h3 className="text-lg font-semibold text-slate-900">トーナメント</h3>
									{event.tournaments.length === 0 ? (
										<p className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm">
											トーナメントがまだ登録されていません。
										</p>
									) : (
										<ul className="grid gap-3">
											{event.tournaments.map((tournament) => (
												<li key={tournament.id}>
													<a
														href={buildTournamentUrl(event.id, tournament.id)}
														className="flex justify-between items-center gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 text-slate-900 no-underline transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-400"
													>
														<span className="font-semibold text-base">
															{tournament.name}
														</span>
														<span className="text-sm text-blue-700 font-semibold whitespace-nowrap">
															{formatDate(tournament.createdAt)}
														</span>
													</a>
												</li>
											))}
										</ul>
									)}
								</section>
							</article>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
