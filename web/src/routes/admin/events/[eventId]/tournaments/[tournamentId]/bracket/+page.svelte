
<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

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

	const playerNameById: Record<string, string> = {};
	for (const player of data.players) {
		playerNameById[player.id] = player.name;
	}

	const pairById: Record<string, (typeof data.pairs)[number]> = {};
	for (const pair of data.pairs) {
		pairById[pair.id] = pair;
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

	const matchDisplays = data.bracketMatches
		.map(toMatchDisplay)
		.sort((a, b) => {
			if (a.round === b.round) {
				return a.position - b.position;
			}
			return a.round - b.round;
		});

	const totalRounds = matchDisplays.reduce((max, match) => Math.max(max, match.round), 0);

	const getRoundName = (round: number): string => {
		if (!totalRounds) {
			return `ラウンド${round}`;
		}
		if (round === totalRounds) {
			return totalRounds === 1 ? '決勝' : '決勝';
		}
		if (round === totalRounds - 1 && totalRounds > 1) {
			return '準決勝';
		}
		if (round === totalRounds - 2 && totalRounds > 2) {
			return '準々決勝';
		}
		return `ラウンド${round}`;
	};

	const roundNumbers = Array.from(new Set(matchDisplays.map((match) => match.round))).sort((a, b) => a - b);

	const rounds = roundNumbers.map((round) => {
		const matches = matchDisplays.filter((match) => match.round === round);
		return {
			round,
			name: getRoundName(round),
			matches,
			gapFactor: Math.pow(2, round - 1)
		};
	});

	const totalMatches = matchDisplays.length;
	const completedMatches = matchDisplays.filter((match) => match.isCompleted).length;
	const inProgressMatches = matchDisplays.filter((match) => match.isInProgress).length;
	const pendingMatches = totalMatches - completedMatches - inProgressMatches;
	const progressPercent = totalMatches === 0 ? 0 : Math.round((completedMatches / totalMatches) * 100);

	const firstIncomplete = matchDisplays.find((match) => !match.isCompleted);
	const activeRound = firstIncomplete ? firstIncomplete.round : totalRounds;
	const activeRoundName = totalRounds === 0 ? '未開始' : getRoundName(activeRound || totalRounds);
</script>

<svelte:head>
	<title>{data.tournament.name} ブラケット | Boost Bracket Admin</title>
</svelte:head>

<section class="container">
	<header class="section-header">
		<div class="header-title">
			<h1>{data.tournament.name} ブラケット</h1>
			<p class="meta">イベントID: <code>{data.eventId}</code></p>
		</div>
		<nav class="header-actions">
			<a class="back-link" href="/admin/events/{data.eventId}/tournaments">← トーナメント設定に戻る</a>
		</nav>
	</header>

	<section class="card progress-card">
		<header class="card-header">
			<h2>進行状況</h2>
			<span class="badge active-round">現在: {activeRoundName}</span>
		</header>
		{#if totalMatches === 0}
			<p class="empty">ブラケットがまだ生成されていません。トーナメント設定からブラケットを作成してください。</p>
		{:else}
			<div class="progress-bar">
				<div class="progress-fill" style={`width: ${progressPercent}%`}></div>
			</div>
			<ul class="progress-metrics">
				<li>
					<span class="label">合計</span>
					<strong>{totalMatches}</strong>
				</li>
				<li>
					<span class="label">完了</span>
					<strong>{completedMatches}</strong>
				</li>
				<li>
					<span class="label">進行中</span>
					<strong>{inProgressMatches}</strong>
				</li>
				<li>
					<span class="label">未開始</span>
					<strong>{pendingMatches}</strong>
				</li>
			</ul>
			<p class="progress-summary">全{totalMatches}試合中{completedMatches}試合が完了しています。</p>
		{/if}
	</section>

	<section class="card bracket-card">
		<header class="card-header">
			<h2>トーナメント表</h2>
		</header>
		{#if rounds.length === 0}
			<p class="empty">表示できるブラケットがありません。</p>
		{:else}
			<div class="bracket-wrapper">
				<div class="bracket-grid">
					{#each rounds as round}
						<section class="round-column" style={`--gap-factor: ${round.gapFactor}`}
							data-round={round.round}>
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
											<span class="participant-score">{match.scoreALabel}</span>
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
											<span class="participant-score">{match.scoreBLabel}</span>
										</div>
										{#if match.isAutoAdvance}
											<p class="auto-advance">BYEのため自動勝ち上がり</p>
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
</section>

<style>
	:global(body) {
		background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%);
	}

	.container {
		max-width: 1200px;
		margin: 0 auto 4rem;
		padding: 2rem 1.75rem 3rem;
		display: grid;
		gap: 1.75rem;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.section-header h1 {
		margin: 0;
		font-size: 2rem;
		color: #0f172a;
	}

	.section-header .meta {
		margin: 0.5rem 0 0;
		color: #64748b;
	}

	.header-actions .back-link {
		color: #1d4ed8;
		text-decoration: none;
		font-weight: 600;
	}

	.card {
		background: #fff;
		border-radius: 1.1rem;
		padding: 1.5rem;
		box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.card-header h2 {
		margin: 0;
		font-size: 1.3rem;
		color: #111827;
	}

	.badge.active-round {
		background: rgba(59, 130, 246, 0.12);
		color: #1d4ed8;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.progress-card .empty {
		margin: 0;
		color: #64748b;
	}

	.progress-bar {
		position: relative;
		width: 100%;
		height: 0.65rem;
		background: rgba(148, 163, 184, 0.2);
		border-radius: 9999px;
		margin-bottom: 1rem;
		overflow: hidden;
	}

	.progress-fill {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		background: linear-gradient(90deg, #2563eb, #38bdf8);
		border-radius: 9999px;
		transition: width 0.3s ease;
	}

	.progress-metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.75rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.progress-metrics li {
		background: rgba(248, 250, 252, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 0.85rem;
		padding: 0.75rem 1rem;
		display: grid;
		gap: 0.35rem;
	}

	.progress-metrics .label {
		color: #64748b;
		font-size: 0.85rem;
	}

	.progress-metrics strong {
		font-size: 1.4rem;
		color: #0f172a;
	}

	.progress-summary {
		margin: 1rem 0 0;
		color: #475569;
		font-size: 0.95rem;
	}

	.bracket-wrapper {
		overflow-x: auto;
		padding-bottom: 0.5rem;
	}

	.bracket-grid {
		display: grid;
		grid-auto-flow: column;
		gap: 2.5rem;
		min-height: 400px;
		--row-gap: 1.6rem;
		padding-bottom: 0.5rem;
	}

	.round-column {
		display: flex;
		flex-direction: column;
		gap: calc(var(--row-gap) * var(--gap-factor));
		padding-top: calc((var(--gap-factor) - 1) * var(--row-gap) * 0.5);
		min-width: 240px;
	}

	.round-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		padding: 0 0.25rem;
		color: #1f2937;
	}

	.round-header h3 {
		margin: 0;
		font-size: 1.05rem;
	}

	.round-index {
		font-size: 0.85rem;
		color: #94a3b8;
	}

	.match-card {
		background: rgba(248, 250, 252, 0.9);
		border-radius: 1rem;
		border: 1px solid rgba(148, 163, 184, 0.35);
		padding: 1rem 1.1rem;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
		position: relative;
	}

	.match-card.completed {
		border-color: rgba(34, 197, 94, 0.4);
	}

	.match-card.in-progress {
		border-color: rgba(245, 158, 11, 0.45);
	}

	.match-card.pending {
		border-color: rgba(148, 163, 184, 0.35);
	}

	.match-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.match-seed {
		font-weight: 600;
		color: #475569;
	}

	.status-badge {
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.status-badge.status-completed {
		background: rgba(34, 197, 94, 0.15);
		color: #15803d;
	}

	.status-badge.status-in-progress {
		background: rgba(245, 158, 11, 0.15);
		color: #b45309;
	}

	.status-badge.status-pending {
		background: rgba(148, 163, 184, 0.2);
		color: #475569;
	}

	.status-badge.status-auto {
		background: rgba(59, 130, 246, 0.18);
		color: #1d4ed8;
	}

	.participant {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.7rem;
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.9);
		border: 1px solid rgba(148, 163, 184, 0.25);
	}

	.participant.winner {
		border-color: rgba(59, 130, 246, 0.45);
		box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.18);
	}

	.participant.loser {
		opacity: 0.65;
	}

	.participant.in-progress {
		border-color: rgba(245, 158, 11, 0.45);
	}

	.participant.bye,
	.participant.empty,
	.participant.unknown {
		background: rgba(241, 245, 249, 0.8);
		color: #475569;
	}

	.participant-info {
		display: grid;
		gap: 0.25rem;
	}

	.participant-names {
		font-weight: 600;
		color: #0f172a;
	}

	.participant-meta {
		font-size: 0.75rem;
		color: #64748b;
	}

	.participant-placeholder {
		font-weight: 600;
		color: #475569;
	}

	.participant-score {
		font-size: 1.15rem;
		font-weight: 700;
		color: #0f172a;
	}

	.auto-advance {
		margin: 0;
		padding: 0.35rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #1d4ed8;
		background: rgba(59, 130, 246, 0.12);
		border-radius: 0.6rem;
	}

	.empty {
		margin: 0;
		color: #64748b;
	}

	@media (max-width: 920px) {
		.section-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.bracket-grid {
			min-height: auto;
		}

		.round-column {
			min-width: min(240px, 80vw);
		}
	}
</style>
