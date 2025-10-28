<svelte:head>
	<title>Boost Bracket Admin</title>
</svelte:head>

<section class="container">
	<header class="hero">
		<h1>Boost Bracket 管理トップ</h1>
		<p>大会単位でエントリー管理・トーナメント運営を行います。</p>
		<p class="note">イベントを選択するか、新しく作成して管理をはじめましょう。</p>
	</header>

	<section class="card">
		<h2>イベントを選択</h2>
		<form class="event-form" on:submit|preventDefault={() => goToPlayers(selectedEventId)}>
			<label class="selector">
				<span>イベント一覧</span>
				<select bind:value={selectedEventId}>
					<option value="">-- イベントを選択 --</option>
					{#each data.events as event}
						<option value={event.id}>
							{event.name} ({event.id})
						</option>
					{/each}
				</select>
			</label>
			<div class="button-group">
				<button type="submit" class="primary" disabled={!selectedEventId}>プレイヤー管理へ</button>
				<button type="button" class="secondary" on:click={() => goToPairs(selectedEventId)} disabled={!selectedEventId}>ペア管理へ</button>
				<button type="button" class="secondary" on:click={() => goToTeams(selectedEventId)} disabled={!selectedEventId}>チーム管理へ</button>
				<button type="button" class="secondary" on:click={() => goToTeamBattles(selectedEventId)} disabled={!selectedEventId}>団体戦管理へ</button>
				<button type="button" class="secondary" on:click={() => goToMatches(selectedEventId)} disabled={!selectedEventId}>試合ログへ</button>
				<button type="button" class="secondary" on:click={() => goToStats(selectedEventId)} disabled={!selectedEventId}>統計表示へ</button>
				<button type="button" class="secondary" on:click={() => goToTournaments(selectedEventId)} disabled={!selectedEventId}>トーナメント設定へ</button>
			</div>
		</form>

		{#if form?.type === 'success' && form?.source === 'createEvent'}
			<div class="flash success">{form.message}</div>
		{:else if form?.type === 'error' && form?.source === 'createEvent'}
			<div class="flash error">{form.message}</div>
		{/if}
	</section>

	<section class="card">
		<h2>新しいイベントを作成</h2>
		<form method="POST" action="?/createEvent" class="create-form">
			<div class="fields">
				<label>
					<span>イベント名 *</span>
					<input name="name" placeholder="例: ガンダム駅前大会 2025" required />
				</label>
				<label>
					<span>スラッグ (任意)</span>
					<input name="slug" placeholder="半角英数・ハイフン" />
				</label>
			</div>
			<button type="submit" class="primary">イベントを作成</button>
		</form>
	</section>

	<section class="card">
		<h2>登録済みイベント</h2>
		{#if data.events.length === 0}
			<p class="empty">まだイベントが登録されていません。</p>
		{:else}
			<table class="event-table">
				<thead>
					<tr>
						<th>ID</th>
						<th>イベント名</th>
						<th>Slug</th>
						<th>作成日</th>
					</tr>
				</thead>
				<tbody>
					{#each data.events as event}
						<tr>
							<td>{event.id}</td>
							<td>{event.name}</td>
							<td>{event.slug ?? '-'}</td>
							<td>{new Date(event.createdAt).toLocaleString('ja-JP')}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</section>

<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	export let data: PageData;
	export let form: ActionData;

	let selectedEventId = '';

	onMount(() => {
		if (form?.type === 'success' && form?.source === 'createEvent' && form.createdEventId) {
			selectedEventId = form.createdEventId;
		} else if (data.events.length > 0) {
			selectedEventId = data.events[0].id;
		}
	});

	const goToPlayers = (id: string | undefined) => {
		const trimmed = id?.trim();
		if (!trimmed) return;
		void goto(`/admin/events/${trimmed}/entries/players`);
	};

	const goToPairs = (id: string | undefined) => {
		const trimmed = id?.trim();
		if (!trimmed) return;
		void goto(`/admin/events/${trimmed}/entries/pairs`);
	};

	const goToTeams = (id: string | undefined) => {
		const trimmed = id?.trim();
		if (!trimmed) return;
		void goto(`/admin/events/${trimmed}/entries/teams`);
	};

	const goToTeamBattles = (id: string | undefined) => {
		const trimmed = id?.trim();
		if (!trimmed) return;
		void goto(`/admin/events/${trimmed}/team-battles`);
	};

	const goToMatches = (id: string | undefined) => {
		const trimmed = id?.trim();
		if (!trimmed) return;
		void goto(`/admin/events/${trimmed}/matches`);
	};

	const goToStats = (id: string | undefined) => {
		const trimmed = id?.trim();
		if (!trimmed) return;
		void goto(`/admin/events/${trimmed}/stats`);
	};

	const goToTournaments = (id: string | undefined) => {
		const trimmed = id?.trim();
		if (!trimmed) return;
		void goto(`/admin/events/${trimmed}/tournaments`);
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
		display: grid;
		gap: 1rem;
	}

	.selector {
		display: grid;
		gap: 0.45rem;
		font-weight: 600;
	}

	.selector select {
		padding: 0.65rem 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.6);
		font-size: 1rem;
		min-width: 260px;
	}

	.button-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.create-form .fields {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	}

	.create-form label {
		display: grid;
		gap: 0.45rem;
		font-weight: 600;
	}

	input, select {
		padding: 0.65rem 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.6);
		font-size: 1rem;
	}

	input:focus,
	select:focus {
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

	button.secondary {
		background: rgba(37, 99, 235, 0.1);
		color: #1d4ed8;
	}

	button.secondary:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
	}

	.flash {
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		font-weight: 600;
	}

	.flash.success {
		background: rgba(16, 185, 129, 0.1);
		color: #0f766e;
	}

	.flash.error {
		background: rgba(239, 68, 68, 0.08);
		color: #b91c1c;
	}

	.event-table {
		width: 100%;
		border-collapse: collapse;
	}

	.event-table th,
	.event-table td {
		padding: 0.75rem 0.5rem;
		text-align: left;
		border-bottom: 1px solid rgba(148, 163, 184, 0.3);
	}

	.event-table th {
		font-size: 0.9rem;
		color: #475569;
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

		.button-group,
		.create-form .fields {
			flex-direction: column;
		}

		button {
			width: 100%;
		}
	}
</style>
