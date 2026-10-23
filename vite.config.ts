import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 빌드할 때 앱 소개 파일(manifest.webmanifest)과 서비스 워커(sw.js)를 만든다
    VitePWA({
      // 새 버전을 받으면 묻지 않고 바꾼다. 화면을 저절로 새로 고치지는 않아서 다음에 열 때 새 버전이 뜬다
      // (입력하던 중에 화면이 바뀌지 않게)
      registerType: 'autoUpdate',
      // JS·CSS·HTML 말고도 미리 받아 둘 파일 (인터넷이 끊겨도 아이콘이 보이게)
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '부추 하우스',
        short_name: '부추 하우스', // 홈 화면 아이콘 아래 이름
        lang: 'ko',
        display: 'standalone', // 주소창 없이 앱처럼 연다
        start_url: '/',
        theme_color: '#12a150', // 폰 맨 위 상태 표시줄 색 (주 색 초록)
        background_color: '#f2f4f6', // 앱이 뜨기 전 잠깐 보이는 바탕 (index.css의 바탕색)
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // 안드로이드가 동그라미 등 기종마다 다른 모양으로 잘라 쓰는 아이콘
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
