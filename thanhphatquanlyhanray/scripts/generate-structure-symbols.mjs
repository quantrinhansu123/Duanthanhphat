import { mkdir, writeFile } from "node:fs/promises";

// Vector illustrations: consistent 160 × 120 viewBox, self-contained and script-free.
const track = '<path d="M18 76H142M18 88H142"/><path d="M28 70v24m20-24v24m20-24v24m20-24v24m20-24v24m20-24v24" stroke-width="2"/>';
const icons = {
  "turnout-left": ['Ghi rẽ trái', '#c2571a', `${track}<path d="M60 76 113 26m-39 50 51-43"/><path d="m83 44 15 15m-1-28 15 15" stroke-width="2"/>`],
  "turnout-right": ['Ghi rẽ phải', '#c2571a', `<g transform="translate(160 0) scale(-1 1)">${track}<path d="M60 76 113 26m-39 50 51-43"/><path d="m83 44 15 15m-1-28 15 15" stroke-width="2"/></g>`],
  crossing: ['Ghi bắt chéo', '#475569', '<path d="m22 27 116 66M22 93 138 27M22 40l116 66M22 80 138 14"/><path d="m37 26-9 16m30-4-9 16m72 12-9 16m28-4-9 16" stroke-width="2"/>'],
  diamond: ['Ghi hình thoi', '#475569', '<path d="M15 32 80 76 145 32M15 88 80 44 145 88M15 44 80 88 145 44M15 76 80 32 145 76"/>'],
  bridge: ['Cầu', '#1d4ed8', '<path d="M18 54h124M18 68h124M34 38v52m92-52v52M34 38h92M34 90h92M34 38l23 16 23-16 23 16 23-16M34 90l23-22 23 22 23-22 23 22"/><path d="M34 28v9m92-9v9M34 91v9m92-9v9" stroke-width="7"/>'],
  tunnel: ['Hầm', '#475569', '<path d="M30 98V59a50 50 0 0 1 100 0v39H30Z" fill="#cbd5e1"/><path d="M49 98V60a31 31 0 0 1 62 0v38" fill="#475569"/><path d="m58 100 10-36m34 36L92 64M64 80h32M61 91h38" stroke="#e2e8f0"/><path d="M80 10v14M45 24l10 10m60-10-10 10"/>'],
  entrance: ['Đầu cầu / Đầu hầm', '#c2571a', '<path d="M70 18v84" stroke-dasharray="7 6"/><path d="M18 54h124M18 68h124" stroke="#64748b"/><path d="M82 30h60v62H82" fill="#dbeafe" stroke="#1d4ed8"/><path d="M22 35h34m-10-9 10 9-10 9"/>'],
  exit: ['Cuối cầu / Cuối hầm', '#c2571a', '<path d="M90 18v84" stroke-dasharray="7 6"/><path d="M18 54h124M18 68h124" stroke="#64748b"/><path d="M78 30H18v62h60" fill="#dbeafe" stroke="#1d4ed8"/><path d="M103 35h35m-10-9 10 9-10 9"/>'],
  "non-welding": ['Vùng hạn chế hàn ray', '#dc2626', '<rect x="17" y="27" width="126" height="66" rx="6" fill="#fee2e2" stroke-dasharray="6 5"/><path d="M25 54h110M25 68h110" stroke="#64748b"/><circle cx="80" cy="60" r="24" fill="#fff"/><path d="m63 43 34 34" stroke-width="5"/>'],
};
await mkdir('public/symbols', { recursive: true });
for (const [file, [title, color, shapes]] of Object.entries(icons)) {
  await writeFile(`public/symbols/${file}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120" role="img"><title>${title}</title><rect width="160" height="120" rx="12" fill="white"/><g fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${shapes}</g></svg>\n`);
}
console.log(`Created ${Object.keys(icons).length} SVG symbols.`);
