export interface MufyPlayerTrack {
  name: string;
  url: string;
}

/** Bind an explicitly recovered playlist to a captured ghost-player DOM.
 * Runtime snapshots contain appearance, not the original event listeners.
 * Callers must supply verified source tracks; never infer audio from a title.
 */
export function attachMufyGhostPlayer(
  content: string,
  tracks: MufyPlayerTrack[],
): string {
  if (!content.includes('id="ftGhostSidebar"') || tracks.length === 0) {
    throw new Error("A ghost-player snapshot and source playlist are required");
  }
  for (const track of tracks) {
    if (!track.name || !/^https?:\/\//.test(track.url)) {
      throw new Error("Invalid source track");
    }
  }
  const payload = JSON.stringify(tracks).replaceAll("<", "\\u003c");
  const previous =
    /<script\b[^>]*\bid="nj-recovered-ghost-player"[^>]*>[\s\S]*?<\/script>/gi;
  const script = `<script id="nj-recovered-ghost-player">
(function () {
  const tracks = ${payload};
  const root = document.getElementById('ftGhostSidebar');
  if (!root || root.dataset.playerBound) return;
  root.dataset.playerBound = 'true';
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.setAttribute('data-nj-recovered-player', 'true');
  audio.style.display = 'none';
  root.appendChild(audio);
  const title = root.querySelector('#ftTitle');
  const current = root.querySelector('#ftCurTime');
  const duration = root.querySelector('#ftDurTime');
  const bar = root.querySelector('#ftProgressBar');
  const modeLabel = root.querySelector('#ftModeToast');
  const playIcon = root.querySelector('#ftIconPlay');
  const pauseIcon = root.querySelector('#ftIconPause');
  let index = 0;
  let mode = 0;
  let generation = 0;
  const format = (value) => Number.isFinite(value)
    ? String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(Math.floor(value % 60)).padStart(2, '0')
    : '--:--';
  function playing(value) {
    if (playIcon) playIcon.style.display = value ? 'none' : 'block';
    if (pauseIcon) pauseIcon.style.display = value ? 'block' : 'none';
    root.querySelector('#ftPlayBtn').setAttribute('aria-label', value ? '暂停' : '播放');
  }
  function failed() {
    playing(false);
    title.textContent = tracks[index].name + '（音源暂不可用）';
    title.title = tracks[index].name;
  }
  async function start() {
    const token = generation;
    try { await audio.play(); }
    catch (error) { if (token === generation && error.name !== 'AbortError') failed(); }
  }
  function load(next, autoplay) {
    generation++;
    audio.pause();
    index = (next + tracks.length) % tracks.length;
    title.textContent = tracks[index].name;
    title.title = tracks[index].name;
    current.textContent = '00:00';
    duration.textContent = '--:--';
    bar.style.width = '0%';
    playing(false);
    audio.src = tracks[index].url;
    audio.load();
    if (autoplay) start();
  }
  function nextIndex() {
    if (mode !== 2 || tracks.length === 1) return index + 1;
    return (index + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length;
  }
  root.querySelector('#ftPlayBtn').addEventListener('click', () => {
    if (audio.paused) start(); else audio.pause();
  });
  root.querySelector('#ftPrevBtn').addEventListener('click', () => load(index - 1, true));
  root.querySelector('#ftNextBtn').addEventListener('click', () => load(nextIndex(), true));
  root.querySelector('#ftModeBtn').addEventListener('click', () => {
    mode = (mode + 1) % 3;
    audio.loop = mode === 1;
    modeLabel.textContent = ['列表循环', '单曲循环', '随机播放'][mode];
  });
  root.querySelector('#ftProgressWrap').addEventListener('click', (event) => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width > 0) audio.currentTime = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * audio.duration;
  });
  audio.addEventListener('play', () => playing(true));
  audio.addEventListener('pause', () => playing(false));
  audio.addEventListener('error', failed);
  audio.addEventListener('loadedmetadata', () => { duration.textContent = format(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    current.textContent = format(audio.currentTime);
    bar.style.width = (audio.duration > 0 ? audio.currentTime / audio.duration * 100 : 0) + '%';
  });
  audio.addEventListener('ended', () => { if (mode !== 1) load(nextIndex(), true); });
  modeLabel.textContent = '列表循环';
  load(0, false);
})();
</script>`;
  const cleaned = content.replace(previous, "");
  // Keep the listeners inside the floating envelope; content after its closing
  // tag belongs to the inline theater and cannot access this iframe's DOM.
  const closing = cleaned.lastIndexOf("</floating>");
  return closing >= 0
    ? `${cleaned.slice(0, closing)}\n${script}\n${cleaned.slice(closing)}`
    : `${cleaned}\n${script}`;
}
