import { describe, expect, it } from "vitest"
import {
  directSupportsImages,
  supportsImagesFromModels,
} from "./model-support"

describe("attachment model support", () => {
  it("reads OpenCode image capabilities from the model catalog", () => {
    const models = [
      {
        providerID: "opencode-go",
        modelID: "deepseek-v4.1-flash",
        input: ["text", "image"],
      },
      {
        providerID: "opencode-go",
        modelID: "deepseek-v4-pro",
        input: ["text"],
      },
    ]

    expect(supportsImagesFromModels("opencode-go/deepseek-v4.1-flash", models)).toBe(true)
    expect(supportsImagesFromModels("opencode-go/deepseek-v4-pro", models)).toBe(false)
    expect(supportsImagesFromModels("opencode-go/unknown", models)).toBe(false)
  })

  it("knows which direct providers accept images", () => {
    expect(directSupportsImages("deepseek")).toBe(false)
    expect(directSupportsImages("openai")).toBe(true)
    expect(directSupportsImages("anthropic")).toBe(true)
    expect(directSupportsImages("google")).toBe(true)
    expect(directSupportsImages("custom")).toBe(true)
  })
})
