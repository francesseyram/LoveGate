import { notFound } from "next/navigation";
import { eventPages } from "@/events/registry";

export default async function EventRoute({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const Page = eventPages[slug];

  if (!Page) {
    notFound();
  }

  return <Page />;
}
