<svelte:head>
	<title>Boost Bracket Admin</title>
</svelte:head>

<section class="container">
	<header class="hero">
		<h1>Boost Bracket 管理トップ</h1>
		<p>大会単位でエントリー管理・トーナメント運営を行います。</p>
		<p class="note">プレイヤー管理ページへ移動するにはイベントIDを指定してください。</p>
	</header>

	<section class="card">
		<h2>イベントIDから移動</h2>
		<form class="event-form" on:submit={handleSubmit}>
			<label>
				<span>イベントID</span>
				<input
					placeholder="例: event-1"
					autocomplete="off"
					bind:value={eventId}
				/>
			</label>
			<button type="submit" class="primary">プレイヤー管理へ</button>
		</form>
	</section>

	<section class="card">
		<h2>クイックリンク</h2>
		{#if quickLinks.length === 0}
			<p class="empty">まだリンクがありません。</p>
		{:else}
			<ul class="quick-list">
				{#each quickLinks as link}
					<li>
						<button type="button" on:click={() => goToPlayers(link.id)}>
							<span class="label">{link.label}</span>
							<span class="id">{link.id}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</section>

<script lang="ts">
	import { goto } from '$app/navigation';

	let eventId = '';
	const quickLinks = [{ id: 'event-1', label: 'サンプル: event-1' }];

	const goToPlayers = (id: string) => {
		const trimmed = id.trim();
		if (!trimmed) return;
		void goto(`/admin/events/${trimmed}/entries/players`);
	};

	const handleSubmit = (event: SubmitEvent) => {
		event.preventDefault();
		goToPlayers(eventId);
	};
</script>

<style>
	:global(body) {
		background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%);
	}

	.container {
		margin: 2.5rem auto 3.5rem;
		max-width: 880px;
		padding: 0 1.75rem;
		display: grid;
		gap: 2rem;
	}

	.hero h1 {
		font-size: 2.1rem;
		margin-bottom: 0.75rem;
	}

	.hero p {
		margin: 0.35rem 0;
		color: #475569;
		line-height: 1.6;
	}

	.hero .note {
		font-weight: 600;
		color: #2563eb;
	}

	.card {
		background: white;
		border-radius: 1.2rem;
		padding: 1.75rem;
		box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.card h2 {
		margin-top: 0;
		margin-bottom: 1.25rem;
		font-size: 1.35rem;
	}

	.event-form {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-end;
	}

	label {
		display: grid;
		gap: 0.45rem;
		font-weight: 600;
	}

	input {
		padding: 0.65rem 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.6);
		font-size: 1rem;
		min-width: 240px;
	}

	input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
		outline: none;
	}

	button {
		border: none;
		border-radius: 9999px;
		padding: 0.6rem 1.4rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	button.primary {
		background: linear-gradient(135deg, #2563eb, #5940ff);
		color: white;
	}

	button.primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 20px rgba(37, 99, 235, 0.25);
	}

	.quick-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}

	.quick-list button {
		width: 100%;
		text-align: left;
		padding: 0.85rem 1.1rem;
		border-radius: 0.9rem;
		background: rgba(37, 99, 235, 0.08);
		color: #1d4ed8;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.quick-list button:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18);
	}

	.quick-list .id {
		font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			'Liberation Mono', 'Courier New', monospace;
		font-size: 0.95rem;
	}

	.empty {
		margin: 0;
		color: #64748b;
	}

	@media (max-width: 640px) {
		.container {
			padding: 0 1.1rem;
		}

		.event-form {
			flex-direction: column;
			align-items: stretch;
		}

		button {
			width: 100%;
		}

		.quick-list button {
			gap: 0.75rem;
		}
	}
</style>
