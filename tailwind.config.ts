import type { Config } from 'tailwindcss'
const config: Config = { content: ['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink:'#2C2C2B', muted:'#7D7A75', line:'#E6E5E3', soft:'#F9F8F7', brand:'#2783DE' } } }, plugins: [] }
export default config
