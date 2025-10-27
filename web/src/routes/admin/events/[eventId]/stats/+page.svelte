<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<svelte:head>
	<title>プレイヤー統計 | Boost Bracket Admin</title>
</svelte:head>

<section class="container">
	<header class="section-header">
		<h1>プレイヤー統計</h1>
		<p>イベントID: <code>{data?.eventId ?? '(unknown)'}</code></p>
	</header>

	<section class="card">
		<h2>イベント全体の統計 ({data.stats.length}名)</h2>
		
		{#if data.stats.length === 0}
			<p class="empty">まだ試合結果が記録されていません。</p>
		{:else}
			<div class="table-container">
				<table class="stats-table">
					<thead>
						<tr>
							<th class="rank">順位</th>
							<th class="player">プレイヤー</th>
							<th class="wins">勝利</th>
							<th class="losses">敗北</th>
							<th class="total">試合数</th>
							<th class="winrate">勝率</th>
						</tr>
					</thead>
					<tbody>
						{#each data.stats as stat, index}
							<tr>
								<td class="rank">
									{#if index === 0}
										<span class="medal gold">🥇</span>
									{:else if index === 1}
										<span class="medal silver">🥈</span>
									{:else if index === 2}
										<span class="medal bronze">🥉</span>
									{:else}
										{index + 1}
									{/if}
								</td>
								<td class="player">{stat.playerName}</td>
								<td class="wins">{stat.wins}</td>
								<td class="losses">{stat.losses}</td>
								<td class="total">{stat.totalGames}</td>
								<td class="winrate">
									<div class="winrate-container">
										<span class="percentage">{stat.winRate}%</span>
										<div class="winrate-bar">
											<div class="winrate-fill" style="width: {stat.winRate}%"></div>
										</div>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</section>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		display: grid;
		gap: 2rem;
	}

	.section-header h1 {
		margin: 0;
		font-size: 2rem;
	}

	.section-header p {
		margin: 0.25rem 0 0;
		color: #6b7280;
	}

	.card {
		background: white;
		border-radius: 1rem;
		padding: 1.75rem;
		box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.card h2 {
		margin-top: 0;
		margin-bottom: 1.25rem;
		font-size: 1.25rem;
	}

	.empty {
		margin: 0.5rem 0;
		color: #64748b;
	}

	.table-container {
		overflow-x: auto;
	}

	.stats-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}

	.stats-table thead {
		background: rgba(248, 250, 252, 0.8);
		border-bottom: 2px solid rgba(148, 163, 184, 0.3);
	}

	.stats-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #475569;
	}

	.stats-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.stats-table tbody tr:hover {
		background: rgba(248, 250, 252, 0.6);
	}

	.stats-table tbody tr:last-child td {
		border-bottom: none;
	}

	.rank {
		width: 80px;
		text-align: center;
		font-weight: 600;
	}

	.player {
		font-weight: 600;
		color: #111827;
	}

	.wins {
		width: 80px;
		text-align: center;
		color: #16a34a;
		font-weight: 600;
	}

	.losses {
		width: 80px;
		text-align: center;
		color: #dc2626;
		font-weight: 600;
	}

	.total {
		width: 100px;
		text-align: center;
		color: #475569;
		font-weight: 600;
	}

	.winrate {
		width: 200px;
	}

	.medal {
		font-size: 1.5rem;
	}

	.winrate-container {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.percentage {
		min-width: 50px;
		font-weight: 600;
		color: #1d4ed8;
	}

	.winrate-bar {
		flex: 1;
		height: 8px;
		background: rgba(148, 163, 184, 0.2);
		border-radius: 9999px;
		overflow: hidden;
	}

	.winrate-fill {
		height: 100%;
		background: linear-gradient(90deg, #2563eb, #5940ff);
		border-radius: 9999px;
		transition: width 0.3s ease;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.stats-table {
			font-size: 0.85rem;
		}

		.stats-table th,
		.stats-table td {
			padding: 0.5rem 0.75rem;
		}

		.rank {
			width: 60px;
		}

		.wins,
		.losses {
			width: 60px;
		}

		.total {
			width: 80px;
		}

		.winrate {
			width: 150px;
		}

		.percentage {
			min-width: 45px;
			font-size: 0.85rem;
		}
	}
</style>
