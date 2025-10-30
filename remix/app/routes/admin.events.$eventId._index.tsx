import { redirect, type LoaderFunctionArgs } from "@remix-run/cloudflare";

export async function loader({ params }: LoaderFunctionArgs) {
	const eventId = params.eventId;
	if (!eventId) {
		throw new Response("Event ID is required", { status: 400 });
	}

	return redirect(`/admin/events/${eventId}/participants`);
}

