"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QualificationForm } from "./QualificationForm";
import { LeadInbox } from "./LeadInbox";
import { WorkflowChangePanel } from "@/components/shared/WorkflowChangePanel";

export function ChatLeasingTabs() {
  return (
    <div className="p-8">
      <header className="mb-5">
        <h1 className="text-2xl font-medium tracking-[-0.015em] text-foreground mb-1.5">
          Website Lead Qualification
        </h1>
        <p className="text-sm text-foreground-muted leading-relaxed max-w-2xl">
          Submit the structured leasing inquiry form to qualify a prospect, then switch to the Leasing Team Inbox tab to see the lead land with verdict, confidence, reasoning, and the matched available units.
        </p>
      </header>

      <div className="mb-5">
        <WorkflowChangePanel
          withDemoLabel="With L1"
          today="Inbound prospects email the leasing inbox or fill the website contact form with one or two lines (name, phone, email, message). The leasing team trades messages back and forth to extract size, location, business type, and timing. Half the leads stall before the second reply; the inbox has no prioritization and no match to available space."
          withDemo="A structured qualification form on the company website captures the must-have fields up front (location, square footage, business type and name) plus an open criteria field. Every submission runs through the qualification engine and produces a lead with verdict, confidence, and reasoning, and is matched against current vacant inventory. The leasing inbox sorts review-priority first, shows the matched units, and lets staff override the verdict, schedule a visit, or call back with one click."
        />
      </div>

      <Tabs defaultValue="form">
        <TabsList className="mb-4">
          <TabsTrigger value="form">Inquiry Form</TabsTrigger>
          <TabsTrigger value="inbox">Leasing Team Inbox</TabsTrigger>
        </TabsList>

        <TabsContent value="form">
          <QualificationForm />
        </TabsContent>

        <TabsContent value="inbox">
          <LeadInbox />
        </TabsContent>
      </Tabs>
    </div>
  );
}
