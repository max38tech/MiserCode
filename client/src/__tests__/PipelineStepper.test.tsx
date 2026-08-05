import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineStepper } from "../components/PipelineStepper";
import { makePhases } from "./testFixtures";

describe("PipelineStepper", () => {
  it("renders all three phases with their labels", () => {
    render(<PipelineStepper phases={makePhases()} />);
    expect(screen.getByText("Architect & Plan")).toBeInTheDocument();
    expect(screen.getByText("Bulk Coding")).toBeInTheDocument();
    expect(screen.getByText("Autonomous Testing & Fixes")).toBeInTheDocument();
  });

  it("reflects each phase's status via data attributes", () => {
    render(<PipelineStepper phases={makePhases()} />);
    expect(screen.getByTestId("phase-plan")).toHaveAttribute("data-status", "completed");
    expect(screen.getByTestId("phase-generate")).toHaveAttribute("data-status", "active");
    expect(screen.getByTestId("phase-verify")).toHaveAttribute("data-status", "pending");
  });

  it("marks a phase failed when its status is failed", () => {
    const phases = makePhases({
      generate: { id: "generate", label: "Bulk Coding", status: "failed", startedAt: 2, finishedAt: 3, exitCode: 1 },
    });
    render(<PipelineStepper phases={phases} />);
    expect(screen.getByTestId("phase-generate")).toHaveAttribute("data-status", "failed");
  });
});
