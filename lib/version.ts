export type DemoVersion = "proposal" | "reframed";

// Default to the shipped (reframed) version unless the caller explicitly asks
// for the original proposal. Pure so it is trivially testable.
export function parseVersion(v: string | null | undefined): DemoVersion {
  return v === "proposal" ? "proposal" : "reframed";
}
