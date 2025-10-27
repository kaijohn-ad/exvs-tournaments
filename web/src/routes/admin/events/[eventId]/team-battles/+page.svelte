<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { invalidate } from '$app/navigation';

	export let data: PageData;
	export let form: ActionData;

	let statusMessage = '';

	$: if (form?.success) {
		statusMessage = '団体戦を削除しました';
		void invalidate(`team-battles:${data.eventId}`);
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

	function getTeamName(teamId: string): string {
		const team = data.teams.find(t => t.id === teamId);
		return team?.name ?? '(Unknown)';
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'completed':
				return 'status-completed';
			case 'in_progress':
				return 'status-in-progress';
			case 'scheduled':
				return 'status-scheduled';
			default:
				return 'status-default';
		}
	}

	function getStatusText(status: string): string {
		switch (status) {
			case 'completed':
				return '完了';
			case 'in_progress':
				return '進行中';
			case 'scheduled':
				return '予定';
			default:
				return status;
		}
	}

	function getResultText(result: string | null): string {
		if (!result) return '-';
		switch (result) {
			case 'team_a_win':
				return 'チームA勝利';
			case 'team_b_win':
				return 'チームB勝利';
			case 'draw':
				return '引き分け';
			default:
				return result;
		}
	}
</script>

<svelte:head>
	<title>団体戦管理 | Boost Bracket Admin</title>
</svelte:head>

<section class="container">
	<header class="section-header">
		<h1>団体戦管理</h1>
		<p>イベントID: <code>{data?.eventId ?? '(unknown)'}</code></p>
	</header>

	{#if statusMessage}
		<div class="status-message" class:error={form?.error}>
			{statusMessage}
		</div>
	{/if}

	<section class="card">
		<h2>団体戦一覧 ({data.teamBattles.length}件)</h2>
		
		{#if data.teamBattles.length === 0}
			<p class="empty">まだ団体戦が登録されていません。</p>
		{:else}
			<div class="battles-list">
				{#each data.teamBattles as battle}
					<div class="battle-card">
						<div class="battle-header">
							<div class="battle-info">
								<h3 class="battle-title">
									<a href="/admin/events/{data.eventId}/team-battles/{battle.id}">
										{getTeamName(battle.team_a_id)} vs {getTeamName(battle.team_b_id)}
									</a>
								</h3>
								<div class="battle-meta">
									<span class="meta-item">スロット数: {battle.slots_count}</span>
									<span class="meta-item">形式: {battle.format}</span>
									{#if battle.tiebreak}
										<span class="meta-item">タイブレーク: {battle.tiebreak}</span>
									{/if}
								</div>
							</div>
							<form method="POST" action="?/delete" class="delete-form">
								<input type="hidden" name="battleId" value={battle.id} />
								<button type="submit" class="delete-btn" title="削除">
									🗑️
								</button>
							</form>
						</div>

						<div class="battle-body">
							<div class="status-row">
								<span class="status-badge {getStatusBadgeClass(battle.status)}">
									{getStatusText(battle.status)}
								</span>
								{#if battle.result}
									<span class="result-badge">
										{getResultText(battle.result)}
									</span>
								{/if}
							</div>
							<div class="action-row">
								<a href="/admin/events/{data.eventId}/team-battles/{battle.id}" class="btn-manage">
									進行管理 →
								</a>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="card info-card">
		<h2>📝 団体戦について</h2>
		<p>
			団体戦（早稲田式）の管理機能です。チーム同士の対戦を設定し、
			各スロットにプレイヤーを配置してラインナップを管理できます。
		</p>
		<p class="note">
			※ 団体戦の作成とラインナップ編集機能は今後実装予定です。
		</p>
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

	.battles-list {
		display: grid;
		gap: 1rem;
	}

	.battle-card {
		background: rgba(248, 250, 252, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.75rem;
		padding: 1.25rem;
		transition: all 0.2s ease;
	}

	.battle-card:hover {
		box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.battle-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.battle-info {
		flex: 1;
	}

	.battle-title {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
		color: #111827;
	}

	.battle-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: 0.875rem;
		color: #64748b;
	}

	.meta-item {
		padding: 0.25rem 0.625rem;
		background: rgba(148, 163, 184, 0.1);
		border-radius: 0.375rem;
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

	.battle-body {
		display: grid;
		gap: 0.75rem;
	}

	.status-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.action-row {
		display: flex;
		justify-content: flex-end;
		padding-top: 0.5rem;
	}

	.btn-manage {
		padding: 0.5rem 1rem;
		background: #6366f1;
		color: white;
		text-decoration: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		transition: background 0.2s ease;
	}

	.btn-manage:hover {
		background: #4f46e5;
	}

	.battle-title a {
		color: inherit;
		text-decoration: none;
	}

	.battle-title a:hover {
		color: #6366f1;
	}

	.status-badge {
		padding: 0.375rem 0.875rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.status-completed {
		background: #d1fae5;
		color: #065f46;
	}

	.status-in-progress {
		background: #dbeafe;
		color: #1e40af;
	}

	.status-scheduled {
		background: #fef3c7;
		color: #92400e;
	}

	.status-default {
		background: rgba(148, 163, 184, 0.2);
		color: #475569;
	}

	.result-badge {
		padding: 0.375rem 0.875rem;
		background: rgba(99, 102, 241, 0.1);
		color: #4338ca;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.info-card {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
		border-color: rgba(99, 102, 241, 0.2);
	}

	.info-card p {
		margin: 0.5rem 0;
		color: #475569;
		line-height: 1.6;
	}

	.note {
		font-size: 0.9rem;
		color: #64748b;
		font-style: italic;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.battle-header {
			flex-direction: column;
			gap: 0.75rem;
		}

		.battle-meta {
			flex-direction: column;
			gap: 0.5rem;
		}
	}
</style>
