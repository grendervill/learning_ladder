export type AttachmentKind = "image" | "pdf" | "document" | "text"

export interface UploadFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

export interface AttachmentMeta {
  id: string
  name: string
  storedName: string
  mime: string
  size: number
  kind: AttachmentKind
  createdAt: string
  textFile?: string
  warning?: string
}

export interface StoredAttachment extends AttachmentMeta {
  dir: string
  path: string
  text?: string
}

export interface ModelAttachment {
  kind: "image" | "pdf"
  name: string
  mime: string
  path: string
}

export class AttachmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "AttachmentError"
  }
}
