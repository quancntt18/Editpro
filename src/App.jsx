import { useEffect, useMemo, useState } from "react";

const LS_KEY = "GEMINI_API_KEY";

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [files, setFiles] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [outImg, setOutImg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const k = localStorage.getItem(LS_KEY);
    if (k) setApiKey(k);
  }, []);

  const previewUrls = useMemo(
    () => files.map((f) => URL.createObjectURL(f)),
    [files]
  );
  useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewUrls]);

  async function fileToBase64(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Đọc file thất bại"));
      reader.onload = () => {
        const result = reader.result;
        const comma = result.indexOf(",");
        resolve(result.slice(comma + 1));
      };
      reader.readAsDataURL(f);
    });
  }

  function onPickFiles(e) {
    setMsg("");
    setErr("");
    const arr = Array.from(e.target.files || []);
    const picked = arr.slice(0, 3);
    setFiles(picked);
    setOutImg(null);
    if (arr.length > 3)
      setMsg("Bạn đã chọn >3 ảnh, hệ thống chỉ lấy 3 ảnh đầu tiên.");
  }

  function saveKey() {
    if (!apiKey.trim()) {
      setErr("Vui lòng nhập API Key trước khi lưu.");
      return;
    }
    localStorage.setItem(LS_KEY, apiKey.trim());
    setMsg("Đã lưu API Key vào trình duyệt.");
  }

  function clearKey() {
    localStorage.removeItem(LS_KEY);
    setMsg("Đã xóa API Key khỏi trình duyệt.");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setOutImg(null);
    if (!apiKey) return setErr("Nhập API key.");
    if (files.length === 0) return setErr("Chọn 1–3 ảnh để chỉnh.");
    if (files.length > 3) return setErr("Chỉ hỗ trợ tối đa 3 ảnh.");
    if (!prompt.trim()) return setErr("Nhập mô tả yêu cầu chỉnh ảnh.");
    try {
      setLoading(true);
      const b64s = await Promise.all(files.map((f) => fileToBase64(f)));
      const model = "gemini-2.5-flash-image-preview";
      const parts = b64s.map((data, idx) => ({
        inline_data: { mime_type: files[idx]?.type || "image/png", data },
      }));
      parts.push({ text: prompt });
      const body = { contents: [{ parts }] };
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
      const json = await res.json();
      const partsOut = json?.candidates?.[0]?.content?.parts || [];
      const imgPart = partsOut.find((p) => p.inline_data || p.inlineData);
      const inline = imgPart?.inline_data || imgPart?.inlineData;
      if (!inline?.data) {
        const text = partsOut
          .map((p) => p.text)
          .filter(Boolean)
          .join("\n");
        throw new Error(text || "Không tìm thấy ảnh trong phản hồi.");
      }
      const mime = inline.mime_type || inline.mimeType || "image/png";
      setOutImg(`data:${mime};base64,${inline.data}`);
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="font-sans container mx-auto max-w-[980px] px-4 py-10 relative">
      <h1 className="text-2xl font-semibold mb-3">
        Nano Banana – Image Editor (Gemini)
      </h1>

      <form
        onSubmit={onSubmit}
        className="grid gap-3 p-4 border border-zinc-200 rounded-xl bg-white"
      >
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
          <label className="grid gap-1.5 text-sm">
            <span>API Key (Google AI Studio)</span>
            <input
              type="password"
              placeholder="AIza..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="text-sm px-3 py-2.5 rounded-lg border border-zinc-300 outline-none focus:border-black"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            onClick={saveKey}
            className="px-4 py-2.5 rounded-lg bg-black text-white disabled:opacity-60"
          >
            Lưu API Key
          </button>
          <button
            type="button"
            onClick={clearKey}
            className="px-4 py-2.5 rounded-lg border border-zinc-300 hover:bg-zinc-50"
          >
            Xóa Key đã lưu
          </button>
        </div>

        <label className="grid gap-1.5 text-sm">
          <span>Ảnh gốc (chọn 1–3 ảnh .jpg/.png)</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onPickFiles}
            className="text-sm px-3 py-2.5 rounded-lg border border-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm hover:file:bg-zinc-200"
          />
          <div className="text-xs text-zinc-500">
            Giới hạn: tối đa 3 ảnh / lần.
          </div>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span>Yêu cầu chỉnh ảnh (prompt)</span>
          <textarea
            rows={4}
            placeholder="VD: Gộp 3 ảnh thành bố cục lưới, nền trắng, tăng sáng, giữ chi tiết sản phẩm rõ."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="text-sm px-3 py-2.5 rounded-lg border border-zinc-300 outline-none focus:border-black resize-y"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2.5 rounded-lg bg-black text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : "Edit image"}
          </button>
          <div className="text-xs text-zinc-500">
            *API nhận đồng thời 1–3 ảnh trong một request.
          </div>
        </div>
      </form>

      {msg && (
        <div className="mt-3 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2.5 rounded-lg">
          {msg}
        </div>
      )}
      {err && (
        <div className="mt-3 text-red-700 bg-red-50 border border-red-200 px-3 py-2.5 rounded-lg whitespace-pre-wrap">
          {err}
        </div>
      )}

      <div className="mt-4 border border-zinc-200 rounded-xl overflow-hidden bg-white">
        <div className="px-3 py-2.5 border-b border-zinc-200 font-semibold">
          Xem trước ảnh (1–3)
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {previewUrls.length > 0 ? (
            previewUrls.map((u, i) => (
              <div
                key={i}
                className="relative w-full rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 aspect-square"
              >
                <img
                  src={u}
                  alt={`preview-${i}`}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            ))
          ) : (
            <div className="col-span-full w-full h-60 border-2 border-dashed border-zinc-300 rounded-xl grid place-items-center text-zinc-500 text-sm">
              Chưa chọn ảnh
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 border border-zinc-200 rounded-xl overflow-hidden bg-white">
        <div className="px-3 py-2.5 border-b border-zinc-200 font-semibold">
          Ảnh đã chỉnh (kết quả)
        </div>

        <div className="p-3 min-h-[280px] grid place-items-center gap-2">
          {outImg ? (
            <>
              <img
                src={outImg}
                alt="Edited"
                className="block max-w-full max-h-[70vh] object-contain rounded-xl border border-zinc-200 bg-zinc-50"
              />
              <a
                href={outImg}
                download="edited.png"
                className="inline-block mt-2 text-sm underline"
              >
                Tải ảnh về
              </a>
            </>
          ) : (
            <div className="w-full h-60 border-2 border-dashed border-zinc-300 rounded-xl grid place-items-center text-zinc-500 text-sm">
              Chưa có kết quả
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/70 grid place-items-center gap-2 text-lg z-[999]">
          <div className="w-9 h-9 border-4 border-zinc-300 border-t-black rounded-full animate-spin" />
          <div>Đang xử lý…</div>
        </div>
      )}
    </div>
  );
}