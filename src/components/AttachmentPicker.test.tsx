import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { render } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AttachmentPicker } from "./AttachmentPicker"
import type { UploadedAttachment } from "../lib/attachments"

const uploaded: UploadedAttachment = {
  id: "attachment-1",
  name: "notes.txt",
  mime: "text/plain",
  size: 12,
  kind: "text",
  createdAt: "2026-10-24T10:00:00.000Z",
}

function UploadHarness() {
  const [items, setItems] = useState<UploadedAttachment[]>([])
  return (
    <AttachmentPicker
      attachments={items}
      onChange={setItems}
      keep={false}
      onKeepChange={() => {}}
    />
  )
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ attachments: [uploaded] }),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("AttachmentPicker", () => {
  it("uploads a file and shows its name", async () => {
    render(<UploadHarness />)

    const file = new File(["Hello notes"], "notes.txt", { type: "text/plain" })
    fireEvent.change(screen.getByLabelText("Выбрать файлы"), {
      target: { files: [file] },
    })

    expect(await screen.findByText("notes.txt")).toBeInTheDocument()
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (entry) => String(entry[0]) === "/api/attachments",
    )
    expect(call?.[1]).toMatchObject({ method: "POST" })
    expect(call?.[1]?.body).toBeInstanceOf(FormData)
  })

  it("removes an uploaded attachment", async () => {
    const onChange = vi.fn()
    render(
      <AttachmentPicker
        attachments={[uploaded]}
        onChange={onChange}
        keep={false}
        onKeepChange={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Удалить notes.txt" }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([]))
    expect(fetch).toHaveBeenCalledWith(
      "/api/attachments/attachment-1",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("toggles the keep choice", () => {
    const onKeepChange = vi.fn()
    render(
      <AttachmentPicker
        attachments={[]}
        onChange={() => {}}
        keep={false}
        onKeepChange={onKeepChange}
        keepLabel="Сохранить исходники в курсе"
      />,
    )

    fireEvent.click(screen.getByRole("checkbox", { name: /Сохранить исходники/ }))
    expect(onKeepChange).toHaveBeenCalledWith(true)
  })
})
