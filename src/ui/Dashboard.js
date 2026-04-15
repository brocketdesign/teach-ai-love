/**
 * Dashboard — real-time metrics overlay + reward chart.
 */
export class Dashboard {
  constructor() {
    this._agent = null;
    this._chartCanvas = document.getElementById('reward-chart');
    this._ctx = this._chartCanvas?.getContext('2d');
    this._statEpisode  = document.getElementById('stat-episode');
    this._statReward   = document.getElementById('stat-reward');
    this._statLove     = document.getElementById('stat-love');
    this._statEpsilon  = document.getElementById('stat-epsilon');
    this._statSteps    = document.getElementById('stat-steps');
    this._aiStatus     = document.getElementById('ai-status-indicator');
    this._loveFill     = document.getElementById('love-fill');
    this._loveScore    = 0;
    this._rewardSmooth = 0;
  }

  setAgent(agent) {
    this._agent = agent;
    this._loveScore = 0;
    this._rewardSmooth = 0;
  }

  onSceneSwitch(key) {
    const labels = { color: '🎨 Color Harmony', dna: '🧬 DNA Match', vibration: '〜 Vibration' };
    this._setStatus(`Loading ${labels[key] ?? key}…`, 'status-searching');
    setTimeout(() => this._setStatus('Searching…', 'status-searching'), 800);
  }

  updateMetrics(agent) {
    if (!agent) return;
    this._agent = agent;

    if (this._statEpisode) this._statEpisode.textContent = agent.episodeCount;
    if (this._statReward)  this._statReward.textContent  = agent.episodeReward.toFixed(2);
    if (this._statLove)    this._statLove.textContent    = agent.loveBonds;
    if (this._statEpsilon) this._statEpsilon.textContent = agent.epsilon.toFixed(3);
    if (this._statSteps)   this._statSteps.textContent   = agent.totalSteps;

    // Love meter fill
    if (this._loveFill) {
      const pct = Math.min(100, (agent.loveBonds / Math.max(1, agent.episodeCount * 0.5)) * 100);
      this._loveFill.style.width = pct + '%';
    }

    // AI status based on epsilon
    if (agent.epsilon > 0.6) {
      this._setStatus('Exploring…', 'status-searching');
    } else if (agent.epsilon > 0.2) {
      this._setStatus('Learning…', 'status-learning');
    } else {
      this._setStatus('Seeking Love ♡', 'status-love');
    }

    this._drawChart(agent);
  }

  _setStatus(text, className) {
    if (!this._aiStatus) return;
    this._aiStatus.textContent = text;
    this._aiStatus.className = className;
  }

  _drawChart(agent) {
    const ctx = this._ctx;
    if (!ctx) return;
    const w = this._chartCanvas.width;
    const h = this._chartCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const history = agent.rewardHistory;
    if (history.length < 2) return;

    const maxVal = Math.max(...history, 1);
    const minVal = Math.min(...history, -1);
    const range  = maxVal - minVal || 1;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);

    // Zero line
    const zeroY = h - ((0 - minVal) / range) * h;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.moveTo(0, zeroY);
    ctx.lineTo(w, zeroY);
    ctx.stroke();

    // Reward curve
    ctx.beginPath();
    ctx.lineWidth = 2;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#4455ff');
    grad.addColorStop(1, '#ff44aa');
    ctx.strokeStyle = grad;

    history.forEach((val, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((val - minVal) / range) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(80, 60, 160, 0.25)';
    ctx.fill();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px monospace';
    ctx.fillText(`max ${maxVal.toFixed(1)}`, 3, 10);
    ctx.fillText(`min ${minVal.toFixed(1)}`, 3, h - 3);
  }
}
