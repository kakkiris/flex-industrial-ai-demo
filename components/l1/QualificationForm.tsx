"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";

// The structured intake the Keystone leasing team's own form posts to the
// qualification engine. The conversational chat widget was retired (29-May
// client feedback); this five-field form is the front end now. On submit it
// POSTs to /api/leads, which runs the same KFP fit profile + verdict rubric the
// chat path used and matches the stated need against current vacant inventory.

type FormState = {
  location: string;
  spaceSizeSqft: string;
  businessType: string;
  businessName: string;
  additionalCriteria: string;
};

const EMPTY: FormState = {
  location: "",
  spaceSizeSqft: "",
  businessType: "",
  businessName: "",
  additionalCriteria: "",
};

type SubmitResponse = {
  data: {
    leadId: string;
    matchedUnits: Array<{ propertyName: string; submarket: string; suite: string }>;
  } | null;
  error: string | null;
};

export function QualificationForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  const submit = useMutation({
    mutationFn: async (state: FormState): Promise<SubmitResponse["data"]> => {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location: state.location.trim() || null,
          spaceSizeSqft: state.spaceSizeSqft.trim() ? Number(state.spaceSizeSqft) : null,
          businessType: state.businessType.trim() || null,
          businessName: state.businessName.trim() || null,
          additionalCriteria: state.additionalCriteria.trim() || null,
        }),
      });
      const json = (await res.json()) as SubmitResponse;
      if (!res.ok || !json.data) throw new Error(json.error ?? "Submission failed");
      return json.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      const matchCount = data?.matchedUnits.length ?? 0;
      toast.success(
        matchCount > 0
          ? `Submission received and routed to the Leasing team with ${matchCount} matching ${matchCount === 1 ? "unit" : "units"}.`
          : "Submission received and routed to the Leasing team.",
      );
      setForm(EMPTY);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    },
  });

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hasAny =
      form.location.trim() ||
      form.spaceSizeSqft.trim() ||
      form.businessType.trim() ||
      form.businessName.trim() ||
      form.additionalCriteria.trim();
    if (!hasAny) {
      toast.error("Fill in at least one field before submitting.");
      return;
    }
    submit.mutate(form);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leasing Inquiry Form</CardTitle>
        <CardDescription>
          The structured intake that replaces the chat widget. A prospect (or a
          leasing associate on their behalf) submits these five fields; the
          qualification engine returns a verdict and the matched available units.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="location">Location of interest</Label>
              <Input
                id="location"
                placeholder="Brightwater, Ashby Beach, Orrington..."
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                disabled={submit.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spaceSizeSqft">Square footage</Label>
              <Input
                id="spaceSizeSqft"
                type="number"
                min={0}
                placeholder="1800"
                value={form.spaceSizeSqft}
                onChange={(e) => update("spaceSizeSqft", e.target.value)}
                disabled={submit.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="businessType">Type of business</Label>
              <Input
                id="businessType"
                placeholder="HVAC contractor, distribution, cabinet shop..."
                value={form.businessType}
                onChange={(e) => update("businessType", e.target.value)}
                disabled={submit.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                placeholder="Brightline HVAC Services LLC"
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                disabled={submit.isPending}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="additionalCriteria">Additional criteria</Label>
            <Textarea
              id="additionalCriteria"
              placeholder="Timeline, lease term, loading needs, or anything else the leasing team should know."
              rows={3}
              value={form.additionalCriteria}
              onChange={(e) => update("additionalCriteria", e.target.value)}
              disabled={submit.isPending}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Qualifying...
                </>
              ) : (
                <>
                  <Send className="mr-1.5 size-4" />
                  Submit inquiry
                </>
              )}
            </Button>
            <p className="text-[11px] text-foreground-muted">
              Submits to the qualification engine and lands in the Leasing Team Inbox.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
