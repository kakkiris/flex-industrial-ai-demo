// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { VersionBanner } from "@/components/shared/VersionBanner";

afterEach(cleanup);

describe("VersionBanner", () => {
  it("renders the provided proposalText for the proposal version", () => {
    render(<VersionBanner version="proposal" proposalText="SENTINEL_PROPOSAL" />);
    expect(screen.getByText("SENTINEL_PROPOSAL")).toBeInTheDocument();
  });

  it("falls back to the default reframed copy when no override is passed", () => {
    render(<VersionBanner version="reframed" />);
    expect(screen.getByText(/Reframed/)).toBeInTheDocument();
  });
});
