// Expanded from GCA-Classroom's Water Quest starter. No libraries or build step.
(() => {
  'use strict';
  const MODES = {
    easy: {label: 'Easy', roundMs: 40000, spawnMs: 1500, goal: 80, canChance: 0.9, penalty: 5},
    normal: {label: 'Normal', roundMs: 30000, spawnMs: 1200, goal: 100, canChance: 0.8, penalty: 5},
    hard: {label: 'Hard', roundMs: 25000, spawnMs: 850, goal: 140, canChance: 0.7, penalty: 10}
  };
  let mode = MODES.normal;
  const milestones = [
    {fraction: 0.25, message: 'A strong start! One quarter of the way.'},
    {fraction: 0.5, message: 'Halfway there! Keep those cans coming.'},
    {fraction: 0.75, message: 'Three quarters! Your goal is in sight.'},
    {fraction: 1, message: 'Goal reached! Keep your score up until time runs out.'}
  ];
  const reachedMilestones = new Set();
  let soundEnabled = false;
  const sounds = Object.fromEntries(['collect', 'spill', 'win'].map(name => [name, new Audio(`audio/${name}.wav`)]));
  Object.values(sounds).forEach(sound => { sound.preload = 'auto'; sound.volume = 0.35; });
  const winningMessages = ['You made every can count!', 'A little play. A quest complete!', 'Study break, mission accomplished!'];
  const retryMessages = ['One more quest? You can do this.', 'Keep going, one can at a time.', 'A new round is a fresh start.'];
  const $ = id => document.getElementById(id);
  const cells = [];
  let state = 'ready'; // ready -> playing <-> paused -> ended
  let score = 0;
  let remaining = mode.roundMs;
  let deadline = 0;
  let nextSpawn = 0;
  let activeTile = -1;
  let activeKind = null;
  let loopId = null;
  let celebrationId = null;

  function createGrid() {
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'grid-cell';
      cell.disabled = true;
      cell.setAttribute('aria-label', `Tile ${i + 1}, empty`);
      cell.innerHTML = `<span class="tile-number" aria-hidden="true">${i + 1}</span>`;
      cell.addEventListener('click', () => collect(i));
      cells.push(cell);
      $('board').appendChild(cell);
    }
  }

  function clearTarget() {
    cells.forEach((cell, i) => {
      cell.classList.remove('is-can', 'is-spill');
      cell.querySelector('.target')?.remove();
      cell.setAttribute('aria-label', `Tile ${i + 1}, empty`);
    });
    activeTile = -1;
    activeKind = null;
  }

  function spawnWaterCan() {
    clearTarget();
    activeTile = Math.floor(Math.random() * cells.length);
    activeKind = Math.random() < mode.canChance ? 'can' : 'spill';
    const cell = cells[activeTile];
    cell.classList.add(`is-${activeKind}`);
    cell.setAttribute('aria-label', `Tile ${activeTile + 1}, ${activeKind === 'can' ? 'yellow can, collect 10 points' : `spill, avoid losing ${mode.penalty} points`}`);
    const target = document.createElement(activeKind === 'can' ? 'img' : 'span');
    target.className = `target ${activeKind === 'spill' ? 'spill-target' : ''}`;
    target.setAttribute('aria-hidden', 'true');
    if (activeKind === 'can') {
      target.src = 'img/water-can.png';
      target.alt = '';
      target.draggable = false;
    } else {
      target.innerHTML = '×<small>SPILL</small>';
    }
    cell.appendChild(target);
  }

  function feedback(message, penalty = false) {
    $('feedback').textContent = message;
    $('feedback').classList.toggle('penalty', penalty);
  }

  function updateStats() {
    $('score').textContent = score;
    $('timer').textContent = Math.ceil(remaining / 1000);
    $('timer').parentElement.parentElement.classList.toggle('urgent', remaining <= 5000);
    $('progress-text').textContent = `${score} / ${mode.goal}`;
    const progress = Math.min(100, score / mode.goal * 100);
    $('progress-fill').style.width = `${progress}%`;
    $('goal-progress').setAttribute('aria-valuenow', progress);
    $('goal-progress').setAttribute('aria-valuetext', `${score} points. Goal: ${mode.goal}.`);
    $('goal-label').textContent = score >= mode.goal ? `Goal reached. Keep ${mode.goal}+ until the end!` : `The goal: ${mode.goal} points`;
  }

  // A monotonic deadline avoids a slow interval extending the round.
  function tick() {
    if (state !== 'playing') return;
    const now = performance.now();
    remaining = Math.max(0, deadline - now);
    if (remaining === 0) return endGame();
    if (now >= nextSpawn) {
      spawnWaterCan();
      nextSpawn = now + mode.spawnMs;
    }
    updateStats();
  }

  function collect(index) {
    if (state !== 'playing') return;
    // Reject clicks after the deadline, even if a timer callback was delayed.
    if (performance.now() >= deadline) return endGame();
    if (index !== activeTile) return;
    const isCan = activeKind === 'can';
    score = Math.max(0, score + (isCan ? 10 : -mode.penalty));
    clearTarget(); // Consume once, so double taps cannot score twice.
    const message = isCan ? '+10! Nice catch.' : `Spill! −${mode.penalty} points. Watch for yellow cans.`;
    if (isCan) {
      milestones.forEach((milestone, index) => {
        if (score >= mode.goal * milestone.fraction && !reachedMilestones.has(index)) {
          reachedMilestones.add(index);
          $('milestone').textContent = `${Math.round(milestone.fraction * 100)}% milestone · ${milestone.message}`;
        }
      });
    }
    playSound(isCan ? 'collect' : 'spill');
    feedback(message, !isCan);
    updateStats();
  }

  function setBoardEnabled(enabled) {
    cells.forEach(cell => { cell.disabled = !enabled; });
  }

  function showOverlay(title, copy, button, art) {
    $('overlay-title').textContent = title;
    $('overlay-copy').textContent = copy;
    $('start-game').textContent = button;
    $('overlay-art').textContent = art;
    $('overlay').hidden = false;
  }

  function clearCelebration() {
    clearTimeout(celebrationId);
    $('confetti').replaceChildren();
    $('confetti').classList.remove('static-celebration');
  }

  function celebrate() {
    clearCelebration();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $('confetti').classList.add('static-celebration');
    } else {
      const colors = ['#ffc907', '#2e9df7', '#8bd1cb', '#173c43'];
      for (let i = 0; i < 60; i++) {
        const piece = document.createElement('i');
        piece.className = 'confetti-piece';
        piece.style.setProperty('--x', `${Math.random() * 100}%`);
        piece.style.setProperty('--color', colors[i % colors.length]);
        piece.style.setProperty('--delay', `${Math.random() * 0.45}s`);
        piece.style.setProperty('--drift', `${Math.random() * 200 - 100}px`);
        $('confetti').appendChild(piece);
      }
    }
    celebrationId = setTimeout(clearCelebration, 3500);
  }

  function startGame() {
    clearInterval(loopId);
    clearCelebration();
    clearTarget();
    score = 0;
    mode = MODES[$('difficulty').value] || MODES.normal;
    remaining = mode.roundMs;
    reachedMilestones.clear();
    $('milestone').textContent = 'Your milestones: 25% · 50% · 75% · Goal';
    $('difficulty').disabled = true;
    state = 'playing';
    deadline = performance.now() + remaining;
    nextSpawn = performance.now() + mode.spawnMs;
    $('overlay').hidden = true;
    $('result-mission').hidden = true;
    $('round-status').textContent = 'QUEST IN PROGRESS';
    $('pause-game').disabled = false;
    $('pause-game').textContent = 'Pause';
    setBoardEnabled(true);
    feedback('Go! Tap yellow cans. Leave the spills.');
    updateStats();
    spawnWaterCan();
    loopId = setInterval(tick, 50);
    cells[0].focus({ preventScroll: true });
  }

  function pauseGame(auto = false) {
    if (state !== 'playing') return;
    remaining = Math.max(0, deadline - performance.now());
    if (remaining === 0) return endGame();
    state = 'paused';
    clearInterval(loopId);
    setBoardEnabled(false);
    $('round-status').textContent = 'TAKE A BREATHER';
    $('pause-game').textContent = 'Resume';
    showOverlay('Your quest is paused.', 'Your score and time are safe. Pick up where you left off.', 'Resume my quest', 'Ⅱ');
    feedback(auto ? 'Paused because you left the tab. Resume when you’re ready.' : 'Take your time. The clock is paused.');
    updateStats();
    if (!auto) $('start-game').focus({ preventScroll: true });
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    deadline = performance.now() + remaining;
    nextSpawn = performance.now() + mode.spawnMs;
    $('overlay').hidden = true;
    $('pause-game').textContent = 'Pause';
    $('round-status').textContent = 'QUEST IN PROGRESS';
    setBoardEnabled(true);
    loopId = setInterval(tick, 50);
    feedback('Welcome back. Keep collecting!');
    cells[Math.max(0, activeTile)].focus({ preventScroll: true });
  }

  function endGame() {
    if (state === 'ended') return;
    state = 'ended';
    remaining = 0;
    clearInterval(loopId);
    clearTarget();
    setBoardEnabled(false);
    $('pause-game').disabled = true;
    $('difficulty').disabled = false;
    $('round-status').textContent = 'QUEST COMPLETE';
    const won = score >= mode.goal;
    const messages = won ? winningMessages : retryMessages;
    const message = messages[Math.floor(Math.random() * messages.length)];
    showOverlay(won ? 'Quest complete!' : 'Nice effort. Try again?', `${score} points · ${message}`, 'Play again', won ? '★' : '↗');
    feedback(won ? `You won with ${score} points! Clean water changes everything.` : `${score} points. Aim for ${mode.goal} next time. You’ve got this.`);
    $('result-mission').hidden = false;
    updateStats();
    if (won) { celebrate(); playSound('win'); }
    $('overlay-title').focus({ preventScroll: true });
  }

  function playSound(name) {
    if (!soundEnabled) return;
    const sound = sounds[name];
    sound.currentTime = 0;
    const playback = sound.play();
    if (playback && playback.catch) playback.catch(() => {
      soundEnabled = false;
      $('sound-toggle').textContent = 'Sound off';
      $('sound-toggle').setAttribute('aria-pressed', 'false');
    });
  }

  function updateMode() {
    if (state === 'playing' || state === 'paused') return;
    mode = MODES[$('difficulty').value] || MODES.normal;
    if (state === 'ended') {
      state = 'ready';
      score = 0;
      clearCelebration();
      clearTarget();
      reachedMilestones.clear();
      $('milestone').textContent = 'Your milestones: 25% · 50% · 75% · Goal';
      $('result-mission').hidden = true;
      showOverlay('Ready for a little good?', 'Tap the yellow cans as they pop up. Leave the spills alone.', 'Start my quest', '↗');
    }
    remaining = mode.roundMs;
    $('round-edition').textContent = `${mode.label.toUpperCase()} · ${mode.roundMs / 1000} SECONDS`;
    $('difficulty-detail').textContent = `${mode.roundMs / 1000} seconds · ${mode.goal}-point goal · −${mode.penalty} per spill · a target every ${mode.spawnMs / 1000}s`;
    $('penalty-rule').textContent = `−${mode.penalty} points, minimum 0`;
    $('win-rule').textContent = `${mode.goal}+ points at ${mode.roundMs / 1000} seconds wins`;
    $('goal-progress').setAttribute('aria-label', `Progress toward ${mode.goal} points`);
    $('round-status').textContent = 'READY WHEN YOU ARE';
    feedback(`${mode.label} selected. Start when you’re ready.`);
    updateStats();
  }

  createGrid();
  updateMode();
  $('difficulty').addEventListener('change', updateMode);
  $('sound-toggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    $('sound-toggle').textContent = soundEnabled ? 'Sound on' : 'Sound off';
    $('sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
    if (soundEnabled) playSound('collect');
  });
  $('start-game').addEventListener('click', () => state === 'paused' ? resumeGame() : startGame());
  $('reset-game').addEventListener('click', startGame);
  $('pause-game').addEventListener('click', () => state === 'playing' ? pauseGame() : resumeGame());
  document.addEventListener('keydown', event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^[1-9]$/.test(event.key) && state === 'playing') {
      event.preventDefault();
      collect(Number(event.key) - 1);
    } else if (event.key.toLowerCase() === 'p' && ['playing', 'paused'].includes(state)) {
      event.preventDefault();
      state === 'playing' ? pauseGame() : resumeGame();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame(true);
  });
})();
