<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData | null | undefined;

	let importPayload = form?.payload ?? '';
	let downloadUrl: string | null = null;
	let tournaments = data.tournaments;
	let editorMode = false;
	let editorPayload = form?.payload ?? data.tournamentsJson;
	let editorError: string | null = null;
	let flashTimer: ReturnType<typeof setTimeout> | null = null;
	let flashVisible = false;
	let generatingTournamentId: string | null = null;

	const importExample = JSON.stringify(
		[
			{ name: 'Spring Tournament', format: 'single-elimination', seedingMode: 'random' },
			{ id: 'custom-id', name: 'Summer Championship', seedingMode: 'manual' }
		],
		null,
		2
	);

	const revokeUrl = () => {
		if (downloadUrl) {
			URL.revokeObjectURL(downloadUrl);
			downloadUrl = null;
		}
	};

	$: {
		revokeUrl();
		const blob = new Blob([data.tournamentsJson], { type: 'application/json' });
		downloadUrl = URL.createObjectURL(blob);
	}

	$: if (form?.tournaments) {
		tournaments = form.tournaments;
	}

	$: if (form?.tournamentsJson) {
		const blob = new Blob([form.tournamentsJson], { type: 'application/json' });
		revokeUrl();
		downloadUrl = URL.createObjectURL(blob);
	}

	$: if (form?.type) {
		flashVisible = true;
		if (flashTimer) clearTimeout(flashTimer);
		flashTimer = setTimeout(() => {
			flashVisible = false;
			flashTimer = null;
		}, 4000);
	}

	$: if (flashVisible === false && flashTimer) {
		clearTimeout(flashTimer);
		flashTimer = null;
	}

	onDestroy(() => {
		revokeUrl();
		if (flashTimer) {
			clearTimeout(flashTimer);
		}
	});

	const resetEditor = () => {
		editorPayload = data.tournamentsJson;
		editorError = null;
	};

	const validateEditorPayload = () => {
		try {
			editorError = null;
			JSON.parse(editorPayload);
		} catch (error) {
			editorError = 'JSONの形式が正しくありません。';
		}
	};

	$: if (form?.source === 'generate') {
		generatingTournamentId = null;
	}
</script>

<svelte:head>
	<title>トーナメント設定 | Boost Bracket Admin</title>
</svelte:head>

<section class="container">
	<header class="section-header">
		<div class="section-header__titles">
			<h1>トーナメント設定</h1>
			<p>イベントID: <code>{data?.eventId ?? '(unknown)'}</code></p>
		</div>
		<nav class="section-header__actions">
			<a class="back-link" href={`/admin/events/${data.eventId}`}>← イベント詳細に戻る</a>
		</nav>
	</header>

	<section class="card">
		<h2>トーナメントを作成</h2>
		{#if flashVisible && form?.type === 'error' && form?.source === 'create'}
			<div class={`flash ${form.type}`}>{form.message}</div>
		{/if}
		<form method="POST" action="?/create" class="stack">
			<label>
				<span>トーナメント名 <span class="required">*</span></span>
				<input name="name" required placeholder="例: 春季大会" />
			</label>

			<label>
				<span>形式</span>
				<select name="format">
					<option value="single-elimination">シングルエリミネーション</option>
				</select>
			</label>

			<label>
				<span>シード方式</span>
				<select name="seedingMode">
					<option value="random">ランダム</option>
					<option value="manual">手動</option>
				</select>
			</label>

			<div class="actions">
				<button type="submit" class="primary">作成</button>
			</div>
		</form>
	</section>

	<section class="card">
		<h2>登録済みトーナメント ({tournaments.length})</h2>
		{#if flashVisible && form?.message && form?.type === 'success' && form?.source !== 'editor'}
			<div class={`flash ${form.type}`}>{form.message}</div>
		{/if}

		{#if tournaments.length === 0}
			<p class="empty">まだトーナメントが作成されていません。</p>
		{:else}
			<ul class="list">
				{#each tournaments as tournament}
					<li class="tournament-item">
						<div class="tournament-card">
								<form method="POST" action="?/update" class="tournament-form">
								<input type="hidden" name="tournamentId" value={tournament.id} />

								<label>
									<span>トーナメント名</span>
									<input name="name" value={tournament.name} required />
								</label>

								<label>
									<span>形式</span>
									<select name="format" bind:value={tournament.format}>
										<option value="single-elimination">シングルエリミネーション</option>
									</select>
								</label>

								<label>
									<span>シード方式</span>
									<select name="seedingMode" bind:value={tournament.seedingMode}>
										<option value="random">ランダム</option>
										<option value="manual">手動</option>
									</select>
								</label>

								<div class="meta">
									<span class="meta-item">作成日時: {new Date(tournament.createdAt).toLocaleString('ja-JP')}</span>
								</div>

								<div class="form-actions">
									<button type="submit" class="secondary">更新</button>
								</div>
							</form>

							<div class="row-actions">
								<a
									class="button-link"
									href={`/admin/events/${data.eventId}/tournaments/${tournament.id}/bracket`}
								>
									ブラケットを見る
								</a>
								<form
									method="POST"
									action="?/generate"
									class="generate-form"
									on:submit={() => {
										generatingTournamentId = tournament.id;
									}}
								>
									<input type="hidden" name="tournamentId" value={tournament.id} />
									<select name="seedingMode" aria-label="シード方式を選択" bind:value={tournament.seedingMode}>
										<option value="random">ランダムで生成</option>
										<option value="manual">手動シードで生成</option>
									</select>
									<button
										type="submit"
										class={`secondary ${generatingTournamentId === tournament.id ? 'loading' : ''}`}
										disabled={generatingTournamentId !== null}
									>
										{generatingTournamentId === tournament.id ? '生成中…' : 'ブラケット生成'}
									</button>
								</form>
								<form
									method="POST"
									action="?/delete"
									class="delete-form"
									on:submit={(event) => {
										if (!confirm('削除しますか？')) {
											event.preventDefault();
										}
									}}
								>
									<input type="hidden" name="tournamentId" value={tournament.id} />
									<button type="submit" class="danger">削除</button>
								</form>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="card import-export">
		<h2>インポート / エクスポート</h2>
		<div class="export">
			<h3>エクスポート</h3>
			<textarea readonly rows="8">{data.tournamentsJson}</textarea>
			<a class="secondary" download={`tournaments-${data.eventId}.json`} href={downloadUrl ?? undefined}
				>JSONをダウンロード</a
			>
		</div>
		<div class="import">
			<h3>インポート</h3>
			{#if flashVisible && form?.type === 'error' && form?.source === 'import'}
				<div class={`flash ${form.type}`}>{form.message}</div>
			{/if}
			<form method="POST" action="?/import" class="import-form">
				<label>
					<span>JSONデータ</span>
					<textarea
						name="payload"
						rows="8"
						bind:value={importPayload}
						placeholder={importExample}
					></textarea>
				</label>
				<div class="actions">
					<button type="submit" class="primary">取り込み</button>
				</div>
			</form>
			<p class="helper">※ 空行や無効なエントリはスキップされます。既存トーナメントは上書きされます。</p>
		</div>
	</section>

	<section class="card">
		<header class="editor-header">
			<div>
				<h2>JSONエディタで編集</h2>
				<p>直接JSONを編集し、上書き保存できます。</p>
			</div>
			<div class="editor-actions">
				<button type="button" class={`ghost ${editorMode ? 'active' : ''}`} on:click={() => {
					editorMode = !editorMode;
					if (!editorMode) {
						resetEditor();
					}
				}}>
					{editorMode ? '閉じる' : 'JSONエディタを開く'}
				</button>
			</div>
		</header>

		{#if editorMode}
			{#if flashVisible && form?.type === 'error' && form?.source === 'editor'}
				<div class={`flash ${form.type}`}>{form.message}</div>
			{/if}

			<div class={`editor-container ${editorError ? 'error' : ''}`}>
				<textarea
					rows="14"
					bind:value={editorPayload}
					on:input={validateEditorPayload}
				></textarea>
			</div>
			{#if editorError}
				<p class="error-text">⚠️ {editorError}</p>
			{/if}

			<form method="POST" action="?/import" class="editor-form">
				<input type="hidden" name="mode" value="editor" />
				<input type="hidden" name="payload" value={editorPayload} />
				<div class="editor-buttons">
					<button type="button" class="ghost" on:click={resetEditor}>元に戻す</button>
					<button type="submit" class="primary" disabled={Boolean(editorError)}>
						JSONを保存
					</button>
				</div>
			</form>
		{/if}
	</section>
</section>

<style>
	.container {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		display: grid;
		gap: 2rem;
	}

	.section-header h1 {
		margin: 0;
		font-size: 2rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.section-header__titles {
		display: grid;
		gap: 0.25rem;
	}

	.section-header__actions {
		display: flex;
		align-items: center;
	}

	.back-link {
		font-weight: 600;
		color: #1d4ed8;
		text-decoration: none;
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		border: 1px solid rgba(59, 130, 246, 0.25);
		background: rgba(59, 130, 246, 0.12);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.back-link:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18);
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

	textarea {
		resize: vertical;
		min-height: 3rem;
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

	.button-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.55rem 1.25rem;
		border-radius: 9999px;
		font-weight: 600;
		text-decoration: none;
		background: rgba(59, 130, 246, 0.12);
		color: #1d4ed8;
		border: 1px solid rgba(59, 130, 246, 0.2);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.button-link:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 18px rgba(37, 99, 235, 0.2);
	}

	button.primary {
		background: linear-gradient(135deg, #2563eb, #5940ff);
		color: white;
	}

	button.secondary {
		background: rgba(37, 99, 235, 0.1);
		color: #1d4ed8;
	}

	button.danger {
		background: rgba(220, 38, 38, 0.12);
		color: #b91c1c;
	}

	button.danger:hover {
		box-shadow: 0 10px 20px rgba(220, 38, 38, 0.2);
	}

	.required {
		color: #dc2626;
		font-size: 0.9em;
	}

	.empty {
		margin: 0.5rem 0;
		color: #64748b;
	}

	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 1rem;
	}

	.tournament-item {
		padding: 1rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(248, 250, 252, 0.6);
	}

	.tournament-form {
		display: grid;
		gap: 1rem;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: 0.9rem;
		color: #64748b;
		padding: 0.5rem 0;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
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

	.editor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.editor-header h2 {
		margin: 0;
	}

	.editor-header p {
		margin: 0.3rem 0 0;
		color: #64748b;
	}

	.editor-actions {
		display: flex;
		gap: 0.75rem;
	}

	.editor-container textarea {
		width: 100%;
		font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			'Liberation Mono', 'Courier New', monospace;
		font-size: 0.95rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: rgba(248, 250, 252, 0.8);
	}

	.editor-container.error textarea {
		border-color: rgba(248, 113, 113, 0.6);
		box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.15);
	}

	.editor-form {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.editor-buttons {
		display: flex;
		gap: 0.75rem;
	}

	button.ghost.active {
		background: rgba(37, 99, 235, 0.18);
		color: #1d4ed8;
	}

	.error-text {
		margin: 0.75rem 0 0;
		color: #b91c1c;
		font-weight: 600;
	}

	.import-export {
		display: grid;
		gap: 1.5rem;
	}

	.import-export h3 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}

	.export,
	.import {
		display: grid;
		gap: 0.75rem;
	}

	.import textarea,
	.export textarea {
		font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
			'Liberation Mono', 'Courier New', monospace;
		font-size: 0.95rem;
	}

	.import-form {
		display: grid;
		gap: 1rem;
	}

	.helper {
		margin: 0;
		color: #475569;
		font-size: 0.9rem;
	}

	@media (max-width: 640px) {
		.container {
			padding: 1.5rem 1rem 3rem;
		}

		.row-actions {
			flex-direction: column;
			align-items: stretch;
		}

		button {
			width: 100%;
		}

		.import-export {
			grid-template-columns: 1fr;
		}

		.editor-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.editor-form {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
