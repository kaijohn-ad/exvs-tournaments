import type { ActionData } from './$types';

export const getInvalidateResource = (eventId: string): string => `team-battles:${eventId}`;

export const shouldInvalidateTeamBattles = (
	form: ActionData | undefined,
	isBrowser: boolean
): boolean => Boolean(form?.success && isBrowser);

