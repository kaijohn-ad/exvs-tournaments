<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { invalidate } from '$app/navigation';
	import { browser } from '$app/environment';

	export let data: PageData;
	export let form: ActionData;

	let flashMessage = '';
	let flashVisible = false;

	type SlotFormState = {
		assignmentType: 'pair' | 'adhoc';
		pairId: string;
		player1Id: string;
		player2Id: string;
	};

	const createSlotState = (slot: PageData['slots'][number]): SlotFormState => ({
		assignmentType: slot.assignment_type,
		pairId: slot.pair_id ?? '',
		player1Id: slot.player1_id ?? '',
		player2Id: slot.player2_id ?? ''
	});

	const createSlotStates = (slots: PageData['slots']): Record<string, SlotFormState> => {
		const states: Record<string, SlotFormState> = {};
		for (const slot of slots) {
			states[slot.id] = createSlotState(slot);
		}
		return states;
	};

	const getSlotsSignature = (slots: PageData['slots']) =>
		slots
			.map(
				(slot) =>
					`${slot.id}:${slot.assignment_type}:${slot.pair_id ?? ''}:${slot.player1_id ?? ''}:${slot.player2_id ?? ''}`
			)
			.join('|');

	let slotStates: Record<string, SlotFormState> = createSlotStates(data.slots);
	let slotsSignature = getSlotsSignature(data.slots);

	$: {
		const nextSignature = getSlotsSignature(data.slots);
		if (nextSignature !== slotsSignature) {
			slotStates = createSlotStates(data.slots);
			slotsSignature = nextSignature;
		}
	}

	const updateSlotState = (slotId: string, patch: Partial<SlotFormState>) => {
		const current = slotStates[slotId];
		if (!current) return;

		slotStates = {
			...slotStates,
			[slotId]: {
				...current,
				...patch
			}
		};
	};

	const handleAssignmentTypeChange = (slotId: string, type: 'pair' | 'adhoc') => {
		const current = slotStates[slotId];
		if (!current) return;

		const patch: Partial<SlotFormState> = {
			assignmentType: type
		};

		if (type === 'pair') {
			patch.player1Id = '';
			patch.player2Id = '';
		} else {
			patch.pairId = '';
		}

		updateSlotState(slotId, patch);
	};

	const handlePairChange = (slotId: string, value: string) => {
		updateSlotState(slotId, { pairId: value });
	};

	const handlePlayerChange = (slotId: string, playerKey: 'player1Id' | 'player2Id', value: string) => {
		if (playerKey === 'player1Id') {
			updateSlotState(slotId, { player1Id: value });
		} else {
			updateSlotState(slotId, { player2Id: value });
		}
	};

	$: if (form?.type) {
		flashMessage = form.message || '';
		flashVisible = true;
		if (browser) {
			void invalidate(`lineup:${data.battleId}`);
		}
		setTimeout(() => {
			flashVisible = false;
		}, 4000);
	}

	function getPlayerName(playerId: string | undefined): string {
		if (!playerId) return '(未割当)';
		const player = data.players.find(p => p.id === playerId);
		return player?.name ?? '(Unknown)';
	}

	function getPairName(pairId: string | undefined): string {
		if (!pairId) return '(未割当)';
		const pair = data.pairs.find(p => p.id === pairId);
		if (!pair) return '(Unknown)';
		const p1 = getPlayerName(pair.player1_id);
		const p2 = getPlayerName(pair.player2_id);
		return `${p1} & ${p2}`;
	}

	function getTeamSlots(teamId: string) {
		return data.slots
			.filter(s => s.team_id === teamId)
			.sort((a, b) => a.slot_index - b.slot_index);
	}

	function canMoveUp(slot: any, teamId: string): boolean {
		const teamSlots = getTeamSlots(teamId);
		return slot.slot_index > 0;
	}

	function canMoveDown(slot: any, teamId: string): boolean {
		const teamSlots = getTeamSlots(teamId);
		return slot.slot_index < teamSlots.length - 1;
	}

	function canAddSlot(teamId: string): boolean {
		const teamSlots = getTeamSlots(teamId);
		return teamSlots.length < data.battle.slots_count;
	}
</script>

<svelte:head>
	<title>ラインナップ編集 | Boost Bracket Admin</title>
</svelte:head>

<section class="container">
	<header class="section-header">
		<h1>ラインナップ編集</h1>
		<p>
			団体戦: <strong>{data.teamA?.name ?? '(Unknown)'}</strong> vs <strong>{data.teamB?.name ?? '(Unknown)'}</strong>
		</p>
		<p class="meta">
			イベントID: <code>{data.eventId}</code> | 
			スロット数: <strong>{data.battle.slots_count}</strong>
		</p>
	</header>

	{#if flashVisible}
		<div class="flash-message" class:error={form?.type === 'error'}>
			{flashMessage}
		</div>
	{/if}

	<div class="teams-grid">
		{#if data.teamA}
			<section class="team-card">
				<div class="team-header">
					<h2>{data.teamA.name}</h2>
					{#if canAddSlot(data.teamA.id)}
						<form method="POST" action="?/addSlot">
							<input type="hidden" name="teamId" value={data.teamA.id} />
							<button type="submit" class="btn-add">+ スロット追加</button>
						</form>
					{/if}
				</div>

				<div class="slots-list">
					{#each getTeamSlots(data.teamA.id) as slot, idx}
						<div class="slot-card">
							<div class="slot-header">
								<span class="slot-number">スロット {idx + 1}</span>
								<div class="slot-actions">
									<form method="POST" action="?/moveSlot" style="display: inline;">
										<input type="hidden" name="slotId" value={slot.id} />
										<input type="hidden" name="direction" value="up" />
										<button 
											type="submit" 
											class="btn-icon" 
											disabled={!canMoveUp(slot, data.teamA.id)}
											title="上へ移動"
										>
											↑
										</button>
									</form>
									<form method="POST" action="?/moveSlot" style="display: inline;">
										<input type="hidden" name="slotId" value={slot.id} />
										<input type="hidden" name="direction" value="down" />
										<button 
											type="submit" 
											class="btn-icon" 
											disabled={!canMoveDown(slot, data.teamA.id)}
											title="下へ移動"
										>
											↓
										</button>
									</form>
									<form method="POST" action="?/deleteSlot" style="display: inline;">
										<input type="hidden" name="slotId" value={slot.id} />
										<button type="submit" class="btn-icon btn-delete" title="削除">
											🗑️
										</button>
									</form>
								</div>
							</div>

							<form method="POST" action="?/updateSlot" class="slot-form">
								<input type="hidden" name="slotId" value={slot.id} />
								
								<div class="form-group">
									<label>
										<input 
											type="radio" 
											name="assignmentType" 
											value="pair"
											checked={slotStates[slot.id].assignmentType === 'pair'}
											on:change={() => handleAssignmentTypeChange(slot.id, 'pair')}
										/>
										ペアから選択
									</label>
									<select 
										name="pairId" 
										disabled={slotStates[slot.id].assignmentType !== 'pair'}
										value={slotStates[slot.id].pairId}
										on:change={(event) =>
											handlePairChange(slot.id, (event.currentTarget as HTMLSelectElement).value)
										}
									>
										<option value="">-- ペアを選択 --</option>
										{#each data.pairs as pair}
											<option value={pair.id}>
												{getPairName(pair.id)}
											</option>
										{/each}
									</select>
								</div>

								<div class="form-group">
									<label>
										<input 
											type="radio" 
											name="assignmentType" 
											value="adhoc"
											checked={slotStates[slot.id].assignmentType === 'adhoc'}
											on:change={() => handleAssignmentTypeChange(slot.id, 'adhoc')}
										/>
										個別に選択
									</label>
									<div class="player-selects">
										<select 
											name="player1Id" 
											disabled={slotStates[slot.id].assignmentType !== 'adhoc'}
											value={slotStates[slot.id].player1Id}
											on:change={(event) =>
												handlePlayerChange(slot.id, 'player1Id', (event.currentTarget as HTMLSelectElement).value)
											}
										>
											<option value="">-- プレイヤー1 --</option>
											{#each data.players as player}
												<option value={player.id}>{player.name}</option>
											{/each}
										</select>
										<select 
											name="player2Id" 
											disabled={slotStates[slot.id].assignmentType !== 'adhoc'}
											value={slotStates[slot.id].player2Id}
											on:change={(event) =>
												handlePlayerChange(slot.id, 'player2Id', (event.currentTarget as HTMLSelectElement).value)
											}
										>
											<option value="">-- プレイヤー2 --</option>
											{#each data.players as player}
												<option value={player.id}>{player.name}</option>
											{/each}
										</select>
									</div>
								</div>

								<button type="submit" class="btn-update">更新</button>
							</form>

							<div class="slot-preview">
								{#if slotStates[slot.id].assignmentType === 'pair'}
									<strong>ペア:</strong> {getPairName(slotStates[slot.id].pairId)}
								{:else}
									<strong>個別:</strong> {getPlayerName(slotStates[slot.id].player1Id)} & {getPlayerName(slotStates[slot.id].player2Id)}
								{/if}
							</div>
						</div>
					{/each}

					{#if getTeamSlots(data.teamA.id).length === 0}
						<p class="empty">まだスロットが登録されていません。</p>
					{/if}
				</div>
			</section>
		{/if}

		{#if data.teamB}
			<section class="team-card">
				<div class="team-header">
					<h2>{data.teamB.name}</h2>
					{#if canAddSlot(data.teamB.id)}
						<form method="POST" action="?/addSlot">
							<input type="hidden" name="teamId" value={data.teamB.id} />
							<button type="submit" class="btn-add">+ スロット追加</button>
						</form>
					{/if}
				</div>

				<div class="slots-list">
					{#each getTeamSlots(data.teamB.id) as slot, idx}
						<div class="slot-card">
							<div class="slot-header">
								<span class="slot-number">スロット {idx + 1}</span>
								<div class="slot-actions">
									<form method="POST" action="?/moveSlot" style="display: inline;">
										<input type="hidden" name="slotId" value={slot.id} />
										<input type="hidden" name="direction" value="up" />
										<button 
											type="submit" 
											class="btn-icon" 
											disabled={!canMoveUp(slot, data.teamB.id)}
											title="上へ移動"
										>
											↑
										</button>
									</form>
									<form method="POST" action="?/moveSlot" style="display: inline;">
										<input type="hidden" name="slotId" value={slot.id} />
										<input type="hidden" name="direction" value="down" />
										<button 
											type="submit" 
											class="btn-icon" 
											disabled={!canMoveDown(slot, data.teamB.id)}
											title="下へ移動"
										>
											↓
										</button>
									</form>
									<form method="POST" action="?/deleteSlot" style="display: inline;">
										<input type="hidden" name="slotId" value={slot.id} />
										<button type="submit" class="btn-icon btn-delete" title="削除">
											🗑️
										</button>
									</form>
								</div>
							</div>

							<form method="POST" action="?/updateSlot" class="slot-form">
								<input type="hidden" name="slotId" value={slot.id} />
								
								<div class="form-group">
									<label>
										<input 
											type="radio" 
											name="assignmentType" 
											value="pair"
											checked={slotStates[slot.id].assignmentType === 'pair'}
											on:change={() => handleAssignmentTypeChange(slot.id, 'pair')}
										/>
										ペアから選択
									</label>
									<select 
										name="pairId" 
										disabled={slotStates[slot.id].assignmentType !== 'pair'}
										value={slotStates[slot.id].pairId}
										on:change={(event) =>
											handlePairChange(slot.id, (event.currentTarget as HTMLSelectElement).value)
										}
									>
										<option value="">-- ペアを選択 --</option>
										{#each data.pairs as pair}
											<option value={pair.id}>
												{getPairName(pair.id)}
											</option>
										{/each}
									</select>
								</div>

								<div class="form-group">
									<label>
										<input 
											type="radio" 
											name="assignmentType" 
											value="adhoc" 
											checked={slot.assignment_type === 'adhoc'}
										/>
										個別に選択
									</label>
									<div class="player-selects">
										<select 
											name="player1Id" 
											disabled={slot.assignment_type !== 'adhoc'}
											value={slot.player1_id ?? ''}
										>
											<option value="">-- プレイヤー1 --</option>
											{#each data.players as player}
												<option value={player.id}>{player.name}</option>
											{/each}
										</select>
										<select 
											name="player2Id" 
											disabled={slot.assignment_type !== 'adhoc'}
											value={slot.player2_id ?? ''}
										>
											<option value="">-- プレイヤー2 --</option>
											{#each data.players as player}
												<option value={player.id}>{player.name}</option>
											{/each}
										</select>
									</div>
								</div>

								<button type="submit" class="btn-update">更新</button>
							</form>

							<div class="slot-preview">
								{#if slot.assignment_type === 'pair'}
									<strong>ペア:</strong> {getPairName(slot.pair_id)}
								{:else}
									<strong>個別:</strong> {getPlayerName(slot.player1_id)} & {getPlayerName(slot.player2_id)}
								{/if}
							</div>
						</div>
					{/each}

					{#if getTeamSlots(data.teamB.id).length === 0}
						<p class="empty">まだスロットが登録されていません。</p>
					{/if}
				</div>
			</section>
		{/if}
	</div>

	<div class="back-link">
		<a href="/admin/events/{data.eventId}/team-battles">← 団体戦一覧に戻る</a>
	</div>
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
		margin: 0;
		font-size: 2rem;
	}

	.section-header p {
		margin: 0.5rem 0 0;
		color: #374151;
	}

	.section-header .meta {
		margin-top: 0.25rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.flash-message {
		padding: 1rem 1.25rem;
		background: #d1fae5;
		border: 1px solid #6ee7b7;
		border-radius: 0.75rem;
		color: #065f46;
		font-weight: 500;
	}

	.flash-message.error {
		background: #fee2e2;
		border-color: #fca5a5;
		color: #991b1b;
	}

	.teams-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
		gap: 2rem;
	}

	.team-card {
		background: white;
		border-radius: 1rem;
		padding: 1.75rem;
		box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.team-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid rgba(148, 163, 184, 0.2);
	}

	.team-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: #111827;
	}

	.btn-add {
		padding: 0.5rem 1rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.btn-add:hover {
		background: #2563eb;
	}

	.slots-list {
		display: grid;
		gap: 1.25rem;
	}

	.slot-card {
		background: rgba(248, 250, 252, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.75rem;
		padding: 1.25rem;
	}

	.slot-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.slot-number {
		font-weight: 600;
		color: #374151;
	}

	.slot-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-icon {
		background: rgba(148, 163, 184, 0.1);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 0.375rem;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.875rem;
	}

	.btn-icon:hover:not(:disabled) {
		background: rgba(148, 163, 184, 0.2);
		border-color: rgba(148, 163, 184, 0.5);
	}

	.btn-icon:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-delete {
		background: rgba(239, 68, 68, 0.1);
		border-color: rgba(239, 68, 68, 0.3);
	}

	.btn-delete:hover {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgba(239, 68, 68, 0.5);
	}

	.slot-form {
		display: grid;
		gap: 1rem;
	}

	.form-group {
		display: grid;
		gap: 0.5rem;
	}

	.form-group label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group select {
		padding: 0.5rem;
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 0.5rem;
		background: white;
		font-size: 0.875rem;
	}

	.form-group select:disabled {
		background: rgba(148, 163, 184, 0.05);
		cursor: not-allowed;
	}

	.player-selects {
		display: grid;
		gap: 0.5rem;
	}

	.btn-update {
		padding: 0.625rem 1.25rem;
		background: #10b981;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.btn-update:hover {
		background: #059669;
	}

	.slot-preview {
		margin-top: 1rem;
		padding: 0.75rem;
		background: rgba(99, 102, 241, 0.05);
		border: 1px solid rgba(99, 102, 241, 0.2);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		color: #4338ca;
	}

	.empty {
		margin: 1rem 0;
		color: #64748b;
		text-align: center;
	}

	.back-link {
		margin-top: 1rem;
	}

	.back-link a {
		color: #3b82f6;
		text-decoration: none;
		font-weight: 500;
	}

	.back-link a:hover {
		text-decoration: underline;
	}

	@media (max-width: 1024px) {
		.teams-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.team-header {
			flex-direction: column;
			gap: 1rem;
			align-items: flex-start;
		}
	}
</style>
