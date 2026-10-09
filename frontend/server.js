const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

const app = express();

// Chuyển tiếp mọi request /api/* sang backend Spring Boot (tránh CORS).
app.use(
  '/api',
  createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    pathRewrite: (p) => `/api${p}`,
    on: {
      error: (err, req, res) => {
        console.error(`[proxy] ${req.method} ${req.originalUrl}: ${err.message}`);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Không kết nối được tới backend' }));
      },
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Frontend chạy tại http://localhost:${PORT} (backend: ${BACKEND_URL})`);
});
