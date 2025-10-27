import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const slug = params.slug;
	
	
	return {
		slug,
		eventName: 'Sample Event',
		tournaments: [],
		message: 'Public view implementation in progress'
	};
};
