<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { invalidate } from '$app/navigation';

	export let data: PageData;
	export let form: ActionData;

	let statusMessage = '';

	$: if (form?.success) {
		statusMessage = '試合ログを削除しました';
		void invalidate(`matches:${data.eventId}`);
		setTimeout(() => {
			statusMessage = '';
		}, 3000);
	}

	$: if (form?.error) {
		statusMessage = `エラー: ${form.error}`;
		setTimeout(() => {
			statusMessage = '';
		}, 5000);
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleString('ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getResultBadgeClass(winnerSide: 'a' | 'b', side: 'a' | 'b'): string {
		return winnerSide === side ? 'winner' : 'loser';
	}

	function getResultText(winnerSide: 'a' | 'b', side: 'a' | 'b'): string {
		return winnerSide === side ? '勝利' : '敗北';
	}
</script>

<svelte:head>
	<title>試合ログ | Boost Bracket Admin</title>
</svelte:head>

<section class="container">
	<header class="section-header">
		<h1>試合ログ</h1>
		<p>イベントID: <code>{data?.eventId ?? '(unknown)'}</code></p>
	</header>

	{#if statusMessage}
		<div class="status-message" class:error={form?.error}>
			{statusMessage}
		</div>
	{/if}

	<section class="card">
		<h2>試合履歴 ({data.matches.length}件)</h2>
		
		{#if data.matches.length === 0}
			<p class="empty">まだ試合が記録されていません。</p>
		{:else}
			<div class="matches-list">
				{#each data.matches as match}
					<div class="match-card">
						<div class="match-header">
							<div class="match-time">
								{formatDate(match.played_at)}
							</div>
							<form method="POST" action="?/delete" class="delete-form">
								<input type="hidden" name="matchId" value={match.id} />
								<button type="submit" class="delete-btn" title="削除">
									🗑️
								</button>
							</form>
						</div>
						
						<div class="match-body">
							<div class="player-result">
								<div class="player-name">{match.sideAName}</div>
								<div class="score-display">
									<span class="score">{match.score_a}</span>
									<span class="result-badge {getResultBadgeClass(match.winner_side, 'a')}">
										{getResultText(match.winner_side, 'a')}
									</span>
								</div>
							</div>
							
							<div class="vs-divider">VS</div>
							
							<div class="player-result">
								<div class="player-name">{match.sideBName}</div>
								<div class="score-display">
									<span class="score">{match.score_b}</span>
									<span class="result-badge {getResultBadgeClass(match.winner_side, 'b')}">
										{getResultText(match.winner_side, 'b')}
									</span>
								</div>
							</div>
						</div>

						<div class="match-context">
							<span class="context-badge">
								{match.context === 'bracket' ? 'ブラケット' : 
								 match.context === 'teamBattle' ? '団体戦' : 
								 match.context === 'tiebreak' ? 'タイブレーク' : 
								 match.context}
							</span>
							{#if match.context_id}
								<span class="context-id">ID: {match.context_id}</span>
							{/if}
							<span class="status-badge">{match.status}</span>
						</div>
					</div>
				{/each}
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

	.status-message {
		padding: 1rem 1.25rem;
		background: #d1fae5;
		border: 1px solid #6ee7b7;
		border-radius: 0.75rem;
		color: #065f46;
		font-weight: 500;
	}

	.status-message.error {
		background: #fee2e2;
		border-color: #fca5a5;
		color: #991b1b;
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

	.matches-list {
		display: grid;
		gap: 1rem;
	}

	.match-card {
		background: rgba(248, 250, 252, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.75rem;
		padding: 1rem;
		transition: all 0.2s ease;
	}

	.match-card:hover {
		box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.match-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.match-time {
		font-size: 0.875rem;
		color: #64748b;
		font-weight: 500;
	}

	.delete-form {
		margin: 0;
	}

	.delete-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.25rem;
		padding: 0.25rem 0.5rem;
		opacity: 0.6;
		transition: opacity 0.2s ease;
	}

	.delete-btn:hover {
		opacity: 1;
	}

	.match-body {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 1rem;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.player-result {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.player-name {
		font-weight: 600;
		font-size: 1.05rem;
		color: #111827;
	}

	.score-display {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.score {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1d4ed8;
		min-width: 40px;
	}

	.result-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 600;
		text-align: center;
	}

	.result-badge.winner {
		background: #d1fae5;
		color: #065f46;
	}

	.result-badge.loser {
		background: #fee2e2;
		color: #991b1b;
	}

	.vs-divider {
		font-weight: 700;
		color: #64748b;
		text-align: center;
		font-size: 0.875rem;
	}

	.match-context {
		margin-top: 0.75rem;
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.85rem;
	}

	.context-badge {
		padding: 0.25rem 0.625rem;
		background: rgba(99, 102, 241, 0.1);
		color: #4338ca;
		border-radius: 0.375rem;
		font-weight: 600;
	}

	.context-id {
		color: #64748b;
		font-family: monospace;
	}

	.status-badge {
		padding: 0.25rem 0.625rem;
		background: rgba(34, 197, 94, 0.1);
		color: #15803d;
		border-radius: 0.375rem;
		font-weight: 600;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.match-body {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.vs-divider {
			order: 1;
		}

		.player-result:first-child {
			order: 0;
		}

		.player-result:last-child {
			order: 2;
		}
	}
</style>
