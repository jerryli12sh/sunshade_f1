import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/sunshade-app/', // 必须与GitHub仓库名一致、结尾有斜杠
  plugins: [react()]
})
