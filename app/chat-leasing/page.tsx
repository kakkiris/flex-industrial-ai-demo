"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { parseVersion } from "@/lib/version";
import { VersionToggle } from "@/components/shared/VersionToggle";
import { VersionBanner } from "@/components/shared/VersionBanner";
import { ChatLeasingTabs } from "@/components/l1/ChatLeasingTabs";
import { ChatProposalView } from "@/components/l1/ChatProposalView";

function Body() {
  const version = parseVersion(useSearchParams().get("v"));
  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-end">
        <VersionToggle current={version} />
      </div>
      <VersionBanner
        version={version}
        proposalText={
          <>
            <strong>FlexOps AI&apos;s original proposal: a conversational qualification chatbot.</strong>{" "}
            The client warmed to it on the 4-Jun demo and sees practical use; viability depends on
            cost vs. website traffic.
            It is deployable beyond the site, on an email signature or for referral intake. Flip to
            &ldquo;Reframed&rdquo; for the structured-form qualification backend.
          </>
        }
        reframedText={
          <>
            <strong>Structured-form qualification backend</strong> (the version currently deployed).
            Flip to &ldquo;Our proposal&rdquo; to see the conversational chatbot the client warmed to
            on 4-Jun.
          </>
        }
      />
      {version === "proposal" ? <ChatProposalView /> : <ChatLeasingTabs />}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <Body />
    </Suspense>
  );
}
