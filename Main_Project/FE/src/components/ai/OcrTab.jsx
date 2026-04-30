import { useEffect, useRef, useState } from "react";
import { Camera, FileImage, ImagePlus, Loader2, Plus, UploadCloud, X } from "lucide-react";
import { ocrReceipt } from "../../api/financeApi";

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

export default function OcrTab({ onPrefillTransaction }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);

  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Chỉ hỗ trợ file ảnh (jpg, png, webp...)");
      return;
    }
    stopCamera();
    setSelectedFile(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setResult(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const removeFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraStarting(false);
  };

  useEffect(() => () => stopCamera(), []);

  const openFilePicker = (event) => {
    event?.stopPropagation();
    fileInputRef.current?.click();
  };

  const openCamera = async (event) => {
    event?.stopPropagation();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt không hỗ trợ camera. Vui lòng chọn ảnh có sẵn.");
      return;
    }

    stopCamera();
    setError(null);
    setCameraOpen(true);
    setCameraStarting(true);

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setError("Không mở được camera. Hãy kiểm tra quyền truy cập camera hoặc chọn ảnh có sẵn.");
      setCameraOpen(false);
    } finally {
      setCameraStarting(false);
    }
  };

  const captureCameraImage = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Camera chưa sẵn sàng. Vui lòng thử lại sau vài giây.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Không chụp được ảnh từ camera. Vui lòng thử lại.");
          return;
        }

        const file = new File([blob], `hoa-don-camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        handleFile(file);
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  const handleScan = async () => {
    if (!selectedFile || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await ocrReceipt(selectedFile);
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Không đọc được hóa đơn. Vui lòng thử ảnh khác.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTransaction = () => {
    if (!result || !onPrefillTransaction) return;
    onPrefillTransaction({
      amount: result.amount,
      note: result.note || (result.vendor ? `Hóa đơn ${result.vendor}` : "Từ hóa đơn OCR"),
      suggested_category: result.suggested_category,
      transacted_at: result.transacted_at || result.date,
      type: result.type || "expense",
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Chụp hoặc tải ảnh hóa đơn để trích xuất thông tin rồi mở form giao dịch để kiểm tra lại.
      </p>

      {!selectedFile ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-400 hover:bg-teal-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Camera className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800">Dùng camera</span>
              <span className="mt-0.5 block text-xs text-slate-500">Hỗ trợ webcam laptop và camera điện thoại</span>
            </span>
          </button>
          <button
            type="button"
            onClick={openFilePicker}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <ImagePlus className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800">Chọn ảnh có sẵn</span>
              <span className="mt-0.5 block text-xs text-slate-500">Mở ảnh hóa đơn từ thiết bị</span>
            </span>
          </button>
        </div>
      ) : null}

      {cameraOpen ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="overflow-hidden rounded-xl bg-slate-900">
            {cameraStarting ? (
              <div className="flex aspect-video items-center justify-center gap-2 text-sm text-white">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang mở camera...
              </div>
            ) : null}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`aspect-video w-full object-cover ${cameraStarting ? "hidden" : "block"}`}
            />
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Hủy camera
            </button>
            <button
              type="button"
              onClick={captureCameraImage}
              disabled={cameraStarting}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              <Camera className="h-4 w-4" />
              Chụp hóa đơn
            </button>
          </div>
        </div>
      ) : null}

      {/* Upload zone */}
      {!selectedFile ? (
        <div
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center transition hover:border-teal-400 hover:bg-teal-50"
        >
          <UploadCloud className="h-10 w-10 text-slate-400" />
          <div>
            <p className="font-medium text-slate-700">Kéo thả hoặc nhấn để chọn ảnh</p>
            <p className="mt-1 text-xs text-slate-400">JPG, PNG, WEBP — tối đa 10MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <img
              src={previewUrl}
              alt="Hóa đơn"
              className="h-28 w-28 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FileImage className="h-4 w-4 text-teal-600" />
                  <span className="truncate">{selectedFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
              <button
                type="button"
                onClick={handleScan}
                disabled={isLoading}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang đọc hóa đơn...
                  </>
                ) : (
                  "Quét hóa đơn"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </div>
      )}

      {/* Kết quả OCR */}
      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-800">Kết quả phân tích</h3>
          <div className="space-y-2.5">
            <InfoRow label="Cửa hàng / Vendor" value={result.vendor} />
            <InfoRow
              label="Tổng tiền"
              value={
                result.amount
                  ? `${Number(result.amount).toLocaleString("vi-VN")} đ`
                  : null
              }
            />
            <InfoRow label="Ngày" value={result.date} />
            <InfoRow label="Danh mục gợi ý" value={result.suggested_category} />
            <InfoRow label="Ghi chú gợi ý" value={result.note} />
          </div>

          {result.line_items?.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Chi tiết mặt hàng
              </p>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {result.line_items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-slate-700">{item.description || item.text || `Mục ${i + 1}`}</span>
                    <span className="font-medium text-slate-800">
                      {item.total != null
                        ? `${Number(item.total).toLocaleString("vi-VN")} đ`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {onPrefillTransaction && (
            <button
              type="button"
              onClick={handleAddTransaction}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-100"
            >
              <Plus className="h-4 w-4" />
              Mở form giao dịch từ hóa đơn này
            </button>
          )}
        </div>
      )}
    </div>
  );
}
