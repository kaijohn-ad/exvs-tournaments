<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	const formatDate = (isoString: string | undefined) => {
		if (!isoString) {
			return '未定';
		}

		const date = new Date(isoString);
		if (Number.isNaN(date.getTime())) {
			return '未定';
		}

		return date.toLocaleDateString('ja-JP', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const buildTournamentUrl = (eventId: string, tournamentId: string) =>
		`/events/${eventId}/tournaments/${tournamentId}/bracket`;
</script>

<svelte:head>
	<title>公開イベント一覧 | Boost Bracket</title>
	<meta name="description" content="公開設定された大会イベントとトーナメントを閲覧できます。" />
</svelte:head>

<section class="page">
	<header class="hero">
		<h1>公開イベント一覧</h1>
		<p>登録済みイベントのトーナメントを観覧できます。リンクを共有してライブ進行をチェックしましょう。</p>
	</header>

	{#if data.events.length === 0}
		<p class="empty">まだ公開中のイベントはありません。</p>
	{:else}
		<div class="grid">
			{#each data.events as event (event.id)}
				<article class="card">
					<header class="card-header">
						<h2>{event.name}</h2>
						{#if event.slug}
							<p class="slug">
								<span>共有URL:</span>
								<code>/view/{event.slug}</code>
							</p>
						{/if}
					</header>

					<dl class="meta">
						<div>
							<dt>イベントID</dt>
							<dd>{event.id}</dd>
						</div>
						<div>
							<dt>開催日</dt>
							<dd>{formatDate(event.createdAt)}</dd>
						</div>
					</dl>

					<section class="tournaments">
						<h3>トーナメント</h3>
						{#if event.tournaments.length === 0}
							<p class="empty-tournaments">トーナメントがまだ登録されていません。</p>
						{:else}
							<ul>
								{#each event.tournaments as tournament (tournament.id)}
									<li>
										<a class="tournament-link" href={buildTournamentUrl(event.id, tournament.id)}>
											<span class="tournament-name">{tournament.name}</span>
											<span class="tournament-date">
												{formatDate(tournament.createdAt)}
											</span>
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	:global(body) {
		background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
		color: #0f172a;
	}

	.page {
		max-width: 1100px;
		margin: 3rem auto 4rem;
		padding: 0 1.75rem;
		display: grid;
		gap: 2rem;
	}

	.hero h1 {
		margin: 0 0 0.75rem;
		font-size: 2rem;
	}

	.hero p {
		margin: 0;
		color: #475569;
		line-height: 1.7;
	}

	.empty {
		margin: 0;
		padding: 2.5rem;
		text-align: center;
		background: rgba(59, 130, 246, 0.08);
		border-radius: 1.25rem;
		border: 1px dashed rgba(59, 130, 246, 0.25);
		color: #1d4ed8;
		font-weight: 600;
	}

	.grid {
		display: grid;
		gap: 1.75rem;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	}

	.card {
		background: white;
		border-radius: 1.25rem;
		padding: 1.75rem;
		box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
		border: 1px solid rgba(148, 163, 184, 0.25);
		display: grid;
		gap: 1.25rem;
	}

	.card-header h2 {
		margin: 0;
		font-size: 1.4rem;
	}

	.slug {
		margin: 0.5rem 0 0;
		font-size: 0.9rem;
		color: #64748b;
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
	}

	.slug code {
		background: rgba(15, 23, 42, 0.05);
		padding: 0.2rem 0.45rem;
		border-radius: 0.4rem;
		font-size: 0.85rem;
		color: #0f172a;
	}

	.meta {
		display: grid;
		gap: 0.75rem;
		margin: 0;
	}

	.meta div {
		display: grid;
		gap: 0.3rem;
	}

	.meta dt {
		font-size: 0.85rem;
		font-weight: 600;
		color: #64748b;
	}

	.meta dd {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #0f172a;
	}

	.tournaments {
		display: grid;
		gap: 0.8rem;
	}

	.tournaments h3 {
		margin: 0;
		font-size: 1.05rem;
	}

	.tournaments ul {
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
		list-style: none;
	}

	.tournaments li {
		margin: 0;
	}

	.tournament-link {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 0.85rem;
		border: 1px solid rgba(59, 130, 246, 0.2);
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.08));
		text-decoration: none;
		color: inherit;
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
	}

	.tournament-link:hover,
	.tournament-link:focus-visible {
		transform: translateY(-2px);
		box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
		border-color: rgba(37, 99, 235, 0.55);
	}

	.tournament-name {
		font-weight: 600;
		font-size: 1rem;
	}

	.tournament-date {
		font-size: 0.85rem;
		color: #1d4ed8;
		font-weight: 600;
		white-space: nowrap;
	}

	.empty-tournaments {
		margin: 0;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		background: rgba(148, 163, 184, 0.12);
		color: #475569;
		font-size: 0.95rem;
	}

	@media (max-width: 640px) {
		.page {
			padding: 0 1.25rem;
			margin-top: 2.5rem;
		}

		.hero h1 {
			font-size: 1.75rem;
		}
	}
</style>
