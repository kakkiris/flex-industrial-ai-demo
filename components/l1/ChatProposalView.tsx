"use client";

import { KeystoneMockSite } from "@/components/l1/KeystoneMockSite";
import { ChatWidget } from "@/components/l1/ChatWidget";

// The original conversational lead-qualification experience, inside the mock
// mock company-website chrome, exactly as proposed before the form reframe.
// KeystoneMockSite requires a `featured` property list; passing an empty
// array mirrors what the restored chat route does (no DB fetch needed here).
export function ChatProposalView() {
  return (
    <div className="relative flex-1 min-h-0 overflow-auto rounded-md border border-border">
      <KeystoneMockSite featured={[]} />
      <ChatWidget />
    </div>
  );
}
