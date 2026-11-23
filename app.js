/**
 * FitSequence - Interactive All-in-One Interval Routine Timer
 * Features:
 * - Direct on-screen controls: 시작, 일시정지, 다음, 초기화
 * - Direct on-screen Routine Builder & Stage Addition
 * - 3 Stage Types: Tabata, Count Down, Count Up
 * - Ready Wait Time, Rest Time
 * - Web Audio API Beep Synthesizer
 * - LocalStorage Routine Library
 */

// ==========================================
// 1. Web Audio API Sound Synthesizer
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 3-2-1 Countdown Beep (Short crisp warning)
  playWarningBeep() {
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.16);
    } catch (e) {
      console.warn("Audio warning beep error", e);
    }
  }

  // Stage/Round Transition & Completion Chime (Long resonant tone)
  playCompletionBeep() {
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1760, this.ctx.currentTime); // A6

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.65);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.7);
    } catch (e) {
      console.warn("Audio completion beep error", e);
    }
  }
}

const soundFX = new SoundFX();

// ==========================================
// 2. State & Data Models
// ==========================================
const States = {
  IDLE: 'IDLE',
  READY: 'READY',
  WORK: 'WORK',
  REST: 'REST',
  COMPLETED: 'COMPLETED'
};

const DEFAULT_PRESETS = [
  {
    name: "타바타 전신 4분 챌린지",
    prepTime: 5,
    stages: [
      { id: "s1", name: "점핑잭 (Jumping Jacks)", type: "tabata", workTime: 20, restTime: 10, rounds: 4 },
      { id: "s2", name: "스쿼트 (Air Squats)", type: "tabata", workTime: 20, restTime: 10, rounds: 4 }
    ]
  },
  {
    name: "3단계 코어 버닝 루틴",
    prepTime: 5,
    stages: [
      { id: "s1", name: "플랭크 버티기", type: "countdown", workTime: 45, restTime: 15, rounds: 3 },
      { id: "s2", name: "바이시클 크런치", type: "tabata", workTime: 30, restTime: 15, rounds: 3 },
      { id: "s3", name: "마운틴 클라이머", type: "countup", workTime: 30, restTime: 10, rounds: 2 }
    ]
  }
];

let currentPrepTime = 5;
let routineStages = [
  { id: "st-1", name: "버피 테스트", type: "tabata", workTime: 20, restTime: 10, rounds: 3 },
  { id: "st-2", name: "푸시업", type: "countdown", workTime: 30, restTime: 15, rounds: 2 },
  { id: "st-3", name: "플랭크 버티기", type: "countup", workTime: 30, restTime: 10, rounds: 1 }
];

let appState = States.IDLE;
let isRunning = false;
let timerInterval = null;

let currentStageIndex = 0;
let currentRound = 1;
let currentSeconds = 0;
let totalTargetSeconds = 0;

// ==========================================
// 3. DOM Elements Selection
// ==========================================
const bodyEl = document.body;
const timerDisplayEl = document.getElementById('timer-display');
const timerProgressBarEl = document.getElementById('timer-progress-bar');
const currentStageTagEl = document.getElementById('current-stage-tag');
const currentStageTitleEl = document.getElementById('current-stage-title');
const currentPhasePillEl = document.getElementById('current-phase-pill');
const nextStageNameEl = document.getElementById('next-stage-name');
const roundDisplayEl = document.getElementById('round-display');
const overallProgressTextEl = document.getElementById('overall-progress-text');

// 4 Main Control Buttons
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnNext = document.getElementById('btn-next');
const btnReset = document.getElementById('btn-reset');

// Stage List Builder
const stageItemsContainer = document.getElementById('stage-items-container');
const btnAddStage = document.getElementById('btn-add-stage');
const inputPrepTime = document.getElementById('input-prep-time');

// Storage Modal
const btnOpenStorage = document.getElementById('btn-open-storage');
const btnCloseModal = document.getElementById('btn-close-modal');
const storageModal = document.getElementById('storage-modal');
const inputRoutineName = document.getElementById('input-routine-name');
const btnSaveRoutine = document.getElementById('btn-save-routine');
const savedListBox = document.getElementById('saved-list-box');

// ==========================================
// 4. Persistence & Routine Management
// ==========================================
function loadActiveRoutine() {
  const data = localStorage.getItem('fitsequence_active_routine');
  if (data) {
    try {
      const parsed = JSON.parse(data);
      currentPrepTime = parsed.prepTime ?? 5;
      if (Array.isArray(parsed.stages) && parsed.stages.length > 0) {
        routineStages = parsed.stages;
      }
    } catch (e) {
      console.warn("Failed to load active routine", e);
    }
  }
}

function saveActiveRoutine() {
  localStorage.setItem('fitsequence_active_routine', JSON.stringify({
    prepTime: currentPrepTime,
    stages: routineStages
  }));
}

function getSavedLibrary() {
  const data = localStorage.getItem('fitsequence_library');
  if (!data) return DEFAULT_PRESETS;
  try {
    return JSON.parse(data);
  } catch (e) {
    return DEFAULT_PRESETS;
  }
}

function saveLibrary(list) {
  localStorage.setItem('fitsequence_library', JSON.stringify(list));
}

// ==========================================
// 5. Display & Theme Helpers
// ==========================================
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setTheme(theme) {
  bodyEl.className = '';
  bodyEl.classList.add(`theme-${theme}`);
}

function updateNextBanner() {
  if (routineStages.length === 0) {
    nextStageNameEl.textContent = '단계 없음';
    return;
  }
  if (appState === States.COMPLETED) {
    nextStageNameEl.textContent = '모든 루틴 완료! 축하합니다!';
    return;
  }

  const curStage = routineStages[currentStageIndex];
  if (!curStage) {
    nextStageNameEl.textContent = '루틴 종료';
    return;
  }

  if (appState === States.READY) {
    nextStageNameEl.textContent = `${curStage.name} (${curStage.workTime}s)`;
    return;
  }

  if (appState === States.WORK) {
    if (currentRound < curStage.rounds && curStage.restTime > 0) {
      nextStageNameEl.textContent = `휴식 (${curStage.restTime}s) ➔ R${currentRound + 1}`;
    } else if (currentStageIndex + 1 < routineStages.length) {
      const nxt = routineStages[currentStageIndex + 1];
      nextStageNameEl.textContent = `${nxt.name} (${nxt.workTime}s)`;
    } else {
      nextStageNameEl.textContent = '마지막 단계 완료 직전';
    }
    return;
  }

  if (appState === States.REST) {
    if (currentRound < curStage.rounds) {
      nextStageNameEl.textContent = `${curStage.name} R${currentRound + 1} (${curStage.workTime}s)`;
    } else if (currentStageIndex + 1 < routineStages.length) {
      const nxt = routineStages[currentStageIndex + 1];
      nextStageNameEl.textContent = `${nxt.name} (${nxt.workTime}s)`;
    } else {
      nextStageNameEl.textContent = '루틴 완료 직전';
    }
    return;
  }

  if (appState === States.IDLE) {
    if (routineStages.length > 1) {
      nextStageNameEl.textContent = `1st: ${routineStages[0].name} ➔ 2nd: ${routineStages[1].name}`;
    } else {
      nextStageNameEl.textContent = `${routineStages[0].name} (${routineStages[0].workTime}s)`;
    }
  }
}

function calculateOverallPercentage() {
  if (appState === States.COMPLETED) return 100;
  if (appState === States.IDLE || routineStages.length === 0) return 0;

  let totalDuration = currentPrepTime;
  routineStages.forEach(st => {
    totalDuration += (st.workTime + (st.restTime || 0)) * st.rounds;
  });

  let elapsed = 0;
  if (appState !== States.READY) {
    elapsed += currentPrepTime;
    for (let i = 0; i < currentStageIndex; i++) {
      const s = routineStages[i];
      elapsed += (s.workTime + (s.restTime || 0)) * s.rounds;
    }
    const currentSt = routineStages[currentStageIndex];
    if (currentSt) {
      elapsed += (currentSt.workTime + (currentSt.restTime || 0)) * (currentRound - 1);
      if (appState === States.WORK) {
        if (currentSt.type === 'countup') {
          elapsed += currentSeconds;
        } else {
          elapsed += (currentSt.workTime - currentSeconds);
        }
      } else if (appState === States.REST) {
        elapsed += currentSt.workTime;
        elapsed += (currentSt.restTime - currentSeconds);
      }
    }
  } else {
    elapsed += (currentPrepTime - currentSeconds);
  }

  const pct = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
  return isNaN(pct) ? 0 : pct;
}

function updateButtonsState() {
  if (isRunning) {
    btnStart.disabled = true;
    btnPause.disabled = false;
  } else {
    btnStart.disabled = false;
    btnPause.disabled = true;
  }
}

function updateDisplay() {
  timerDisplayEl.textContent = formatTime(currentSeconds);

  // Progress Bar
  let progressPercent = 0;
  if (totalTargetSeconds > 0) {
    const stage = routineStages[currentStageIndex];
    if (appState === States.WORK && stage && stage.type === 'countup') {
      progressPercent = Math.min(100, (currentSeconds / totalTargetSeconds) * 100);
    } else {
      progressPercent = Math.min(100, ((totalTargetSeconds - currentSeconds) / totalTargetSeconds) * 100);
    }
  }
  timerProgressBarEl.style.width = `${progressPercent}%`;

  // Stage Info
  if (routineStages.length > 0 && currentStageIndex < routineStages.length) {
    const curStage = routineStages[currentStageIndex];
    currentStageTagEl.textContent = `STAGE ${currentStageIndex + 1} / ${routineStages.length}`;
    currentStageTitleEl.textContent = curStage.name;
    roundDisplayEl.textContent = `${currentRound} / ${curStage.rounds}`;
  } else if (appState === States.COMPLETED) {
    currentStageTagEl.textContent = 'FINISHED';
    currentStageTitleEl.textContent = '모든 운동 완료! 수고하셨습니다!';
    roundDisplayEl.textContent = '-';
  }

  // Phase Badge Text & Theme
  if (appState === States.READY) {
    currentPhasePillEl.textContent = '대기 (READY)';
  } else if (appState === States.WORK) {
    currentPhasePillEl.textContent = '운동 (WORK)';
  } else if (appState === States.REST) {
    currentPhasePillEl.textContent = '휴식 (REST)';
  } else if (appState === States.COMPLETED) {
    currentPhasePillEl.textContent = '완료 (COMPLETE)';
  } else {
    currentPhasePillEl.textContent = '대기 (IDLE)';
  }

  overallProgressTextEl.textContent = `${calculateOverallPercentage()}%`;
  updateNextBanner();
  updateButtonsState();
}

// ==========================================
// 6. Transition & Engine Core
// ==========================================
function startReadyPhase() {
  if (routineStages.length === 0) {
    alert("최소 1개 이상의 운동 단계를 추가해주세요!");
    return;
  }
  soundFX.init();
  appState = States.READY;
  currentStageIndex = 0;
  currentRound = 1;
  currentSeconds = currentPrepTime;
  totalTargetSeconds = currentPrepTime;

  setTheme('ready');
  if (currentPrepTime === 0) {
    startWorkPhase();
  } else {
    updateDisplay();
  }
}

function startWorkPhase() {
  if (currentStageIndex >= routineStages.length) {
    finishRoutine();
    return;
  }

  const stage = routineStages[currentStageIndex];
  appState = States.WORK;
  totalTargetSeconds = stage.workTime;

  if (stage.type === 'countup') {
    currentSeconds = 0;
  } else {
    currentSeconds = stage.workTime;
  }

  setTheme('work');
  updateDisplay();
}

function startRestPhase() {
  const stage = routineStages[currentStageIndex];
  appState = States.REST;
  currentSeconds = stage.restTime;
  totalTargetSeconds = stage.restTime;

  setTheme('rest');
  updateDisplay();
}

function advanceNext() {
  soundFX.playCompletionBeep();

  if (appState === States.READY) {
    startWorkPhase();
    return;
  }

  const stage = routineStages[currentStageIndex];

  if (appState === States.WORK) {
    if (stage.restTime > 0) {
      startRestPhase();
    } else {
      advanceRoundOrStage();
    }
    return;
  }

  if (appState === States.REST) {
    advanceRoundOrStage();
    return;
  }
}

function advanceRoundOrStage() {
  const stage = routineStages[currentStageIndex];
  if (currentRound < stage.rounds) {
    currentRound++;
    startWorkPhase();
  } else {
    currentStageIndex++;
    currentRound = 1;
    if (currentStageIndex < routineStages.length) {
      startWorkPhase();
    } else {
      finishRoutine();
    }
  }
}

function finishRoutine() {
  pauseTimer();
  appState = States.COMPLETED;
  currentSeconds = 0;
  totalTargetSeconds = 0;
  setTheme('idle');
  soundFX.playCompletionBeep();
  updateDisplay();
}

function timerTick() {
  const stage = routineStages[currentStageIndex];

  // Warning beeps 3, 2, 1 sec before phase ends
  if (appState === States.READY || appState === States.REST || (appState === States.WORK && stage.type !== 'countup')) {
    if (currentSeconds <= 3 && currentSeconds > 0) {
      soundFX.playWarningBeep();
    }
  }

  if (appState === States.WORK && stage && stage.type === 'countup') {
    currentSeconds++;
    if (currentSeconds >= totalTargetSeconds) {
      advanceNext();
    }
  } else {
    currentSeconds--;
    if (currentSeconds <= 0) {
      advanceNext();
    }
  }

  updateDisplay();
}

// Controller Actions
function playTimer() {
  if (routineStages.length === 0) {
    alert("운동 단계를 먼저 추가해주세요.");
    return;
  }

  soundFX.init();

  if (appState === States.IDLE || appState === States.COMPLETED) {
    startReadyPhase();
  }

  isRunning = true;
  clearInterval(timerInterval);
  timerInterval = setInterval(timerTick, 1000);
  updateDisplay();
}

function pauseTimer() {
  isRunning = false;
  clearInterval(timerInterval);
  updateDisplay();
}

function resetTimer() {
  pauseTimer();
  appState = States.IDLE;
  currentStageIndex = 0;
  currentRound = 1;
  currentSeconds = routineStages[0] ? routineStages[0].workTime : 0;
  totalTargetSeconds = currentSeconds;
  setTheme('idle');
  updateDisplay();
}

function skipNext() {
  soundFX.init();
  if (appState === States.IDLE) {
    startReadyPhase();
    return;
  }
  advanceNext();
}

// ==========================================
// 7. Dynamic Stage List Builder
// ==========================================
function renderStageList() {
  stageItemsContainer.innerHTML = '';

  routineStages.forEach((stage, idx) => {
    const card = document.createElement('div');
    card.className = 'stage-card';
    card.dataset.id = stage.id;

    card.innerHTML = `
      <div class="stage-card-top">
        <span class="stage-badge-num">STEP ${idx + 1}</span>
        <input type="text" class="stage-name-field" value="${stage.name}" placeholder="운동 이름" data-field="name">
        <button class="btn-del-stage" title="단계 삭제" data-idx="${idx}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
      <div class="stage-card-grid">
        <div class="card-field grid-full">
          <label>타이머 타입</label>
          <select data-field="type">
            <option value="tabata" ${stage.type === 'tabata' ? 'selected' : ''}>타바타 (Work / Rest 세트)</option>
            <option value="countdown" ${stage.type === 'countdown' ? 'selected' : ''}>카운트다운 (Count Down)</option>
            <option value="countup" ${stage.type === 'countup' ? 'selected' : ''}>랩 타임 (Count Up)</option>
          </select>
        </div>
        <div class="card-field">
          <label>운동 시간 (초)</label>
          <input type="number" min="1" max="3600" value="${stage.workTime}" data-field="workTime">
        </div>
        <div class="card-field">
          <label>휴식 시간 (초)</label>
          <input type="number" min="0" max="600" value="${stage.restTime || 0}" data-field="restTime">
        </div>
        <div class="card-field grid-full">
          <label>라운드(세트) 수</label>
          <input type="number" min="1" max="99" value="${stage.rounds}" data-field="rounds">
        </div>
      </div>
    `;

    // Listeners for values change
    card.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        let val = e.target.value;
        if (field === 'workTime' || field === 'restTime' || field === 'rounds') {
          val = Math.max(0, parseInt(val, 10) || 0);
          e.target.value = val;
        }
        routineStages[idx][field] = val;
        saveActiveRoutine();
        if (appState === States.IDLE) {
          resetTimer();
        } else {
          updateDisplay();
        }
      });
    });

    // Delete stage
    card.querySelector('.btn-del-stage').addEventListener('click', () => {
      if (routineStages.length <= 1) {
        alert("최소 1개의 단계는 유지되어야 합니다.");
        return;
      }
      routineStages.splice(idx, 1);
      saveActiveRoutine();
      renderStageList();
      resetTimer();
    });

    stageItemsContainer.appendChild(card);
  });
}

function addNewStage() {
  const newId = `st-${Date.now()}`;
  routineStages.push({
    id: newId,
    name: `새로운 운동 ${routineStages.length + 1}`,
    type: 'tabata',
    workTime: 30,
    restTime: 10,
    rounds: 3
  });
  saveActiveRoutine();
  renderStageList();
  if (appState === States.IDLE) {
    resetTimer();
  }
}

// ==========================================
// 8. Storage Modal List Render
// ==========================================
function renderSavedList() {
  const routines = getSavedLibrary();
  savedListBox.innerHTML = '';

  routines.forEach((routine, idx) => {
    const item = document.createElement('div');
    item.className = 'saved-item';

    const stageCount = routine.stages.length;
    let totalRounds = 0;
    routine.stages.forEach(s => totalRounds += Number(s.rounds || 1));

    item.innerHTML = `
      <div class="saved-item-info">
        <div class="saved-item-title">${routine.name}</div>
        <div class="saved-item-sub">${stageCount}개 단계 • 총 ${totalRounds} 라운드</div>
      </div>
      <div class="saved-item-btns">
        <button class="btn-item-load" data-idx="${idx}">불러오기</button>
        <button class="btn-item-del" data-idx="${idx}" title="삭제">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;

    item.querySelector('.btn-item-load').addEventListener('click', () => {
      currentPrepTime = routine.prepTime ?? 5;
      inputPrepTime.value = currentPrepTime;
      routineStages = JSON.parse(JSON.stringify(routine.stages));
      saveActiveRoutine();
      renderStageList();
      resetTimer();
      storageModal.classList.add('hidden');
    });

    item.querySelector('.btn-item-del').addEventListener('click', () => {
      if (confirm(`'${routine.name}' 루틴을 삭제하시겠습니까?`)) {
        routines.splice(idx, 1);
        saveLibrary(routines);
        renderSavedList();
      }
    });

    savedListBox.appendChild(item);
  });
}

// ==========================================
// 9. Event Listeners & Init
// ==========================================
btnStart.addEventListener('click', playTimer);
btnPause.addEventListener('click', pauseTimer);
btnNext.addEventListener('click', skipNext);
btnReset.addEventListener('click', resetTimer);

btnAddStage.addEventListener('click', addNewStage);

inputPrepTime.addEventListener('change', (e) => {
  currentPrepTime = Math.max(0, parseInt(e.target.value, 10) || 0);
  saveActiveRoutine();
});

btnOpenStorage.addEventListener('click', () => {
  renderSavedList();
  storageModal.classList.remove('hidden');
});

btnCloseModal.addEventListener('click', () => {
  storageModal.classList.add('hidden');
});

btnSaveRoutine.addEventListener('click', () => {
  const name = inputRoutineName.value.trim();
  if (!name) {
    alert("루틴 이름을 입력해주세요.");
    return;
  }
  const routines = getSavedLibrary();
  routines.unshift({
    name,
    prepTime: currentPrepTime,
    stages: JSON.parse(JSON.stringify(routineStages))
  });
  saveLibrary(routines);
  inputRoutineName.value = '';
  renderSavedList();
  alert("현재 루틴이 안전하게 보관되었습니다!");
});

// Bootstrapping
window.addEventListener('DOMContentLoaded', () => {
  loadActiveRoutine();
  inputPrepTime.value = currentPrepTime;
  renderStageList();
  resetTimer();
});
