import type { FC } from "hono/jsx";

const client = `
const form = document.querySelector('[data-chat-form]');
const input = document.querySelector('[data-chat-input]');
const messages = document.querySelector('[data-messages]');
const empty = document.querySelector('[data-chat-empty]');
const send = document.querySelector('[data-send]');
const mic = document.querySelector('[data-mic]');
const status = document.querySelector('[data-status]');
const history = [];

const bubble = (role, content) => {
  empty?.classList.add('hidden');
  const row = document.createElement('div');
  row.className = role === 'user' ? 'flex justify-end' : 'flex justify-start';
  const item = document.createElement('div');
  item.className = role === 'user'
    ? 'max-w-[85%] rounded-[1.5rem] rounded-br-md bg-orange-500 px-5 py-3 text-sm leading-6 text-white'
    : 'max-w-[85%] rounded-[1.5rem] rounded-bl-md bg-white px-5 py-3 text-sm leading-6 text-slate-700 shadow-sm';
  item.textContent = content;
  row.appendChild(item);
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
  return row;
};

const sendMessage = async (content) => {
  if (!content || send.disabled) return;
  history.push({ role: 'user', content });
  bubble('user', content);
  input.value = '';
  send.disabled = true;
  status.textContent = 'Model sedang menjawab…';
  const waiting = bubble('assistant', '…');
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Chat gagal');
    waiting.remove();
    history.push({ role: 'assistant', content: data.content });
    bubble('assistant', data.content);
    status.textContent = 'Siap menerima pesan';
  } catch (error) {
    waiting.remove();
    bubble('assistant', error.message || 'Chat gagal. Coba lagi.');
    status.textContent = 'Terjadi gangguan';
  } finally {
    send.disabled = false;
    input.focus();
  }
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await sendMessage(input.value.trim());
});

let recorder;
let chunks = [];
mic?.addEventListener('click', async () => {
  if (recorder?.state === 'recording') {
    recorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener('stop', async () => {
      mic.textContent = 'Memproses…';
      mic.disabled = true;
      status.textContent = 'Whisper sedang mendengar…';
      const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      stream.getTracks().forEach((track) => track.stop());
      const formData = new FormData();
      formData.set('file', audio, 'recording.webm');
      try {
        const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Transkripsi gagal');
        input.value = data.text;
        status.textContent = 'Transkrip siap, mengirim…';
        await sendMessage(data.text);
      } catch (error) {
        status.textContent = error.message || 'Transkripsi gagal';
      } finally {
        mic.disabled = false;
        mic.textContent = 'Rekam suara';
      }
    });
    recorder.start();
    mic.textContent = 'Stop rekaman';
    status.textContent = 'Merekam suara…';
  } catch {
    status.textContent = 'Izin mikrofon diperlukan';
  }
});
`;

export const ChatPage: FC = () => (
  <html lang="id">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Voice Chat · BCC Filkom</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet" />
      <script src="https://cdn.tailwindcss.com" />
    </head>
    <body class="min-h-screen bg-[#fff7ed] font-['Plus_Jakarta_Sans'] text-slate-900">
      <main class="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <header class="mb-5 flex items-center justify-between gap-4">
          <div>
            <a class="text-sm font-bold text-orange-600" href="/">← Semua fitur</a>
            <h1 class="mt-2 text-3xl font-extrabold tracking-tight">Voice Chat</h1>
            <p class="mt-1 text-sm text-slate-500" data-status>Siap menerima pesan</p>
          </div>
          <span class="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-slate-500 shadow-sm">Whisper Large V3 Turbo</span>
        </header>
        <section class="flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-[2rem] bg-orange-50 shadow-xl shadow-orange-100">
          <div class="flex-1 space-y-4 overflow-y-auto p-5 sm:p-7" data-messages>
            <div class="grid h-full place-items-center text-center" data-chat-empty>
              <div><p class="text-lg font-extrabold">Mulai percakapan.</p><p class="mt-1 text-sm text-slate-400">Ketik pesan atau rekam suara dalam Bahasa Indonesia.</p></div>
            </div>
          </div>
          <form class="border-t border-orange-100 bg-white p-3 sm:p-4" data-chat-form>
            <div class="flex items-end gap-2">
              <button class="shrink-0 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-60" data-mic type="button">Rekam suara</button>
              <textarea class="max-h-36 min-h-12 flex-1 resize-none rounded-2xl border-0 bg-orange-50 px-4 py-3 text-sm outline-none ring-orange-300 focus:ring-2" data-chat-input placeholder="Tulis pesan…" rows={1} />
              <button class="shrink-0 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-extrabold text-white disabled:bg-orange-300" data-send type="submit">Kirim</button>
            </div>
          </form>
        </section>
      </main>
      <script dangerouslySetInnerHTML={{ __html: client }} />
    </body>
  </html>
);
