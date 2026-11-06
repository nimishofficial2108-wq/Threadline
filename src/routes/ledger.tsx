import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, LedgerMini } from "@/components/tl/ui";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/ledger")({
  head: () => meta("ChainTrust Ledger", "ChainTrust Ledger module of the Threadline Command digital twin."),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="12 · ChainTrust Ledger" title="ChainTrust Ledger" subtitle="This module is next in the build queue." />
      <Panel title="Coming next"><p className="text-sm text-muted-foreground">The full interactive version of this page has not been built yet.</p></Panel>
      <LedgerMini />
    </div>
  );
}
