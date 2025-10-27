<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { invalidate } from '$app/navigation';

	export let data: PageData;
	export let form: ActionData;

	let flashTimer: ReturnType<typeof setTimeout> | null = null;
	let flashVisible = false;
	let editingBattleId: string | null = null;

	$: if (form?.type) {
		flashVisible = true;
		if (flashTimer) clearTimeout(flashTimer);
		flashTimer = setTimeout(() => {
			flashVisible = false;
			flashTimer = null;
		}, 4000);
		
		if (form.success) {
			void invalidate(`team-battles:${data.eventId}`);
		}
	}

	$: if (flashVisible === false && flashTimer) {
		clearTimeout(flashTimer);
		flashTimer = null;
	}

	function getTeamName(teamId: string): string {
		const team = data.teams.find(t => t.id === teamId);
		return team?.name ?? '(Unknown)';
	}

	function startEdit(battleId: string) {
		editingBattleId = battleId;
	}

	function cancelEdit() {
		editingBattleId = null;
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

	<section class="card">
		<h2>団体戦を作成</h2>
		{#if flashVisible && form?.type === 'error' && form?.source === 'create'}
			<div class={`flash ${form.type}`}>{form.message}</div>
		{/if}
		{#if data.teams.length < 2}
			<p class="empty">団体戦を作成するには、少なくとも2つのチームが必要です。</p>
			<p class="helper">
				<a href="/admin/events/{data.eventId}/entries/teams">チーム管理ページ</a>でチームを追加してください。
			</p>
		{:else}
			<form method="POST" action="?/create" class="stack">
				<label>
					<span>チームA <span class="required">*</span></span>
					<select name="team_a_id" required>
						<option value="">選択してください</option>
						{#each data.teams as team}
							<option value={team.id}>{team.name}</option>
						{/each}
					</select>
				</label>

				<label>
					<span>チームB <span class="required">*</span></span>
					<select name="team_b_id" required>
						<option value="">選択してください</option>
						{#each data.teams as team}
							<option value={team.id}>{team.name}</option>
						{/each}
					</select>
				</label>

				<label>
					<span>スロット数 <span class="required">*</span></span>
					<select name="slots_count" required>
						<option value="1">1</option>
						<option value="2">2</option>
						<option value="3" selected>3</option>
						<option value="4">4</option>
						<option value="5">5</option>
					</select>
				</label>

				<label>
					<span>形式</span>
					<select name="format">
						<option value="waseda" selected>早稲田式</option>
					</select>
				</label>

				<label>
					<span>タイブレーク</span>
					<select name="tiebreak">
						<option value="off" selected>なし</option>
						<option value="representative">代表戦</option>
					</select>
				</label>

				<div class="actions">
					<button type="submit" class="primary">作成</button>
				</div>
			</form>
		{/if}
	</section>

	<section class="card">
		<h2>登録済み団体戦 ({data.teamBattles.length}件)</h2>
		{#if flashVisible && form?.message && form?.type === 'success'}
			<div class={`flash ${form.type}`}>{form.message}</div>
		{/if}
		
		{#if data.teamBattles.length === 0}
			<p class="empty">まだ団体戦が登録されていません。</p>
		{:else}
			<div class="battles-list">
				{#each data.teamBattles as battle}
					<div class="battle-card">
						{#if editingBattleId === battle.id}
							<form method="POST" action="?/update" class="edit-form">
								<input type="hidden" name="battleId" value={battle.id} />
								
								<label>
									<span>チームA <span class="required">*</span></span>
									<select name="team_a_id" required value={battle.team_a_id}>
										<option value="">選択してください</option>
										{#each data.teams as team}
											<option value={team.id} selected={team.id === battle.team_a_id}>
												{team.name}
											</option>
										{/each}
									</select>
								</label>

								<label>
									<span>チームB <span class="required">*</span></span>
									<select name="team_b_id" required value={battle.team_b_id}>
										<option value="">選択してください</option>
										{#each data.teams as team}
											<option value={team.id} selected={team.id === battle.team_b_id}>
												{team.name}
											</option>
										{/each}
									</select>
								</label>

								<label>
									<span>スロット数 <span class="required">*</span></span>
									<select name="slots_count" required value={battle.slots_count}>
										<option value="1" selected={battle.slots_count === 1}>1</option>
										<option value="2" selected={battle.slots_count === 2}>2</option>
										<option value="3" selected={battle.slots_count === 3}>3</option>
										<option value="4" selected={battle.slots_count === 4}>4</option>
										<option value="5" selected={battle.slots_count === 5}>5</option>
									</select>
								</label>

								<label>
									<span>形式</span>
									<select name="format" value={battle.format}>
										<option value="waseda" selected={battle.format === 'waseda'}>早稲田式</option>
									</select>
								</label>

								<label>
									<span>タイブレーク</span>
									<select name="tiebreak" value={battle.tiebreak}>
										<option value="off" selected={battle.tiebreak === 'off'}>なし</option>
										<option value="representative" selected={battle.tiebreak === 'representative'}>代表戦</option>
									</select>
								</label>

								<div class="row-actions">
									<button type="button" class="ghost" on:click={cancelEdit}>キャンセル</button>
									<button type="submit" class="primary">更新</button>
								</div>
							</form>
						{:else}
							<div class="battle-header">
								<div class="battle-info">
									<h3 class="battle-title">
										{getTeamName(battle.team_a_id)} vs {getTeamName(battle.team_b_id)}
									</h3>
									<div class="battle-meta">
										<span class="meta-item">スロット数: {battle.slots_count}</span>
										<span class="meta-item">形式: {battle.format}</span>
										{#if battle.tiebreak !== 'off'}
											<span class="meta-item">タイブレーク: {battle.tiebreak}</span>
										{/if}
									</div>
								</div>
								<div class="battle-actions">
									<button type="button" class="edit-btn" on:click={() => startEdit(battle.id)} title="編集">
										✏️
									</button>
									<form method="POST" action="?/delete" class="delete-form">
										<input type="hidden" name="battleId" value={battle.id} />
										<button 
											type="submit" 
											class="delete-btn" 
											title="削除"
											on:click={(event) => {
												if (!confirm('この団体戦を削除しますか？')) {
													event.preventDefault();
												}
											}}
										>
											🗑️
										</button>
									</form>
								</div>
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
							</div>
						{/if}
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
			※ ラインナップ編集は各団体戦の✏️ボタンから行えます。
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

	.stack {
		display: grid;
		gap: 1rem;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-weight: 600;
	}

	input,
	textarea,
	select {
		padding: 0.65rem 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.6);
		font-size: 1rem;
		font-weight: 500;
		color: #111827;
		background: rgba(248, 250, 252, 0.6);
	}

	select {
		cursor: pointer;
	}

	input:focus,
	textarea:focus,
	select:focus {
		border-color: #2563eb;
		outline: none;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
	}

	.actions,
	.row-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	button {
		border: none;
		border-radius: 9999px;
		padding: 0.55rem 1.25rem;
		font-weight: 600;
		cursor: pointer;
		background: transparent;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	button:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
	}

	button.primary {
		background: linear-gradient(135deg, #2563eb, #5940ff);
		color: white;
	}

	button.secondary {
		background: rgba(37, 99, 235, 0.1);
		color: #1d4ed8;
	}

	button.ghost {
		background: rgba(148, 163, 184, 0.1);
		color: #475569;
	}

	.required {
		color: #dc2626;
		font-size: 0.9em;
	}

	.empty {
		margin: 0.5rem 0;
		color: #64748b;
	}

	.helper {
		margin: 0.5rem 0;
		color: #475569;
		font-size: 0.9rem;
	}

	.helper a {
		color: #2563eb;
		text-decoration: underline;
	}

	.flash {
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		font-weight: 600;
		margin-bottom: 1rem;
	}

	.flash.success {
		background: rgba(34, 197, 94, 0.15);
		color: #166534;
		border: 1px solid rgba(34, 197, 94, 0.35);
	}

	.flash.error {
		background: rgba(248, 113, 113, 0.15);
		color: #b91c1c;
		border: 1px solid rgba(248, 113, 113, 0.35);
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

	.edit-form {
		display: grid;
		gap: 1rem;
	}

	.battle-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.battle-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
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

	.battle-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.edit-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.25rem;
		padding: 0.25rem 0.5rem;
		opacity: 0.6;
		transition: opacity 0.2s ease;
		text-decoration: none;
	}

	.edit-btn:hover {
		opacity: 1;
	}

	.delete-form {
		margin: 0;
	}

	.edit-btn,
	.delete-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 1.25rem;
		padding: 0.25rem 0.5rem;
		opacity: 0.6;
		transition: opacity 0.2s ease, transform 0.2s ease;
	}

	.edit-btn:hover,
	.delete-btn:hover {
		opacity: 1;
		transform: scale(1.1);
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
