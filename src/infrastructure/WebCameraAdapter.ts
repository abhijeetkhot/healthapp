'use client'
import { err, ok, type Result } from '../core/Result'
import type { IImageCapture } from '../core/ports/IImageCapture'

// Browser-only. NOT instantiated by src/container.ts (which is server-only).
// PhotoCaptureFlow.tsx mounts its own video/canvas elements and calls the
// instance directly, passing them in via setSurface(). The IImageCapture
// port is preserved for symmetry with the future iOS NativeCameraAdapter,
// but in practice cameras need a render target — so this adapter takes the
// React-managed <video> element as a runtime dependency.

export interface CameraSurface {
  video: HTMLVideoElement
}

export class WebCameraAdapter implements IImageCapture {
  private surface: CameraSurface | null = null
  private stream: MediaStream | null = null

  setSurface(surface: CameraSurface | null): void {
    this.surface = surface
  }

  async capturePhoto(): Promise<Result<string>> {
    if (!this.surface) return err(new Error('Camera surface not mounted'))
    try {
      const stream = await this.startStream()
      this.surface.video.srcObject = stream
      await this.surface.video.play()

      // Wait one animation frame for the first video frame to land
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

      const { videoWidth, videoHeight } = this.surface.video
      const canvas = document.createElement('canvas')
      canvas.width = videoWidth
      canvas.height = videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        this.stopStream()
        return err(new Error('Canvas 2D context unavailable'))
      }
      ctx.drawImage(this.surface.video, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      this.stopStream()
      return ok(dataUrl)
    } catch (e) {
      this.stopStream()
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  async scanBarcode(): Promise<Result<string | null>> {
    // BarcodeDetector is not yet on the standard TS DOM lib, but ships in
    // Chromium-based browsers. Feature-detect and bail to manual entry.
    const Detector = (globalThis as { BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
    } }).BarcodeDetector
    if (!Detector) return ok(null)
    if (!this.surface) return err(new Error('Camera surface not mounted'))

    try {
      const stream = await this.startStream()
      this.surface.video.srcObject = stream
      await this.surface.video.play()
      const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })

      // Poll for up to ~10 seconds, one detect attempt per animation frame.
      const deadline = Date.now() + 10_000
      while (Date.now() < deadline) {
        const found = await detector.detect(this.surface.video)
        if (found.length > 0) {
          this.stopStream()
          return ok(found[0].rawValue)
        }
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
      }
      this.stopStream()
      return ok(null)
    } catch (e) {
      this.stopStream()
      return err(e instanceof Error ? e : new Error(String(e)))
    }
  }

  private async startStream(): Promise<MediaStream> {
    if (this.stream) return this.stream
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    })
    return this.stream
  }

  private stopStream(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop()
      this.stream = null
    }
    if (this.surface?.video) this.surface.video.srcObject = null
  }
}
