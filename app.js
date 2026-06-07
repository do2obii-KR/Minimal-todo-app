// =============================================
// 0. 기존 데이터 마이그레이션 (데이터 보호)
// =============================================
function migrateData() {
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    let changed = false;
    tasks = tasks.map(task => {
        if (task.repeat === undefined) { task.repeat = 0; changed = true; }
        if (task.lastDone === undefined) { task.lastDone = null; changed = true; }
        return task;
    });
    if (changed) localStorage.setItem('myTasks', JSON.stringify(tasks));
}
migrateData();

// =============================================
// 1. 필요한 HTML 요소들을 불러오기
// =============================================
const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-btn');
const taskList = document.getElementById('task-list');
const tabRoutine = document.getElementById('tab-routine');
const tabWork = document.getElementById('tab-work');

let currentTab = localStorage.getItem('lastActiveTab') || 'routine';

// =============================================
// 2. 할 일 추가
// =============================================
addBtn.addEventListener('click', function() {
    const text = taskInput.value.trim();
    if (text === '') return;

    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    tasks.push({
        id: Date.now(),
        tab: currentTab,
        text: text,
        urgency: 0,
        effort: 0,
        repeat: 0,       // 반복 주기 (0 = 반복 안함)
        lastDone: null   // 마지막 완료일
    });

    localStorage.setItem('myTasks', JSON.stringify(tasks));
    taskInput.value = '';
    renderTasks();
});

// =============================================
// 3. 루틴 항목의 '밀린 비율' 계산 함수
// =============================================
function getOverdueRatio(task) {
    if (!task.repeat || task.repeat === 0) return null; // 반복 안함
    if (!task.lastDone) return null; // 한 번도 완료 안 함 → 팝업 추천에서 제외

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last = new Date(task.lastDone);
    last.setHours(0, 0, 0, 0);

    const daysSinceDone = Math.floor((today - last) / (1000 * 60 * 60 * 24));
    const overdueDays = daysSinceDone - task.repeat; // 예정일보다 며칠 밀렸는지
    if (overdueDays <= 0) return 0; // 아직 안 밀림
    return overdueDays / task.repeat; // 밀린 비율
}

// 루틴 밀린 비율 → 긴급도 숫자로 환산 (팝업 정렬용)
function ratioToUrgency(ratio) {
    if (ratio === null) return null; // 추천 제외
    if (ratio === 0) return null;    // 아직 안 밀림 → 추천 제외
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
}

// =============================================
// 4. 화면에 할 일 목록 그려주기
// =============================================
function renderTasks() {
    taskList.innerHTML = '';
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    let filteredTasks = tasks.filter(task => task.tab === currentTab);

    // 정렬
    filteredTasks.sort((a, b) => {
        const aUnassigned = ((a.urgency ?? 0) === 0 || (a.effort ?? 0) === 0);
        const bUnassigned = ((b.urgency ?? 0) === 0 || (b.effort ?? 0) === 0);

        // 미지정 항목은 무조건 맨 위
        if (aUnassigned && !bUnassigned) return -1;
        if (!aUnassigned && bUnassigned) return 1;

        // 둘 다 지정된 경우
        if (!aUnassigned && !bUnassigned) {
            const aRatio = getOverdueRatio(a);
            const bRatio = getOverdueRatio(b);
            const aIsRoutine = a.repeat > 0 && aRatio !== null;
            const bIsRoutine = b.repeat > 0 && bRatio !== null;

            // 루틴 항목은 [밀린 비율]로 정렬
            if (aIsRoutine && bIsRoutine) {
                return bRatio - aRatio;
            }
            // 루틴 vs 일반: 일반 항목의 긴급도 기준으로 비교
            if (aIsRoutine && !bIsRoutine) {
                const aUrgencyEq = ratioToUrgency(aRatio) ?? 0;
                if (aUrgencyEq !== b.urgency) return b.urgency - aUrgencyEq;
                return a.effort - b.effort;
            }
            if (!aIsRoutine && bIsRoutine) {
                const bUrgencyEq = ratioToUrgency(bRatio) ?? 0;
                if (a.urgency !== bUrgencyEq) return bUrgencyEq - a.urgency;
                return a.effort - b.effort;
            }
            // 둘 다 일반 항목
            if (b.urgency !== a.urgency) return b.urgency - a.urgency;
            return a.effort - b.effort;
        }
        return 0;
    });

    const urgencyIcons = ['⚪ 미지정', '🟢 여유', '🟡 보통', '🔴 긴급'];
    const effortIcons  = ['⚪ 미지정', '🍊 가볍게', '🏀 중간', '🌍 묵직하게'];

    filteredTasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-item';

        // 상단: 텍스트 + 편집 버튼
        const headerDiv = document.createElement('div');
        headerDiv.className = 'task-header';

        const textSpan = document.createElement('div');
        textSpan.style.fontWeight = 'bold';
        textSpan.style.fontSize = '18px';

        // 루틴 항목이면 밀린 날수 표시
        if (task.repeat > 0 && task.lastDone) {
            const today = new Date(); today.setHours(0,0,0,0);
            const last  = new Date(task.lastDone); last.setHours(0,0,0,0);
            const daysSince = Math.floor((today - last) / (1000*60*60*24));
            const overdue = daysSince - task.repeat;
            if (overdue > 0) {
                textSpan.innerHTML = `${task.text} <span style="font-size:13px; color:#e74c3c; font-weight:normal;">(${overdue}일 밀림)</span>`;
            } else {
                const remaining = task.repeat - daysSince;
                textSpan.innerHTML = `${task.text} <span style="font-size:13px; color:#27ae60; font-weight:normal;">(${remaining}일 후)</span>`;
            }
        } else {
            textSpan.innerText = task.text;
        }

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-list-edit';
        editBtn.innerText = '편집';
        editBtn.addEventListener('click', () => {
            const newText = prompt('할 일을 수정하세요:', task.text);
            if (newText !== null && newText.trim() !== '') {
                task.text = newText.trim();
                localStorage.setItem('myTasks', JSON.stringify(tasks));
                renderTasks();
            }
        });

        headerDiv.appendChild(textSpan);
        headerDiv.appendChild(editBtn);
        div.appendChild(headerDiv);

        // 하단: 속성 버튼들 + 완료 버튼
        const propsDiv = document.createElement('div');
        propsDiv.className = 'props-container';

        // 긴급도 버튼
        const urgencyBtn = document.createElement('button');
        urgencyBtn.className = `prop-btn urgency-${task.urgency ?? 0}`;
        urgencyBtn.innerText = urgencyIcons[task.urgency ?? 0];
        urgencyBtn.addEventListener('click', () => {
            task.urgency = ((task.urgency ?? 0) + 1) % 4;
            localStorage.setItem('myTasks', JSON.stringify(tasks));
            urgencyBtn.className = `prop-btn urgency-${task.urgency}`;
            urgencyBtn.innerText = urgencyIcons[task.urgency];
        });

        // 소요 자원 버튼
        const effortBtn = document.createElement('button');
        effortBtn.className = 'prop-btn';
        effortBtn.innerText = effortIcons[task.effort ?? 0];
        effortBtn.addEventListener('click', () => {
            task.effort = ((task.effort ?? 0) + 1) % 4;
            localStorage.setItem('myTasks', JSON.stringify(tasks));
            effortBtn.className = 'prop-btn';
            effortBtn.innerText = effortIcons[task.effort];
        });

        // 반복 버튼
        const repeatBtn = document.createElement('button');
        repeatBtn.className = 'prop-btn';
        repeatBtn.innerText = task.repeat > 0 ? `🔁 ${task.repeat}일` : '⚪ 반복';
        repeatBtn.addEventListener('click', () => {
            const input = prompt('며칠 주기로 반복할까요?\n(숫자만 입력. 반복을 없애려면 0을 입력하세요)');
            if (input === null) return; // 취소
            const num = parseInt(input);
            if (isNaN(num) || num < 0) {
                alert('올바른 숫자를 입력해주세요.');
                return;
            }
            task.repeat = num;
            if (num === 0) task.lastDone = null; // 반복 해제 시 초기화
            localStorage.setItem('myTasks', JSON.stringify(tasks));
            repeatBtn.innerText = num > 0 ? `🔁 ${num}일` : '⚪ 반복';
        });

        // 완료 버튼
        const completeBtn = document.createElement('button');
        completeBtn.className = 'btn-list-complete';
        completeBtn.innerText = '완료';
        completeBtn.addEventListener('click', () => {
            if (task.repeat > 0) {
                // 루틴 항목: 마지막 완료일만 오늘로 업데이트
                task.lastDone = new Date().toISOString().split('T')[0];
                localStorage.setItem('myTasks', JSON.stringify(tasks));
                alert('수고하셨습니다! 다음 예정일이 업데이트됐어요 🔁');
                renderTasks();
            } else {
                // 일회용 항목: 기존처럼 삭제
                let allTasks = JSON.parse(localStorage.getItem('myTasks')) || [];
                allTasks = allTasks.filter(t => t.id !== task.id);
                localStorage.setItem('myTasks', JSON.stringify(allTasks));
                renderTasks();
            }
        });

        propsDiv.appendChild(urgencyBtn);
        propsDiv.appendChild(effortBtn);
        propsDiv.appendChild(repeatBtn);
        propsDiv.appendChild(completeBtn);
        div.appendChild(propsDiv);

        taskList.appendChild(div);
    });
}

// =============================================
// 5. 탭 전환
// =============================================
tabRoutine.addEventListener('click', () => {
    currentTab = 'routine';
    localStorage.setItem('lastActiveTab', currentTab);
    tabRoutine.classList.add('active');
    tabWork.classList.remove('active');
    renderTasks();
});

tabWork.addEventListener('click', () => {
    currentTab = 'work';
    localStorage.setItem('lastActiveTab', currentTab);
    tabWork.classList.add('active');
    tabRoutine.classList.remove('active');
    renderTasks();
});

if (currentTab === 'work') {
    tabWork.classList.add('active');
    tabRoutine.classList.remove('active');
} else {
    tabRoutine.classList.add('active');
    tabWork.classList.remove('active');
}
renderTasks();

// =============================================
// 6. 오늘의 할 일 팝업
// =============================================
const popupOverlay  = document.getElementById('popup-overlay');
const popupTaskText = document.getElementById('popup-task-text');
const btnComplete   = document.getElementById('btn-complete');
const btnNext       = document.getElementById('btn-next');
const btnLater      = document.getElementById('btn-later');

let popupTasksList   = [];
let currentPopupIndex = 0;

function showTodayTask() {
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];

    // 팝업 후보 목록 만들기
    let candidates = tasks.filter(task => {
        if (task.tab !== currentTab) return false;

        if (task.repeat > 0) {
            // 루틴: 밀린 비율 기반 긴급도 환산값이 있어야 추천
            const ratio = getOverdueRatio(task);
            return ratioToUrgency(ratio) !== null;
        } else {
            // 일반: 긴급도 & 소요 자원 둘 다 지정돼야 추천
            return task.urgency > 0 && task.effort > 0;
        }
    });

    // 팝업 정렬
    candidates.sort((a, b) => {
        const aUrgency = a.repeat > 0 ? (ratioToUrgency(getOverdueRatio(a)) ?? 0) : a.urgency;
        const bUrgency = b.repeat > 0 ? (ratioToUrgency(getOverdueRatio(b)) ?? 0) : b.urgency;
        if (bUrgency !== aUrgency) return bUrgency - aUrgency;
        return (a.effort ?? 0) - (b.effort ?? 0);
    });

    popupTasksList = candidates;

    if (popupTasksList.length > 0) {
        currentPopupIndex = 0;
        updatePopupUI();
        popupOverlay.classList.remove('hidden');
    }
}

function updatePopupUI() {
    if (currentPopupIndex < popupTasksList.length) {
        const task = popupTasksList[currentPopupIndex];
        popupTaskText.innerText = task.text;
        btnNext.style.display = 'inline-block';
    } else {
        popupTaskText.innerText = '모든 추천 업무를 확인했습니다!';
        btnNext.style.display = 'none';
    }
}

btnComplete.addEventListener('click', () => {
    if (currentPopupIndex >= popupTasksList.length) return;

    const task = popupTasksList[currentPopupIndex];
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];

    if (task.repeat > 0) {
        // 루틴: 완료일 업데이트
        tasks = tasks.map(t => {
            if (t.id === task.id) t.lastDone = new Date().toISOString().split('T')[0];
            return t;
        });
        localStorage.setItem('myTasks', JSON.stringify(tasks));
        alert('수고하셨습니다! 다음 예정일이 업데이트됐어요 🔁');
    } else {
        // 일회용: 삭제
        tasks = tasks.filter(t => t.id !== task.id);
        localStorage.setItem('myTasks', JSON.stringify(tasks));
        alert('수고하셨습니다! 완료 처리되었습니다.');
    }

    renderTasks();
    popupOverlay.classList.add('hidden');
});

btnNext.addEventListener('click', () => {
    currentPopupIndex++;
    updatePopupUI();
});

btnLater.addEventListener('click', () => {
    popupOverlay.classList.add('hidden');
});

// =============================================
// 7. 모바일 스와이프 새로고침
// =============================================
let touchStart = 0;
window.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) touchStart = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (window.scrollY === 0 && touchStart > 0) {
        const touchEnd = e.changedTouches[0].clientY;
        if (touchEnd - touchStart > 150) showTodayTask();
        touchStart = 0;
    }
}, { passive: true });

// =============================================
// 8. 튜토리얼
// =============================================
const tutorialOverlay  = document.getElementById('tutorial-overlay');
const elIndicator      = document.getElementById('step-indicator');
const elTitle          = document.getElementById('tutorial-title');
const elVisual         = document.getElementById('tutorial-visual');
const elText           = document.getElementById('tutorial-text');
const btnTutorialPrev  = document.getElementById('btn-tutorial-prev');
const btnTutorialNext  = document.getElementById('btn-tutorial-next');

let currentTutorialStep = 0;

const tutorialSteps = [
    { title: "", visual: "", text: "필요한 기능만 갖춘 당신의 할 일 도우미" },
    {
        title: "일상과 업무 탭 분리",
        visual: `<div class="mock-tab-container"><div class="mock-tab active">일상</div><div class="mock-tab">업무</div></div>`,
        text: "상단에서 '일상'과 '업무' 메뉴를 이용할 수 있습니다. 각 탭에 입력된 할 일들은 서로 독립적으로 저장됩니다. 퇴근 후에는 온전히 당신의 일상에 집중하세요."
    },
    {
        title: "단순하고 빠른 기록",
        visual: `<div class="mock-input-container"><div class="mock-input">주간 보고서 초안 작성...</div><div class="mock-btn">입력</div></div>`,
        text: "지금 떠오른 할 일을 텍스트로 입력해서 빠르게 목록에 추가하세요. 할 일이 머릿속에 쌓이면 당신의 어깨를 짓누르게 됩니다. 적어두고, 잠시 잊으셔도 좋습니다."
    },
    {
        title: "과업에 순서 부여하기",
        visual: `<div class="mock-props"><div class="mock-prop-btn" style="background:#f8d7da; border-color:#f5c6cb;">🔴 긴급</div><div class="mock-prop-btn" style="background:#f1f1f1;">🏀 중간</div></div>`,
        text: "새로 추가된 할 일은 속성이 부여될 때까지 목록의 가장 위에 고정됩니다. 버튼을 눌러, 해당 일이 얼마나 긴급한지, 소요 자원과 시간이 얼마나 필요한 일인지 설정하세요. 두 가지 속성에 맞게 과업의 우선순위가 자동 정렬됩니다."
    },
    {
        title: "하나씩 시작해보기",
        visual: `<div class="mock-task"><div class="mock-task-title">주간 보고서 초안 작성</div><div class="mock-complete-btn">완료</div></div>`,
        text: "할 일을 고르기 어려우신가요? 앱을 실행 할 때마다 설정된 우선순위에 따라 가장 중요한 할 일 하나를 팝업으로 추천합니다. 추천된 일부터 시작하셔도 되고, 잠시 미루셔도 좋습니다."
    }
];

function updateTutorialUI() {
    const stepData = tutorialSteps[currentTutorialStep];
    elIndicator.innerText = `${currentTutorialStep + 1} / ${tutorialSteps.length}`;
    elText.innerText = stepData.text;

    if (stepData.title === "") {
        elTitle.style.display = 'none';
        elVisual.style.display = 'none';
        elText.classList.add('text-center');
    } else {
        elTitle.style.display = 'block';
        elTitle.innerText = stepData.title;
        elVisual.style.display = 'flex';
        elVisual.innerHTML = stepData.visual;
        elText.classList.remove('text-center');
    }

    btnTutorialPrev.style.display = currentTutorialStep === 0 ? 'none' : 'block';

    if (currentTutorialStep === tutorialSteps.length - 1) {
        btnTutorialNext.innerText = '시작하기';
        btnTutorialNext.style.backgroundColor = '#28a745';
    } else {
        btnTutorialNext.innerText = '다음';
        btnTutorialNext.style.backgroundColor = '#343a40';
    }
}

btnTutorialNext.addEventListener('click', () => {
    if (currentTutorialStep < tutorialSteps.length - 1) {
        currentTutorialStep++;
        updateTutorialUI();
    } else {
        localStorage.setItem('minimalTodoTutorialDone', 'true');
        tutorialOverlay.classList.add('hidden');
        showTodayTask();
    }
});

btnTutorialPrev.addEventListener('click', () => {
    if (currentTutorialStep > 0) {
        currentTutorialStep--;
        updateTutorialUI();
    }
});

setTimeout(() => {
    const isTutorialDone = localStorage.getItem('minimalTodoTutorialDone');
    if (isTutorialDone === 'true') {
        showTodayTask();
    } else {
        currentTutorialStep = 0;
        updateTutorialUI();
        tutorialOverlay.classList.remove('hidden');
    }
}, 500);
