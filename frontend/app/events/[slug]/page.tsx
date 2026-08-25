import { EventGate } from "@/events/EventGate";

/**
 * Every event URL lands here. Which page it becomes — the hand-built one, the
 * archive view for a finished event, or a 404 — is decided by `EventGate`
 * once the event itself has loaded, because none of those can be told apart
 * from the slug alone.
 */
export default async function EventRoute({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  return <EventGate slug={slug} />;
}
