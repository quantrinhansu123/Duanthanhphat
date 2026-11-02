"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

/**
 * Quét mã QR bằng camera sau của điện thoại / máy tính bảng.
 * Dùng BarcodeDetector của trình duyệt khi có (Chrome, Android), không có (iPhone Safari…) thì giải mã bằng jsQR.
 * Luôn có ô nhập tay — dùng khi không mở được camera, hoặc với máy quét cầm tay (gõ mã rồi Enter).
 */
export default function QrScanDialog({
  open,
  onClose,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  /** Nhận nội dung QR (hoặc mã gõ tay). Hộp thoại do nơi gọi đóng. */
  onResult: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState("");
  const [starting, setStarting] = useState(false);
  const [manual, setManual] = useState("");
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    setCameraError("");
    setManual("");

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          window.isSecureContext
            ? "Trình duyệt này không hỗ trợ mở camera. Nhập mã vào ô bên dưới."
            : "Cần mở trang bằng HTTPS để dùng camera. Tạm thời nhập mã vào ô bên dưới.",
        );
        return;
      }
      setStarting(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        setStarting(false);

        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        let detector: BarcodeDetectorLike | null = null;
        try { detector = Detector ? new Detector({ formats: ["qr_code"] }) : null; } catch { detector = null; }
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2 && video.videoWidth > 0) {
              let text = "";
              if (detector) {
                const found = await detector.detect(video);
                text = found[0]?.rawValue ?? "";
              } else if (ctx) {
                const scale = Math.min(1, 640 / video.videoWidth);
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
                text = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data ?? "";
              }
              if (text) {
                stopped = true;
                onResultRef.current(text);
                return;
              }
            }
          } catch {
            /* khung hình lỗi → thử lại khung sau */
          }
          timer = window.setTimeout(tick, 150);
        };
        void tick();
      } catch (error) {
        setStarting(false);
        const name = error instanceof DOMException ? error.name : "";
        setCameraError(
          name === "NotAllowedError"
            ? "Chưa cho phép dùng camera. Cấp quyền camera cho trang này rồi mở lại, hoặc nhập mã bên dưới."
            : name === "NotFoundError"
              ? "Không tìm thấy camera trên thiết bị này. Nhập mã vào ô bên dưới."
              : "Không mở được camera. Nhập mã vào ô bên dưới.",
        );
      }
    }
    void start();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Quét mã QR vị trí hàn">
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5">
        <h3 className="text-base font-bold text-slate-900 sm:text-lg">Quét QR vị trí hàn</h3>
        <p className="mt-1 text-xs text-slate-600">Đưa mã QR trên ray vào khung. Hệ thống đọc mã Lisp (HT/HP/TT/TP) rồi tự điền các thông số còn lại.</p>
        <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-xl bg-slate-900">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-white/80" aria-hidden />
          {starting && <p className="absolute inset-0 flex items-center justify-center text-sm text-white">Đang mở camera…</p>}
        </div>
        {cameraError && <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">{cameraError}</p>}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (manual.trim()) onResult(manual.trim());
          }}
        >
          <input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Hoặc gõ / dùng máy quét: HT0001"
            autoComplete="off"
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20"
          />
          <button type="submit" disabled={!manual.trim()} className="h-10 cursor-pointer rounded-lg bg-[#0047AB] px-4 text-sm font-semibold text-white hover:bg-[#00388A] disabled:cursor-not-allowed disabled:opacity-50">Dùng mã</button>
        </form>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={onClose} className="h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Đóng</button>
        </div>
      </div>
    </div>
  );
}
