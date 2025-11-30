declare global {
  interface Window {
    html2canvas?: any;
  }
}

let html2canvasPromise: Promise<any> | null = null;

function loadFromModule(): Promise<any> {
  return import("html2canvas").then((mod: any) => {
    const html2canvas = mod?.default ?? mod;
    if (!html2canvas) {
      throw new Error("html2canvas 模組載入失敗");
    }
    if (typeof window !== "undefined" && !window.html2canvas) {
      window.html2canvas = html2canvas;
    }
    return html2canvas;
  });
}

function loadFromCdn(): Promise<any> {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-html2canvas="cdn"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.html2canvas) {
          resolve(window.html2canvas);
        } else {
          reject(new Error("CDN html2canvas 載入失敗"));
        }
      });
      existingScript.addEventListener("error", () => {
        reject(new Error("CDN html2canvas 載入失敗"));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min";
    script.async = true;
    script.setAttribute("data-html2canvas", "cdn");
    script.onload = () => {
      if (window.html2canvas) {
        resolve(window.html2canvas);
      } else {
        reject(new Error("載入截圖模組失敗"));
      }
    };
    script.onerror = () => {
      reject(new Error("下載 html2canvas 失敗"));
    };
    document.head.appendChild(script);
  });
}

export function ensureHtml2Canvas(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("瀏覽器環境才支援截圖"));
  }
  if (window.html2canvas) {
    return Promise.resolve(window.html2canvas);
  }
  if (html2canvasPromise) {
    return html2canvasPromise;
  }

  html2canvasPromise = loadFromModule()
    .catch((err) => {
      console.warn("本地 html2canvas 載入失敗，改用 CDN。", err);
      return loadFromCdn();
    })
    .catch((err) => {
      html2canvasPromise = null;
      throw err;
    });

  return html2canvasPromise;
}
