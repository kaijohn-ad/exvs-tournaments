<script lang="ts">
	import type { PageData } from './$types';
	import { browser } from '$app/environment';
	import { invalidate } from '$app/navigation';
	import { onDestroy } from 'svelte';

	export let data: PageData;

	const refreshKey = `tournament-bracket:${data.eventId}:${data.tournamentId}`;
	const REFRESH_INTERVAL_MS = 5000;
	const refreshIntervalSeconds = Math.round(REFRESH_INTERVAL_MS / 1000);

	type ParticipantType = 'pair' | 'bye' | 'empty' | 'unknown';

	interface ParticipantDisplay {
		type: ParticipantType;
		label: string;
		playerNames: string[];
		seed: number | null;
		pairId: string | null;
	}

	interface MatchDisplay {
		id: string;
		round: number;
		position: number;
		status: string;
		winnerSide: 'a' | 'b' | null;
		scoreA: number | null;
		scoreB: number | null;
		scoreALabel: string;
		scoreBLabel: string;
		participantA: ParticipantDisplay;
		participantB: ParticipantDisplay;
		isCompleted: boolean;
		isInProgress: boolean;
		isPending: boolean;
		isAutoAdvance: boolean;
		statusLabel: string;
		statusClass: string;
		statusModifier: 'completed' | 'in-progress' | 'pending';
	}

	let playerNameById: Record<string, string> = {};
	$: {
		playerNameById = {};
		for (const player of data.players) {
			playerNameById[player.id] = player.name;
		}
	}

	let pairById: Record<string, (typeof data.pairs)[number]> = {};
	$: {
		pairById = {};
		for (const pair of data.pairs) {
			pairById[pair.id] = pair;
		}
	}

	const getPlayerName = (playerId: string | null | undefined): string => {
		if (!playerId) {
			return '(未登録)';
		}
		return playerNameById[playerId] ?? '(Unknown)';
	};

	const buildParticipant = (
		match: (typeof data.bracketMatches)[number],
		side: 'a' | 'b'
	): ParticipantDisplay => {
		const type = side === 'a' ? match.participant_a_type : match.participant_b_type;
		const pairId = side === 'a' ? match.participant_a_pair_id : match.participant_b_pair_id;

		if (type === 'bye') {
			return {
				type: 'bye',
				label: 'BYE',
				playerNames: [],
				seed: null,
				pairId: null
			};
		}

		if (!pairId) {
			return {
				type: 'empty',
				label: '未確定',
				playerNames: [],
				seed: null,
				pairId: null
			};
		}

		const pair = pairById[pairId];
		if (!pair) {
			return {
				type: 'unknown',
				label: 'ペア未登録',
				playerNames: [],
				seed: null,
				pairId
			};
		}

		const playerNames = [getPlayerName(pair.player1_id), getPlayerName(pair.player2_id)];

		return {
			type: 'pair',
			label: `${playerNames[0]} / ${playerNames[1]}`,
			playerNames,
			seed: pair.seed ?? null,
			pairId
		};
	};

	const getScoreLabel = (value: number | null | undefined): string => {
		return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
	};

	const getStatusLabel = (status: string, autoAdvance: boolean): string => {
		if (autoAdvance) {
			return '自動勝ち上がり';
		}
		switch (status) {
			case 'completed':
				return '完了';
			case 'in_progress':
				return '進行中';
			case 'pending':
			default:
				return '未開始';
		}
	};

	const getStatusClass = (status: string, autoAdvance: boolean): string => {
		if (autoAdvance) {
			return 'status-auto';
		}
		switch (status) {
			case 'completed':
				return 'status-completed';
			case 'in_progress':
				return 'status-in-progress';
			default:
				return 'status-pending';
		}
	};

	const toMatchDisplay = (match: (typeof data.bracketMatches)[number]): MatchDisplay => {
		const participantA = buildParticipant(match, 'a');
		const participantB = buildParticipant(match, 'b');
		const isInProgress = match.status === 'in_progress';
		const isCompleted = match.status === 'completed' || Boolean(match.winner_side);
		const isAutoAdvance = (
			isCompleted &&
			match.score_a == null &&
			match.score_b == null &&
			Boolean(match.winner_side) &&
			(participantA.type === 'bye' || participantB.type === 'bye')
		);

		return {
			id: match.id,
			round: match.round,
			position: match.position,
			status: match.status ?? 'pending',
			winnerSide: match.winner_side ?? null,
			scoreA: match.score_a ?? null,
			scoreB: match.score_b ?? null,
			scoreALabel: getScoreLabel(match.score_a),
			scoreBLabel: getScoreLabel(match.score_b),
			participantA,
			participantB,
			isCompleted,
			isInProgress,
			isPending: !isCompleted && !isInProgress,
			isAutoAdvance,
			statusLabel: getStatusLabel(match.status ?? 'pending', isAutoAdvance),
			statusClass: getStatusClass(match.status ?? 'pending', isAutoAdvance),
			statusModifier: isCompleted ? 'completed' : isInProgress ? 'in-progress' : 'pending'
		};
	};

	const getParticipantClasses = (match: MatchDisplay, side: 'a' | 'b'): string => {
		const participant = side === 'a' ? match.participantA : match.participantB;
		const classes: string[] = ['participant'];

		switch (participant.type) {
			case 'bye':
				classes.push('bye');
				break;
			case 'empty':
				classes.push('empty');
				break;
			case 'unknown':
				classes.push('unknown');
				break;
		}

		if (match.isCompleted && match.winnerSide === side) {
			classes.push('winner');
		} else if (match.isCompleted && match.winnerSide && match.winnerSide !== side) {
			classes.push('loser');
		} else if (match.isInProgress) {
			classes.push('in-progress');
		}

		return classes.join(' ');
	};

	let matchDisplays: MatchDisplay[] = [];
	let roundNumbers: number[] = [];
	let rounds: { round: number; name: string; matches: MatchDisplay[]; gapFactor: number }[] = [];
	let totalMatches = 0;
	let completedMatches = 0;
	let inProgressMatches = 0;
	let pendingMatches = 0;
	let progressPercent = 0;
	let firstIncomplete: MatchDisplay | undefined;
	let totalRounds = 0;
	let activeRound = 0;
	let activeRoundName = '未開始';

	const getRoundName = (round: number, total: number): string => {
		if (!total) {
			return `ラウンド${round}`;
		}
		if (round === total) {
			return total === 1 ? '決勝' : '決勝';
		}
		if (round === total - 1 && total > 1) {
			return '準決勝';
		}
		if (round === total - 2 && total > 2) {
			return '準々決勝';
		}
		return `ラウンド${round}`;
	};

	$: matchDisplays = data.bracketMatches
		.map(toMatchDisplay)
		.sort((a, b) => (a.round === b.round ? a.position - b.position : a.round - b.round));

	$: roundNumbers = Array.from(new Set(matchDisplays.map((match) => match.round))).sort((a, b) => a - b);

	$: {
		const computedTotalRounds = matchDisplays.reduce((max, match) => Math.max(max, match.round), 0);
		totalRounds = computedTotalRounds;
		rounds = roundNumbers.map((round) => {
			const matches = matchDisplays.filter((match) => match.round === round);
			return {
				round,
				name: getRoundName(round, computedTotalRounds),
				matches,
				gapFactor: Math.pow(2, round - 1)
			};
		});
		firstIncomplete = matchDisplays.find((match) => !match.isCompleted);
		totalMatches = matchDisplays.length;
		completedMatches = matchDisplays.filter((match) => match.isCompleted).length;
		inProgressMatches = matchDisplays.filter((match) => match.isInProgress).length;
		pendingMatches = totalMatches - completedMatches - inProgressMatches;
		progressPercent = totalMatches === 0 ? 0 : Math.round((completedMatches / totalMatches) * 100);
		activeRound = firstIncomplete ? firstIncomplete.round : computedTotalRounds;
		activeRoundName = computedTotalRounds === 0 ? '未開始' : getRoundName(activeRound || computedTotalRounds, computedTotalRounds);
	}

	const formatTimestamp = (iso: string): string => {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) {
			return iso;
		}
		return new Intl.DateTimeFormat('ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).format(date);
	};

	$: lastUpdatedLabel = formatTimestamp(data.loadedAt);

	let autoRefreshEnabled = true;
	let refreshTimer: ReturnType<typeof setInterval> | null = null;

	const stopAutoRefresh = () => {
		if (refreshTimer) {
			clearInterval(refreshTimer);
			refreshTimer = null;
		}
	};

	const startAutoRefresh = () => {
		if (!browser || refreshTimer || !autoRefreshEnabled) {
			return;
		}
		refreshTimer = setInterval(() => {
			void invalidate(refreshKey);
		}, REFRESH_INTERVAL_MS);
	};

	$: {
		if (browser) {
			stopAutoRefresh();
			if (autoRefreshEnabled) {
				startAutoRefresh();
			}
		}
	}

	onDestroy(() => {
		stopAutoRefresh();
	});

	const refresh = async () => {
		stopAutoRefresh();
		await invalidate(refreshKey);
		if (autoRefreshEnabled) {
			startAutoRefresh();
		}
	};
</script>

<svelte:head>
	<title>{data.tournament.name} | トーナメント表 | Boost Bracket</title>
	<meta name="description" content={`${data.event.name} / ${data.tournament.name} の試合進行状況`} />
</svelte:head>

<section class="page">
	<header class="page-header">
		<div class="page-title">
			<h1>{data.tournament.name}</h1>
			<p class="event-name">イベント: {data.event.name}</p>
			<p class="timestamp">最終更新: {lastUpdatedLabel}</p>
		</div>
		<div class="page-actions">
			<button class="refresh" type="button" on:click={refresh}>最新の状態に更新</button>
			<label class="auto-refresh">
				<input type="checkbox" bind:checked={autoRefreshEnabled} />
				<span>自動更新</span>
			</label>
		</div>
	</header>

	<section class="card progress-card">
		<header class="card-header">
			<h2>進行状況</h2>
			<span class="badge">現在: {activeRoundName}</span>
		</header>
		{#if totalMatches === 0}
			<p class="empty">ブラケットがまだ生成されていません。運営側にお問い合わせください。</p>
		{:else}
			<div class="progress-bar">
				<div class="progress-fill" style={`width: ${progressPercent}%`}></div>
			</div>
			<ul class="progress-metrics">
				<li><span>合計</span><strong>{totalMatches}</strong></li>
				<li><span>完了</span><strong>{completedMatches}</strong></li>
				<li><span>進行中</span><strong>{inProgressMatches}</strong></li>
				<li><span>未開始</span><strong>{pendingMatches}</strong></li>
			</ul>
			<p class="progress-summary">全{totalMatches}試合中{completedMatches}試合が完了しています。</p>
		{/if}
	</section>

	<section class="card bracket-card">
		<header class="card-header">
			<h2>トーナメント表</h2>
			<p class="card-sub">横スクロールで全ラウンドを表示できます。</p>
		</header>
		{#if rounds.length === 0}
			<p class="empty">表示できるブラケットがありません。</p>
		{:else}
			<div class="bracket-wrapper">
				<div class="bracket-grid">
					{#each rounds as round}
						<section class="round-column" style={`--gap-factor: ${round.gapFactor}`} data-round={round.round}>
							<header class="round-header">
								<h3>{round.name}</h3>
								<span class="round-index">R{round.round}</span>
							</header>
							{#if round.matches.length === 0}
								<p class="round-empty">マッチが設定されていません。</p>
							{:else}
								{#each round.matches as match}
									<article class={`match-card ${match.statusModifier}`}>
										<header class="match-header">
											<span class="match-seed">#{match.position}</span>
											<span class={`status-badge ${match.statusClass}`}>{match.statusLabel}</span>
										</header>
										<div class={getParticipantClasses(match, 'a')}>
											<div class="participant-info">
												{#if match.participantA.type === 'pair'}
													<div class="participant-names">{match.participantA.playerNames[0]} / {match.participantA.playerNames[1]}</div>
													{#if match.participantA.seed != null}
														<span class="participant-meta">シード {match.participantA.seed}</span>
													{/if}
												{:else}
													<span class="participant-placeholder">{match.participantA.label}</span>
												{/if}
											</div>
											<span class="score">{match.scoreALabel}</span>
										</div>
										<div class={getParticipantClasses(match, 'b')}>
											<div class="participant-info">
												{#if match.participantB.type === 'pair'}
													<div class="participant-names">{match.participantB.playerNames[0]} / {match.participantB.playerNames[1]}</div>
													{#if match.participantB.seed != null}
														<span class="participant-meta">シード {match.participantB.seed}</span>
													{/if}
												{:else}
													<span class="participant-placeholder">{match.participantB.label}</span>
												{/if}
											</div>
											<span class="score">{match.scoreBLabel}</span>
										</div>
										{#if match.isCompleted && !match.isAutoAdvance}
											<footer class="match-footer">
												<strong>勝者:</strong>
												<span>{match.winnerSide === 'a' ? match.participantA.label : match.participantB.label}</span>
											</footer>
										{:else if match.isAutoAdvance}
											<footer class="match-footer auto-advance">
												<span>BYEのため自動勝ち上がり</span>
											</footer>
										{/if}
									</article>
								{/each}
							{/if}
						</section>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	<section class="card notes-card">
		<header class="card-header">
			<h2>観戦メモ</h2>
		</header>
		<ul>
			<li>スコアが未入力の試合はハイフン表示になります。</li>
			<li>表示は約{refreshIntervalSeconds}秒ごとに自動更新されます（手動で変更可能）。</li>
		</ul>
	</section>
</section>

<style>
	:global(body) {
		background: #0f1115;
		color: #f5f6fa;
		font-family: 'Inter', 'Noto Sans JP', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.page {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding: 1.5rem;
		max-width: 1100px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.page-title h1 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
	}

	.event-name {
		margin: 0.25rem 0 0.2rem;
		font-size: 0.95rem;
		color: #c8cdd8;
	}

	.timestamp {
		margin: 0;
		font-size: 0.85rem;
		color: #8d94a5;
	}

	.page-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	button.refresh {
		appearance: none;
		background: #2d6cdf;
		border: none;
		border-radius: 999px;
		color: #fff;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 600;
		padding: 0.55rem 1.4rem;
		transition: background 0.2s ease;
	}

	button.refresh:hover {
		background: #2255b0;
	}

	.auto-refresh {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
		color: #d2d7e5;
	}

	.auto-refresh input {
		accent-color: #2d6cdf;
		width: 1.05rem;
		height: 1.05rem;
	}

	.card {
		background: rgba(22, 24, 28, 0.92);
		border-radius: 1rem;
		padding: 1.5rem;
		box-shadow: 0 14px 35px rgba(0, 0, 0, 0.35);
		backdrop-filter: blur(18px);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.card-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.badge {
		background: rgba(45, 108, 223, 0.18);
		border: 1px solid rgba(45, 108, 223, 0.5);
		border-radius: 999px;
		padding: 0.25rem 0.75rem;
		font-size: 0.85rem;
		color: #b9cbff;
	}

	.progress-bar {
		position: relative;
		height: 0.6rem;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #2d6cdf, #4d94ff);
		transition: width 0.3s ease;
	}

	.progress-metrics {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 0.75rem;
		margin: 1rem 0 0;
		padding: 0;
		font-size: 0.95rem;
	}

	.progress-metrics li {
		background: rgba(255, 255, 255, 0.04);
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.progress-metrics span {
		color: #9aa4b9;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.progress-metrics strong {
		font-size: 1.25rem;
		font-weight: 700;
		color: #e9ecf5;
	}

	.progress-summary {
		margin: 1rem 0 0;
		color: #b7bfd1;
		font-size: 0.95rem;
	}

	.empty {
		margin: 0;
		color: #b0b8c9;
	}

	.card-sub {
		margin: 0;
		color: #8e94a8;
		font-size: 0.9rem;
	}

	.bracket-wrapper {
		overflow-x: auto;
		padding-bottom: 1rem;
		margin: 0 -1.5rem -1.5rem;
		padding-left: 1.5rem;
		padding-right: 1.5rem;
	}

	.bracket-grid {
		display: grid;
		gap: 1.5rem;
		grid-auto-flow: column;
	}

	.round-column {
		display: flex;
		flex-direction: column;
		gap: calc(0.75rem * var(--gap-factor));
		min-width: minmax(220px, 24vw);
	}

	.round-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.round-header h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.round-index {
		font-size: 0.8rem;
		color: #8d94a5;
	}

	.match-card {
		background: rgba(24, 26, 31, 0.92);
		border-radius: 0.9rem;
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		border: 1px solid transparent;
	}

	.match-card.in-progress {
		border-color: rgba(77, 148, 255, 0.5);
	}

	.match-card.completed {
		border-color: rgba(73, 201, 110, 0.45);
	}

	.match-card.pending {
		border-color: rgba(255, 255, 255, 0.08);
	}

	.match-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.match-seed {
		font-weight: 600;
		color: #cbd5ff;
	}

	.status-badge {
		border-radius: 999px;
		padding: 0.2rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.status-pending {
		background: rgba(255, 255, 255, 0.06);
		color: #d1d5e6;
	}

	.status-in-progress {
		background: rgba(77, 148, 255, 0.18);
		color: #bcd7ff;
	}

	.status-completed {
		background: rgba(73, 201, 110, 0.2);
		color: #b7f5cc;
	}

	.status-auto {
		background: rgba(247, 181, 0, 0.2);
		color: #ffe6a3;
	}

	.participant {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.55rem 0.6rem;
		border-radius: 0.65rem;
		background: rgba(255, 255, 255, 0.04);
	}

	.participant.winner {
		background: rgba(73, 201, 110, 0.16);
		border: 1px solid rgba(73, 201, 110, 0.3);
	}

	.participant.loser {
		opacity: 0.55;
	}

	.participant.bye,
	.participant.empty,
	.participant.unknown {
		font-style: italic;
		color: #9da5b8;
	}

	.participant.in-progress {
		border: 1px solid rgba(77, 148, 255, 0.55);
	}

	.participant-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.participant-names {
		font-weight: 600;
		color: #e8ebf4;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.participant-meta {
		font-size: 0.75rem;
		color: #9ea7bc;
	}

	.participant-placeholder {
		color: #a8b0c3;
	}

	.score {
		font-size: 1.1rem;
		font-weight: 700;
		color: #f0f3ff;
	}

	.match-footer {
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		padding-top: 0.6rem;
		font-size: 0.85rem;
		color: #bdc6dc;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.match-footer.auto-advance {
		color: #f5d67a;
	}

	.notes-card ul {
		margin: 0;
		padding-left: 1.2rem;
		color: #c5cbdb;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	@media (max-width: 840px) {
		.page {
			padding: 1.2rem;
		}
		.page-header {
			align-items: flex-start;
		}
		.page-actions {
			width: 100%;
			justify-content: space-between;
		}
		.card {
			padding: 1.25rem;
		}
	}

	@media (max-width: 640px) {
		.page {
			gap: 1.5rem;
		}
		.page-title h1 {
			font-size: 1.6rem;
		}
		.page-actions {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}
		.bracket-grid {
			grid-auto-flow: row;
			grid-template-columns: 1fr;
		}
		.round-column {
			min-width: 100%;
			gap: 1rem;
		}
		.participant {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.35rem;
		}
		.score {
			align-self: flex-end;
		}
	}
</style>
