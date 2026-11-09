"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string; boundingBox: DOMRectReadOnly }[]>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
const scanOffsets = [0, -0.12, 0.12];

/**
 * Quét mã QR bằng camera sau của điện thoại / máy tính bảng.
 * Thử BarcodeDetector trước, rồi dùng jsQR nếu bộ đọc của trình duyệt chưa nhận được mã.
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
  const [photoError, setPhotoError] = useState("");
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
    setPhotoError("");
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
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (stopped) return;
        setStarting(false);

        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        let detector: BarcodeDetectorLike | null = null;
        try { detector = Detector ? new Detector({ formats: ["qr_code"] }) : null; } catch { detector = null; }
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        let scanIndex = 0;
        const centerDistance = (x: number, y: number) =>
          Math.hypot(x - video.videoWidth / 2, y - video.videoHeight / 2);
        const inTarget = (x: number, y: number) =>
          centerDistance(x, y) <= Math.min(video.videoWidth, video.videoHeight) * 0.14;
        const decodeFrame = (width: number, height: number, x = 0, y = 0) => {
          if (!ctx) return "";
          const scale = Math.min(1, 960 / Math.max(width, height));
          const scaledWidth = Math.round(width * scale);
          const scaledHeight = Math.round(height * scale);
          if (canvas.width !== scaledWidth) canvas.width = scaledWidth;
          if (canvas.height !== scaledHeight) canvas.height = scaledHeight;
          ctx.drawImage(video, x, y, width, height, 0, 0, scaledWidth, scaledHeight);
          const image = ctx.getImageData(0, 0, scaledWidth, scaledHeight);
          const result = jsQR(image.data, scaledWidth, scaledHeight, { inversionAttempts: "attemptBoth" });
          if (!result) return "";
          const { topLeftCorner, bottomRightCorner } = result.location;
          const centerX = x + (topLeftCorner.x + bottomRightCorner.x) * width / (2 * scaledWidth);
          const centerY = y + (topLeftCorner.y + bottomRightCorner.y) * height / (2 * scaledHeight);
          return inTarget(centerX, centerY) ? result.data : "";
        };

        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
              let text = "";
              if (detector) {
                try {
                  const found = await detector.detect(video);
                  const candidates = found.filter(({ rawValue, boundingBox: box }) =>
                    rawValue.trim() && box && inTarget(box.x + box.width / 2, box.y + box.height / 2));
                  candidates.sort((a, b) => {
                    const distance = ({ x, y, width, height }: DOMRectReadOnly) => centerDistance(x + width / 2, y + height / 2);
                    return distance(a.boundingBox) - distance(b.boundingBox);
                  });
                  text = candidates[0]?.rawValue ?? "";
                } catch {
                  detector = null;
                }
              }
              if (stopped) return;
              if (!text) {
                const { videoWidth: width, videoHeight: height } = video;
                const shortSide = Math.min(width, height);
                const side = Math.round(shortSide * 0.36);
                // Quét các vùng chồng lấn để tách những tem nằm sát nhau trên cùng tờ in.
                const index = scanIndex++ % (scanOffsets.length ** 2 + 1);
                if (index === scanOffsets.length ** 2) {
                  text = decodeFrame(width, height);
                } else {
                  const dx = scanOffsets[index % scanOffsets.length];
                  const dy = scanOffsets[Math.floor(index / scanOffsets.length)];
                  text = decodeFrame(side, side, (width - side) / 2 + dx * shortSide, (height - side) / 2 + dy * shortSide);
                }
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
        stream?.getTracks().forEach((t) => t.stop());
        if (stopped) return;
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

  async function scanPhoto(file: File) {
    const preview = videoRef.current;
    const url = URL.createObjectURL(file);
    setPhotoError("");
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (videoRef.current !== preview) return;
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
      if (result?.data) onResultRef.current(result.data);
      else setPhotoError("Không đọc được QR trong ảnh. Chụp rõ toàn bộ mã và phần viền trắng.");
    } catch {
      if (videoRef.current === preview) setPhotoError("Không mở được ảnh. Hãy chọn ảnh khác.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Quét mã QR vị trí hàn">
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5">
        <h3 className="text-base font-bold text-slate-900 sm:text-lg">Quét QR vị trí hàn</h3>
        <p className="mt-1 text-xs text-slate-600">Đặt tâm của tem cần quét vào dấu + và giữ yên. Nếu trên tờ có nhiều tem, di chuyển camera để chọn đúng tem.</p>
        <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-xl bg-slate-900">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="grid size-14 place-items-center rounded-lg border-2 border-white bg-black/15 text-2xl font-bold text-white">+</span>
          </div>
          {starting && <p className="absolute inset-0 flex items-center justify-center text-sm text-white">Đang mở camera…</p>}
        </div>
        {cameraError && <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">{cameraError}</p>}
        {photoError && <p role="alert" className="mt-2 text-xs text-amber-900">{photoError}</p>}
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
        <div className="mt-3 flex flex-wrap justify-between gap-2">
          <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 focus-within:ring-2 focus-within:ring-blue-600">
            Đọc QR từ ảnh
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void scanPhoto(file);
            }} />
          </label>
          <button type="button" onClick={onClose} className="h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Đóng</button>
        </div>
      </div>
    </div>
  );
}
