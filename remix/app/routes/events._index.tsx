import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { getDatabase } from "~/repositories/database.server";
import type { EventRecord } from "~/repositories/events";
import type { TournamentRecord } from "~/repositories/tournaments";
import type { TeamBattleRecord } from "~/repositories/team-battles";
import type { TeamRecord } from "~/repositories/teams";

export type EventSummary = EventRecord & {
	tournaments: TournamentRecord[];
	teamBattles: TeamBattleRecord[];
	teams: TeamRecord[];
};

type LoaderData = {
	events: EventSummary[];
};

export async function loader({ context }: LoaderFunctionArgs) {
	const db = getDatabase(context);

	const events = await db.events.listEvents();

	const summaries: EventSummary[] = await Promise.all(
		events.map(async (record) => {
			const [tournaments, teamBattles, teams] = await Promise.all([
				db.tournaments.listTournaments(record.id),
				db.teamBattles.listTeamBattles(record.id),
				db.teams.listTeams(record.id),
			]);
			return {
				...record,
				tournaments,
				teamBattles,
				teams,
			};
		})
	);

	return json<LoaderData>({
		events: summaries,
	});
}

export const meta: MetaFunction = () => [
	{ title: "公開イベント一覧 | Boost Bracket" },
	{ name: "description", content: "公開設定された大会イベントとトーナメント・団体戦を閲覧できます。" },
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

const buildTeamBattleUrl = (eventId: string, battleId: string) =>
	`/events/${eventId}/team-battles/${battleId}/board`;

const statusLabelMap: Record<string, string> = {
	completed: "完了",
	in_progress: "進行中",
	scheduled: "予定",
	pending: "未開始",
	tiebreak_required: "タイブレーク待ち",
};

const statusClassMap: Record<string, string> = {
	completed: "bg-emerald-100 text-emerald-700 border border-emerald-200",
	in_progress: "bg-indigo-100 text-indigo-700 border border-indigo-200",
	scheduled: "bg-sky-100 text-sky-700 border border-sky-200",
	pending: "bg-slate-100 text-slate-600 border border-slate-200",
	tiebreak_required: "bg-amber-100 text-amber-700 border border-amber-200",
};

const resultLabelMap: Record<string, string> = {
	team_a_win: "チームA勝利",
	team_b_win: "チームB勝利",
	draw: "引き分け",
};

const getStatusLabel = (value: string | null | undefined) =>
	statusLabelMap[value ?? "pending"] ?? value ?? "";

const getStatusClass = (value: string | null | undefined) =>
	statusClassMap[value ?? "pending"] ?? statusClassMap.pending;

const getResultLabel = (value: string | null | undefined) =>
	value ? resultLabelMap[value] ?? value : null;

export default function EventsIndex() {
	const { events } = useLoaderData<typeof loader>();

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
			<section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-7 py-12">
				<header className="flex flex-col gap-3">
					<h1 className="text-3xl font-bold text-slate-900">公開イベント一覧</h1>
					<p className="text-slate-600 leading-relaxed">
						登録済みイベントのトーナメントと団体戦を観覧できます。リンクを共有してライブ進行をチェックしましょう。
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
												<Link
													to={buildTournamentUrl(event.id, tournament.id)}
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

								<section className="flex flex-col gap-3">
									<h3 className="text-lg font-semibold text-slate-900">団体戦</h3>
									{event.teamBattles.length === 0 ? (
										<p className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm">
											団体戦がまだ登録されていません。
										</p>
									) : (
										<ul className="grid gap-3">
											{event.teamBattles.map((battle) => {
												const teamA = event.teams.find((t) => t.id === battle.team_a_id);
												const teamB = event.teams.find((t) => t.id === battle.team_b_id);
												const teamAName = teamA?.name ?? "チームA";
												const teamBName = teamB?.name ?? "チームB";
												const resultLabel = getResultLabel(battle.result);

												return (
													<li key={battle.id}>
														<Link
															to={buildTeamBattleUrl(event.id, battle.id)}
															className="flex flex-col gap-2 px-4 py-3 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100 text-slate-900 no-underline transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:border-purple-400"
														>
															<div className="flex justify-between items-center gap-3">
																<span className="font-semibold text-base">
																	{teamAName} vs {teamBName}
																</span>
																<div className="flex items-center gap-2">
																	<span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusClass(battle.status)}`}>
																		{getStatusLabel(battle.status)}
																	</span>
																	{resultLabel && (
																		<span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
																			{resultLabel}
																		</span>
																	)}
																</div>
															</div>
															<div className="flex justify-between items-center text-sm text-purple-700">
																<span>スロット数: {battle.slots_count}</span>
																<span className="font-semibold">詳細を見る →</span>
															</div>
														</Link>
													</li>
												);
											})}
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
