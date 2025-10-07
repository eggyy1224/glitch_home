export default {
  server: {
    port: 5173,
    proxy: {
      // 讓開發時同源請求 /api/* 轉發到後端 FastAPI（預設 8000）
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      // 讓圖片靜態路徑也走代理
      "/generated_images": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
};


