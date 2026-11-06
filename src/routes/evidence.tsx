import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, LedgerMini } from "@/components/tl/ui";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/evidence")({
  head: () => meta("Evidence & Model Settings", "Evidence & Model Settings module of the Threadline Command digital twin."),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="11 · Evidence & Model Settings" title="Evidence & Model Settings" subtitle="This module is next in the build queue." />
      <Panel title="Coming next"><p className="text-sm text-muted-foreground">The full interactive version of this page has not been built yet.</p></Panel>
      <LedgerMini />
    </div>
  );
}
