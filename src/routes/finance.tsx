import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, LedgerMini } from "@/components/tl/ui";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/finance")({
  head: () => meta("Financial Intelligence", "Financial Intelligence module of the Threadline Command digital twin."),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="08 · Financial Intelligence" title="Financial Intelligence" subtitle="This module is next in the build queue." />
      <Panel title="Coming next"><p className="text-sm text-muted-foreground">The full interactive version of this page has not been built yet.</p></Panel>
      <LedgerMini />
    </div>
  );
}
