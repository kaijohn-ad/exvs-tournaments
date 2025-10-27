<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { invalidate } from '$app/navigation';

	export let data: PageData;
	export let form: ActionData;

	let statusMessage = '';
	let flashType: 'success' | 'error' = 'success';

	$: if (form?.success) {
		statusMessage = form.message || '操作が完了しました';
		flashType = 'success';
		void invalidate(`team-battle:${data.battleId}`);
		setTimeout(() => {
			statusMessage = '';
		}, 4000);
	}

	$: if (form?.error) {
		statusMessage = `エラー: ${form.error}`;
		flashType = 'error';
		setTimeout(() => {
			statusMessage = '';
		}, 5000);
	}

	function getTeamName(teamId: string): string {
		const team = data.teams.find(t => t.id === teamId);
		return team?.name ?? '(Unknown)';
	}

	function getPlayerName(playerId: string | undefined): string {
		if (!playerId) return '-';
		const player = data.players.find(p => p.id === playerId);
		return player?.name ?? '(Unknown)';
	}

	function getPairDisplay(pairId: string | undefined): string {
		if (!pairId) return '-';
		const pair = data.pairs.find(p => p.id === pairId);
		if (!pair) return '(Unknown)';
		return `${getPlayerName(pair.player1_id)} / ${getPlayerName(pair.player2_id)}`;
	}

	function getSlotDisplay(slot: any): string {
		if (slot.assignment_type === 'pair') {
			return getPairDisplay(slot.pair_id);
		} else {
			return `${getPlayerName(slot.player1_id)} / ${getPlayerName(slot.player2_id)}`;
		}
	}

	function getSlotResult(slotIndex: number): any | null {
		return data.matches.find((m, idx) => idx === slotIndex) || null;
	}

	function getStatusBadgeClass(status: string): string {
		switch (status) {
			case 'completed':
				return 'status-completed';
			case 'in_progress':
				return 'status-in-progress';
			case 'tiebreak_required':
				return 'status-tiebreak';
			case 'pending':
				return 'status-pending';
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
			case 'tiebreak_required':
				return 'タイブレーク待ち';
			case 'pending':
				return '未開始';
			default:
				return status;
		}
	}

	function getResultText(result: string | undefined): string {
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

	function calculateCurrentScore(): { teamA: number; teamB: number } {
		let teamA = 0;
		let teamB = 0;
		
		for (const match of data.matches) {
			if (match.context === 'teamBattle') {
				if (match.winner_side === 'a') {
					teamA++;
				} else if (match.winner_side === 'b') {
					teamB++;
				}
			}
		}
		
		return { teamA, teamB };
	}

	$: currentScore = calculateCurrentScore();
	$: canFinalize = data.matches.filter(m => m.context === 'teamBattle').length === data.battle.slots_count;
	$: needsTiebreaker = data.battle.status === 'tiebreak_required';
</script>

<svelte:head>
	<title>団体戦進行管理 | Boost Bracket Admin</title>
</svelte:head>

<section class="container">
	<header class="section-header">
		<div>
			<h1>団体戦進行管理</h1>
			<p class="breadcrumb">
				<a href="/admin/events/{data.eventId}/team-battles">← 団体戦一覧に戻る</a>
			</p>
		</div>
	</header>

	{#if statusMessage}
		<div class="status-message" class:error={flashType === 'error'}>
			{statusMessage}
		</div>
	{/if}

	<section class="card battle-info-card">
		<div class="battle-header">
			<h2>{getTeamName(data.battle.team_a_id)} vs {getTeamName(data.battle.team_b_id)}</h2>
			<span class="status-badge {getStatusBadgeClass(data.battle.status)}">
				{getStatusText(data.battle.status)}
			</span>
		</div>
		
		<div class="battle-meta">
			<div class="meta-item">
				<span class="label">形式:</span>
				<span class="value">{data.battle.format}</span>
			</div>
			<div class="meta-item">
				<span class="label">スロット数:</span>
				<span class="value">{data.battle.slots_count}</span>
			</div>
			<div class="meta-item">
				<span class="label">タイブレーク:</span>
				<span class="value">{data.battle.tiebreak === 'off' ? 'なし' : '代表戦'}</span>
			</div>
			{#if data.battle.result}
				<div class="meta-item">
					<span class="label">結果:</span>
					<span class="value result">{getResultText(data.battle.result)}</span>
				</div>
			{/if}
		</div>

		<div class="score-display">
			<div class="team-score">
				<span class="team-name">{getTeamName(data.battle.team_a_id)}</span>
				<span class="score">{currentScore.teamA}</span>
			</div>
			<span class="separator">-</span>
			<div class="team-score">
				<span class="score">{currentScore.teamB}</span>
				<span class="team-name">{getTeamName(data.battle.team_b_id)}</span>
			</div>
		</div>
	</section>

	<section class="card slots-card">
		<h2>スロット別試合結果</h2>
		
		<div class="slots-grid">
			{#each Array(data.battle.slots_count) as _, slotIndex}
				{@const teamASlot = data.teamASlots.find(s => s.slot_index === slotIndex)}
				{@const teamBSlot = data.teamBSlots.find(s => s.slot_index === slotIndex)}
				{@const slotResult = getSlotResult(slotIndex)}
				
				<div class="slot-card" class:has-result={slotResult}>
					<div class="slot-header">
						<h3>スロット {slotIndex + 1}</h3>
						{#if slotResult}
							<span class="result-badge">結果入力済み</span>
						{/if}
					</div>

					<div class="slot-matchup">
						<div class="slot-side team-a">
							<div class="team-label">{getTeamName(data.battle.team_a_id)}</div>
							<div class="players">
								{#if teamASlot}
									{getSlotDisplay(teamASlot)}
								{:else}
									<span class="unassigned">未割当</span>
								{/if}
							</div>
						</div>

						<div class="vs-divider">VS</div>

						<div class="slot-side team-b">
							<div class="team-label">{getTeamName(data.battle.team_b_id)}</div>
							<div class="players">
								{#if teamBSlot}
									{getSlotDisplay(teamBSlot)}
								{:else}
									<span class="unassigned">未割当</span>
								{/if}
							</div>
						</div>
					</div>

					{#if slotResult}
						<div class="slot-result">
							<div class="result-scores">
								<span class="score" class:winner={slotResult.winner_side === 'a'}>
									{slotResult.score_a}
								</span>
								<span class="separator">-</span>
								<span class="score" class:winner={slotResult.winner_side === 'b'}>
									{slotResult.score_b}
								</span>
							</div>
							<div class="result-winner">
								勝者: {slotResult.winner_side === 'a' ? getTeamName(data.battle.team_a_id) : getTeamName(data.battle.team_b_id)}
							</div>
							{#if data.battle.status !== 'completed'}
								<form method="POST" action="?/deleteSlotResult" class="delete-result-form">
									<input type="hidden" name="matchId" value={slotResult.id} />
									<button type="submit" class="btn-delete-small">削除</button>
								</form>
							{/if}
						</div>
					{:else if teamASlot && teamBSlot && data.battle.status !== 'completed'}
						<form method="POST" action="?/recordSlotResult" class="result-input-form">
							<input type="hidden" name="slotIndex" value={slotIndex} />
							
							<div class="score-inputs">
								<div class="score-input-group">
									<label for="scoreA-{slotIndex}">スコアA:</label>
									<input 
										type="number" 
										id="scoreA-{slotIndex}" 
										name="scoreA" 
										min="0" 
										max="10" 
										required 
									/>
								</div>
								
								<div class="score-input-group">
									<label for="scoreB-{slotIndex}">スコアB:</label>
									<input 
										type="number" 
										id="scoreB-{slotIndex}" 
										name="scoreB" 
										min="0" 
										max="10" 
										required 
									/>
								</div>
							</div>

							<div class="winner-select">
								<label for="winner-{slotIndex}">勝者:</label>
								<select id="winner-{slotIndex}" name="winnerTeamId" required>
									<option value="">選択してください</option>
									<option value={data.battle.team_a_id}>{getTeamName(data.battle.team_a_id)}</option>
									<option value={data.battle.team_b_id}>{getTeamName(data.battle.team_b_id)}</option>
								</select>
							</div>

							<button type="submit" class="btn-primary">結果を記録</button>
						</form>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	{#if needsTiebreaker}
		<section class="card tiebreak-card">
			<h2>🏆 タイブレーク（代表戦）</h2>
			<p class="tiebreak-note">
				スコアが同点のため、代表戦の結果を入力してください。
			</p>

			<form method="POST" action="?/recordTiebreaker" class="tiebreak-form">
				<div class="score-inputs">
					<div class="score-input-group">
						<label for="tiebreak-scoreA">{getTeamName(data.battle.team_a_id)} スコア:</label>
						<input 
							type="number" 
							id="tiebreak-scoreA" 
							name="scoreA" 
							min="0" 
							max="10" 
							required 
						/>
					</div>
					
					<div class="score-input-group">
						<label for="tiebreak-scoreB">{getTeamName(data.battle.team_b_id)} スコア:</label>
						<input 
							type="number" 
							id="tiebreak-scoreB" 
							name="scoreB" 
							min="0" 
							max="10" 
							required 
						/>
					</div>
				</div>

				<div class="winner-select">
					<label for="tiebreak-winner">勝者:</label>
					<select id="tiebreak-winner" name="winnerTeamId" required>
						<option value="">選択してください</option>
						<option value={data.battle.team_a_id}>{getTeamName(data.battle.team_a_id)}</option>
						<option value={data.battle.team_b_id}>{getTeamName(data.battle.team_b_id)}</option>
					</select>
				</div>

				<button type="submit" class="btn-primary btn-large">タイブレーク結果を記録</button>
			</form>
		</section>
	{/if}

	{#if canFinalize && data.battle.status !== 'completed' && !needsTiebreaker}
		<section class="card finalize-card">
			<h2>団体戦の確定</h2>
			<p>全スロットの結果が入力されました。団体戦を確定しますか？</p>
			
			<form method="POST" action="?/finalizeBattle">
				<button type="submit" class="btn-primary btn-large">団体戦を確定する</button>
			</form>
		</section>
	{/if}
</section>

<style>
	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		display: grid;
		gap: 2rem;
	}

	.section-header h1 {
		margin: 0 0 0.5rem;
		font-size: 2rem;
	}

	.breadcrumb {
		margin: 0;
		font-size: 0.9rem;
	}

	.breadcrumb a {
		color: #6366f1;
		text-decoration: none;
	}

	.breadcrumb a:hover {
		text-decoration: underline;
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

	.battle-info-card {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
	}

	.battle-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid rgba(99, 102, 241, 0.2);
	}

	.battle-header h2 {
		margin: 0;
		font-size: 1.5rem;
	}

	.status-badge {
		padding: 0.5rem 1rem;
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

	.status-tiebreak {
		background: #fef3c7;
		color: #92400e;
	}

	.status-pending {
		background: rgba(148, 163, 184, 0.2);
		color: #475569;
	}

	.status-default {
		background: rgba(148, 163, 184, 0.2);
		color: #475569;
	}

	.battle-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.meta-item .label {
		font-size: 0.875rem;
		color: #64748b;
		font-weight: 500;
	}

	.meta-item .value {
		font-size: 1rem;
		color: #111827;
		font-weight: 600;
	}

	.meta-item .value.result {
		color: #6366f1;
	}

	.score-display {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 2rem;
		padding: 1.5rem;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
	}

	.team-score {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.team-score .team-name {
		font-size: 1rem;
		color: #64748b;
		font-weight: 500;
	}

	.team-score .score {
		font-size: 3rem;
		font-weight: 700;
		color: #111827;
	}

	.score-display .separator {
		font-size: 2rem;
		color: #94a3b8;
		font-weight: 300;
	}

	.slots-grid {
		display: grid;
		gap: 1.5rem;
	}

	.slot-card {
		background: rgba(248, 250, 252, 0.5);
		border: 2px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.75rem;
		padding: 1.25rem;
		transition: all 0.2s ease;
	}

	.slot-card.has-result {
		border-color: rgba(34, 197, 94, 0.3);
		background: rgba(220, 252, 231, 0.3);
	}

	.slot-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
	}

	.slot-header h3 {
		margin: 0;
		font-size: 1.1rem;
		color: #111827;
	}

	.result-badge {
		padding: 0.25rem 0.75rem;
		background: rgba(34, 197, 94, 0.15);
		color: #166534;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.slot-matchup {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 1rem;
		align-items: center;
		margin-bottom: 1rem;
	}

	.slot-side {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.team-label {
		font-size: 0.875rem;
		color: #64748b;
		font-weight: 600;
	}

	.players {
		font-size: 1rem;
		color: #111827;
		font-weight: 500;
	}

	.unassigned {
		color: #94a3b8;
		font-style: italic;
	}

	.vs-divider {
		font-size: 0.875rem;
		font-weight: 700;
		color: #94a3b8;
		text-align: center;
	}

	.slot-result {
		background: white;
		border-radius: 0.5rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.result-scores {
		display: flex;
		gap: 1rem;
		align-items: center;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.result-scores .score {
		color: #64748b;
	}

	.result-scores .score.winner {
		color: #22c55e;
	}

	.result-scores .separator {
		color: #cbd5e1;
	}

	.result-winner {
		font-size: 0.875rem;
		color: #6366f1;
		font-weight: 600;
	}

	.result-input-form {
		background: white;
		border-radius: 0.5rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.score-inputs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.score-input-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.score-input-group label {
		font-size: 0.875rem;
		color: #64748b;
		font-weight: 500;
	}

	.score-input-group input {
		padding: 0.5rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.375rem;
		font-size: 1rem;
	}

	.winner-select {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.winner-select label {
		font-size: 0.875rem;
		color: #64748b;
		font-weight: 500;
	}

	.winner-select select {
		padding: 0.5rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.375rem;
		font-size: 1rem;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		background: #6366f1;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.btn-primary:hover {
		background: #4f46e5;
	}

	.btn-large {
		padding: 1rem 2rem;
		font-size: 1.1rem;
	}

	.btn-delete-small {
		padding: 0.25rem 0.75rem;
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.btn-delete-small:hover {
		background: #dc2626;
	}

	.tiebreak-card {
		background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(245, 158, 11, 0.1));
		border-color: rgba(251, 191, 36, 0.3);
	}

	.tiebreak-note {
		margin: 0 0 1.5rem;
		color: #92400e;
		font-weight: 500;
	}

	.tiebreak-form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.finalize-card {
		background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.1));
		border-color: rgba(34, 197, 94, 0.3);
		text-align: center;
	}

	.finalize-card p {
		margin: 0 0 1.5rem;
		color: #166534;
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.battle-header {
			flex-direction: column;
			gap: 1rem;
			align-items: flex-start;
		}

		.score-display {
			flex-direction: column;
			gap: 1rem;
		}

		.slot-matchup {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.vs-divider {
			order: 1;
		}

		.score-inputs {
			grid-template-columns: 1fr;
		}
	}
</style>
