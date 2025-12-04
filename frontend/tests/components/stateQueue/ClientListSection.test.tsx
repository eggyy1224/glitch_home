import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ClientListSection } from "../../../src/components/stateQueue/ClientListSection";
import type { ClientState } from "../../../src/types/admin";

const clients: ClientState[] = [
  {
    client_id: "c1",
    status: "online",
    last_heartbeat: "2024-01-01T00:00:00Z",
    queue_size: 1,
    current_item: { id: "item-1", type: "task", target_id: "x", status: "running" },
    errors: [],
  },
  {
    client_id: "c2",
    status: "offline",
    last_heartbeat: "2024-01-01T00:00:00Z",
    queue_size: 0,
    current_item: null,
    errors: ["oops"],
  },
];

describe("ClientListSection", () => {
  it("呈現 client 列表、摘要與操作按鈕", async () => {
    const user = userEvent.setup();
    const handlers = {
      onToggleActiveOnly: vi.fn(),
      onRefresh: vi.fn(),
      onSelectClient: vi.fn(),
    };

    render(
      <ClientListSection
        clients={clients}
        filteredClients={clients}
        selectedClient="c1"
        activeClient="c1"
        loadingState={false}
        showActiveOnly={false}
        message="已載入"
        {...handlers}
      />,
    );

    expect(screen.getByText("共 2 台")).toBeInTheDocument();
    expect(screen.getByText("目前操作 client：c1")).toBeInTheDocument();
    expect(screen.getByText("已載入")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "只看線上/idle" }));
    await user.click(screen.getByRole("button", { name: "重新整理" }));
    await user.click(screen.getByRole("button", { name: /c1/ }));

    expect(handlers.onToggleActiveOnly).toHaveBeenCalledTimes(1);
    expect(handlers.onRefresh).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectClient).toHaveBeenCalledWith("c1");
  });

  it("showActiveOnly 時顯示篩選數並處理空列表", () => {
    render(
      <ClientListSection
        clients={clients}
        filteredClients={[]}
        selectedClient=""
        activeClient=""
        loadingState={false}
        showActiveOnly
        message=""
        onToggleActiveOnly={vi.fn()}
        onRefresh={vi.fn()}
        onSelectClient={vi.fn()}
      />,
    );

    expect(screen.getByText("顯示 0/2 台 (線上/idle)")).toBeInTheDocument();
    expect(screen.getByText("尚無 client heartbeat")).toBeInTheDocument();
  });
});
