import { useLoaderData } from "@remix-run/react";
import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { getDatabase } from "~/repositories/database.server";

type LoaderData = {
	eventId: string;
	stats: Array<{
		player_id: string;
		playerName: string;
		wins: number;
		losses: number;
		totalGames: number;
		winRate: string;
	}>;
};

export async function loader({ params, context }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw new Response("Event ID is required", { status: 400 });
	}

	const db = getDatabase(context);

	// プレイヤー統計を取得
	const eventStats = await db.playerStats.listPlayerStats("event", eventId);

	// プレイヤー情報を取得
	const players = await db.players.listPlayers(eventId);
	const playerMap = new Map(players.map((p) => [p.id, p.name]));

	// 統計データを加工
	const enrichedStats = eventStats.map((stat) => {
		const totalGames = stat.wins + stat.losses;
		const winRate = totalGames > 0 ? (stat.wins / totalGames * 100).toFixed(1) : "0.0";

		return {
			...stat,
			playerName: playerMap.get(stat.player_id) ?? "(Unknown)",
			totalGames,
			winRate,
		};
	});

	// 勝利数と勝率でソート
	const sortedStats = enrichedStats.sort((a, b) => {
		if (b.wins !== a.wins) return b.wins - a.wins;
		return parseFloat(b.winRate) - parseFloat(a.winRate);
	});

	return json<LoaderData>({
		eventId,
		stats: sortedStats,
	});
}

export default function StatsRoute() {
	const { eventId, stats } = useLoaderData<typeof loader>();

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-slate-900">プレイヤー統計</h1>
					<p className="mt-1 text-sm text-slate-600">
						イベントID: <code className="rounded bg-slate-100 px-2 py-1 text-xs">{eventId}</code>
					</p>
				</div>
			</header>

			<section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
				<h2 className="mb-6 text-xl font-semibold text-slate-900">
					イベント全体の統計 ({stats.length}名)
				</h2>

				{stats.length === 0 ? (
					<p className="text-center text-slate-500">まだ試合結果が記録されていません。</p>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 text-sm">
							<thead className="bg-slate-50">
								<tr>
									<th className="px-4 py-3 text-left font-semibold text-slate-600">順位</th>
									<th className="px-4 py-3 text-left font-semibold text-slate-600">プレイヤー</th>
									<th className="px-4 py-3 text-center font-semibold text-slate-600">勝利</th>
									<th className="px-4 py-3 text-center font-semibold text-slate-600">敗北</th>
									<th className="px-4 py-3 text-center font-semibold text-slate-600">試合数</th>
									<th className="px-4 py-3 text-left font-semibold text-slate-600">勝率</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200">
								{stats.map((stat, index) => (
									<tr key={stat.player_id} className="hover:bg-slate-50">
										<td className="px-4 py-3 text-center font-semibold">
											{index === 0 ? (
												<span className="text-2xl">🥇</span>
											) : index === 1 ? (
												<span className="text-2xl">🥈</span>
											) : index === 2 ? (
												<span className="text-2xl">🥉</span>
											) : (
												index + 1
											)}
										</td>
										<td className="px-4 py-3 font-semibold text-slate-900">
											{stat.playerName}
										</td>
										<td className="px-4 py-3 text-center font-semibold text-green-600">
											{stat.wins}
										</td>
										<td className="px-4 py-3 text-center font-semibold text-red-600">
											{stat.losses}
										</td>
										<td className="px-4 py-3 text-center font-semibold text-slate-600">
											{stat.totalGames}
										</td>
										<td className="px-4 py-3">
											<div className="flex items-center gap-3">
												<span className="min-w-[3rem] font-semibold text-blue-600">
													{stat.winRate}%
												</span>
												<div className="flex-1">
													<div className="h-2 w-full rounded-full bg-slate-200">
														<div
															className="h-2 rounded-full bg-blue-500 transition-all duration-300"
															style={{ width: `${stat.winRate}%` }}
														/>
													</div>
												</div>
											</div>
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
