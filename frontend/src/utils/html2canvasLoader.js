let html2canvasPromise = null;

export function ensureHtml2Canvas() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("瀏覽器環境才支援截圖"));
  }
  if (window.html2canvas) {
    return Promise.resolve(window.html2canvas);
  }
  if (html2canvasPromise) {
    return html2canvasPromise;
  }

  html2canvasPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.async = true;
    script.onload = () => {
      if (window.html2canvas) {
        resolve(window.html2canvas);
      } else {
        html2canvasPromise = null;
        reject(new Error("載入截圖模組失敗"));
      }
    };
    script.onerror = () => {
      html2canvasPromise = null;
      reject(new Error("下載 html2canvas 失敗"));
    };
    document.head.appendChild(script);
  });

  return html2canvasPromise;
}
