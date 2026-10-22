import { useCallback, useEffect, useRef, useState } from "react"
import { CircleAlert, LoaderCircle, Play, RotateCcw, Square } from "lucide-react"
import {
  createLoveRuntime,
  type LoveCommand,
  type LoveRuntime,
} from "./love-runtime"
import "./LovePreview.css"

const WIDTH = 800
const HEIGHT = 450

function cssColor(color: [number, number, number, number]): string {
  const [r, g, b, a] = color
  return `rgba(${Math.round(Math.min(1, r) * 255)}, ${Math.round(Math.min(1, g) * 255)}, ${Math.round(Math.min(1, b) * 255)}, ${a ?? 1})`
}

export function drawCommands(ctx: CanvasRenderingContext2D, commands: LoveCommand[]) {
  ctx.save()
  ctx.fillStyle = "#0b1511"
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  for (const command of commands) {
    if (command.kind === "clear") {
      ctx.fillStyle = cssColor(command.color)
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
    } else if (command.kind === "rect") {
      ctx.fillStyle = cssColor(command.color)
      ctx.strokeStyle = cssColor(command.color)
      ctx.lineWidth = 2
      if (command.mode === "line") ctx.strokeRect(command.x, command.y, command.w, command.h)
      else ctx.fillRect(command.x, command.y, command.w, command.h)
    } else if (command.kind === "circle") {
      ctx.beginPath()
      ctx.arc(command.x, command.y, Math.max(0, command.r), 0, Math.PI * 2)
      ctx.fillStyle = cssColor(command.color)
      ctx.strokeStyle = cssColor(command.color)
      ctx.lineWidth = 2
      if (command.mode === "line") ctx.stroke()
      else ctx.fill()
    } else if (command.kind === "line") {
      if (command.points.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(command.points[0], command.points[1])
      for (let i = 2; i + 1 < command.points.length; i += 2) {
        ctx.lineTo(command.points[i], command.points[i + 1])
      }
      ctx.strokeStyle = cssColor(command.color)
      ctx.lineWidth = 2
      ctx.stroke()
    } else if (command.kind === "print") {
      ctx.fillStyle = cssColor(command.color)
      ctx.font = "14px 'JetBrains Mono Variable', monospace"
      ctx.fillText(command.text, command.x, command.y + 14)
    }
  }
  ctx.restore()
}

function loveKey(key: string): string {
  if (key === " ") return "space"
  if (key === "ArrowLeft") return "left"
  if (key === "ArrowRight") return "right"
  if (key === "ArrowUp") return "up"
  if (key === "ArrowDown") return "down"
  if (key === "Escape") return "escape"
  if (key === "Enter") return "return"
  return key.toLowerCase()
}

export function LovePreview({
  files,
  entry,
}: {
  files: Array<{ name: string; content: string }>
  entry: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<LoveRuntime | null>(null)
  const rafRef = useRef<number | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    runtimeRef.current?.dispose()
    runtimeRef.current = null
    setStatus("idle")
  }, [])

  const start = useCallback(async () => {
    stop()
    setError(null)
    setStatus("loading")
    try {
      const runtime = await createLoveRuntime(files, entry)
      runtimeRef.current = runtime
      setStatus("running")
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (!ctx) throw new Error("canvas_not_available")
      let previous = performance.now()
      const tick = async (now: number) => {
        if (!runtimeRef.current) return
        const dt = Math.min(0.05, (now - previous) / 1000)
        previous = now
        try {
          const commands = await runtime.frame(dt)
          drawCommands(ctx, commands)
          rafRef.current = requestAnimationFrame((time) => void tick(time))
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
          setStatus("error")
          runtimeRef.current?.dispose()
          runtimeRef.current = null
        }
      }
      rafRef.current = requestAnimationFrame((time) => void tick(time))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus("error")
    }
  }, [entry, files, stop])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      runtimeRef.current?.dispose()
    }
  }, [])

  return (
    <section className="love-preview" aria-label="Предпросмотр LÖVE">
      <div className="love-preview__head">
        <div className="love-preview__title">
          <span className="love-badge">LÖVE</span>
          <span>Предпросмотр</span>
          <small>подмножество API</small>
        </div>
        <div className="love-preview__actions">
          {status === "running" ? (
            <button type="button" onClick={stop} className="love-stop">
              <Square size={11} aria-hidden /> остановить
            </button>
          ) : (
            <button type="button" onClick={() => void start()} className="love-start" disabled={status === "loading"}>
              {status === "loading" ? <LoaderCircle size={12} className="spin" aria-hidden /> : <Play size={12} aria-hidden />}
              {status === "loading" ? "запускаем" : "запустить"}
            </button>
          )}
          <button type="button" onClick={() => void start()} className="love-restart" title="Перезапустить">
            <RotateCcw size={11} aria-hidden />
          </button>
        </div>
      </div>

      <div className="love-stage">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          tabIndex={0}
          aria-label="Холст LÖVE"
          onKeyDown={(event) => {
            const runtime = runtimeRef.current
            if (!runtime) return
            event.preventDefault()
            void runtime.keypressed(loveKey(event.key))
          }}
        />
        {status === "idle" && (
          <div className="love-idle">
            <span>Нажми «запустить», чтобы увидеть окно LÖVE.</span>
          </div>
        )}
        {status === "error" && (
          <div className="love-error">
            <CircleAlert size={14} aria-hidden />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="love-preview__foot">
        <span>Не полный движок: предпросмотр поддерживает фигуры, цвет, текст и update/draw.</span>
        <span>Для полной версии поставь love2d.org</span>
      </div>
    </section>
  )
}
