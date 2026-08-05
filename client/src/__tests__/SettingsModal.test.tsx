import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsModal } from "../components/SettingsModal";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("SettingsModal", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders nothing when closed", () => {
    // Never resolves: the point of this test is the closed render path,
    // and letting a real fetch response land later would trigger a state
    // update after the test has already finished asserting.
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<SettingsModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows 'no key configured' status when none is set", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ geminiApiKeyConfigured: false, geminiApiKeyPreview: null, workDir: "/work" })
    );
    render(<SettingsModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("settings-status")).toHaveTextContent(/no key configured/i);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/settings");
  });

  it("shows the masked preview when a key is already configured", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ geminiApiKeyConfigured: true, geminiApiKeyPreview: "AIza••••1234", workDir: "/work" })
    );
    render(<SettingsModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("settings-status")).toHaveTextContent("AIza••••1234");
    });
  });

  it("saves a new key via PUT and shows a confirmation", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (!init) {
        return Promise.resolve(
          jsonResponse({ geminiApiKeyConfigured: false, geminiApiKeyPreview: null, workDir: "/work" })
        );
      }
      return Promise.resolve(
        jsonResponse({ ok: true, geminiApiKeyConfigured: true, geminiApiKeyPreview: "AIza••••wxyz" })
      );
    });

    const user = userEvent.setup();
    render(<SettingsModal open onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText(/gemini api key/i)).toBeEnabled());

    await user.type(screen.getByPlaceholderText(/paste a new gemini api key/i), "new-secret-key-wxyz");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText(/saved — takes effect immediately/i)).toBeInTheDocument();
    });

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(putCall).toBeDefined();
    expect(JSON.parse((putCall![1] as RequestInit).body as string)).toEqual({
      geminiApiKey: "new-secret-key-wxyz",
    });
  });

  it("disables the clear button when no key is configured", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ geminiApiKeyConfigured: false, geminiApiKeyPreview: null, workDir: "/work" })
    );
    render(<SettingsModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clear saved key/i })).toBeDisabled();
    });
  });

  it("calls onClose when Escape is pressed", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ geminiApiKeyConfigured: false, geminiApiKeyPreview: null, workDir: "/work" })
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SettingsModal open onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
