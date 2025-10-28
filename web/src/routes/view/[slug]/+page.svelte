<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<svelte:head>
	<title>{data.eventName} | Boost Bracket</title>
</svelte:head>

<section class="container">
	<header class="header">
		<h1>{data.eventName}</h1>
		<p class="slug">イベントスラッグ: <code>{data.slug}</code></p>
	</header>

	<section class="card">
		<h2>トーナメント一覧</h2>
		<p class="empty">{data.message}</p>
	</section>
</section>

<style>
	:global(body) {
		background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	.container {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		display: grid;
		gap: 2rem;
	}

	.header h1 {
		margin: 0;
		font-size: 2rem;
		color: #111827;
	}

	.header .slug {
		margin: 0.5rem 0 0;
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


	code {
		font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			'Liberation Mono', 'Courier New', monospace;
		background: rgba(148, 163, 184, 0.15);
		padding: 0.2rem 0.5rem;
		border-radius: 0.35rem;
		font-size: 0.95em;
	}

	@media (max-width: 640px) {
		.container {
			padding: 1.5rem 1rem 3rem;
		}
	}
</style>
