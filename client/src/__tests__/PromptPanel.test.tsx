import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptPanel } from "../components/PromptPanel";

describe("PromptPanel", () => {
  it("disables launch until a prompt is entered", () => {
    render(<PromptPanel isRunning={false} disabled={false} onLaunch={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /launch autonomous build/i })).toBeDisabled();
  });

  it("calls onLaunch with the trimmed prompt text on submit", async () => {
    const onLaunch = vi.fn();
    const user = userEvent.setup();
    render(<PromptPanel isRunning={false} disabled={false} onLaunch={onLaunch} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/describe the build task/i), "  Build a todo app  ");
    await user.click(screen.getByRole("button", { name: /launch autonomous build/i }));

    expect(onLaunch).toHaveBeenCalledWith("Build a todo app");
  });

  it("shows a cancel button and calls onCancel while running", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<PromptPanel isRunning disabled={false} onLaunch={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
