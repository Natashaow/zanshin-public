import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// Dev-only capture-to-vault endpoint — the "thin filesystem adapter" the master
// architecture spec (§5.1) prescribes instead of a backend. It exists only while
// `vite dev` runs on this machine; the static production build has no server, so
// useCaptureQueue's fetch fails and the browser-local queue remains the whole story.
// Contract lives in the vault: "Zanshin - Omnibox Quick-Capture Spec".
const VAULT_THINKING_DIR = path.join(
  process.env.HOME ?? '',
  'Documents/MyBrain/04 - Thinking',
)

function captureToVault() {
  return {
    name: 'capture-to-vault',
    configureServer(server) {
      server.middlewares.use('/api/capture', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            const { text, destination } = JSON.parse(body)
            const trimmed = typeof text === 'string' ? text.trim() : ''
            if (!trimmed) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'empty capture' }))
              return
            }
            if (!fs.existsSync(VAULT_THINKING_DIR)) {
              res.statusCode = 503
              res.end(JSON.stringify({ error: 'vault not reachable' }))
              return
            }
            const date = new Date().toISOString().slice(0, 10)
            const slug =
              trimmed
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .split('-')
                .slice(0, 6)
                .join('-') || 'capture'
            // Never overwrite: suffix -2, -3, … on collision, and open with 'wx' below
            // so a race with another writer errors instead of clobbering.
            let name = `${date}-${slug}.md`
            let n = 2
            while (fs.existsSync(path.join(VAULT_THINKING_DIR, name))) {
              name = `${date}-${slug}-${n}.md`
              n += 1
            }
            const firstLine = trimmed.split('\n')[0].slice(0, 150).replace(/"/g, '\\"')
            const routed =
              destination && destination.id && destination.id !== 'inbox'
            const frontmatter = [
              '---',
              `date: "${date}"`,
              `description: "${firstLine}"`,
              ...(routed ? [`destination: "${destination.label}"`] : []),
              'tags:',
              '  - thinking',
              '  - inbox',
              '---',
              '',
            ].join('\n')
            const noteBody = routed
              ? `${trimmed}\n\n[[${destination.label}]]\n`
              : `${trimmed}\n`
            fs.writeFileSync(path.join(VAULT_THINKING_DIR, name), frontmatter + noteBody, {
              flag: 'wx',
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ filed: `04 - Thinking/${name}` }))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(err?.message ?? err) }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), captureToVault()],
})
