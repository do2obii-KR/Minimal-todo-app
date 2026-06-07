// =============================================
// 0. 기존 데이터 마이그레이션 (데이터 보호)
// =============================================
function migrateData() {
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    let changed = false;
    tasks = tasks.map(task => {
        if (task.repeat === undefined)    { task.repeat = 0; changed = true; }
        if (task.lastDone === undefined)  { task.lastDone = null; changed = true; }
        if (task.necessity === undefined) { task.necessity = null; changed = true; }
        if (task.addedDate === undefined) { task.addedDate = null; changed = true; }
        return task;
    });
    if (changed) localStorage.setItem('myTasks', JSON.stringify(tasks));
}
migrateData();

// =============================================
// 1. HTML 요소 불러오기
// =============================================
const taskInput  = document.getElementById('task-input');
const addBtn     = document.getElementById('add-btn');
const taskList   = document.getElementById('task-list');
const tabRoutine = document.getElementById('tab-routine');
const tabWork    = document.getElementById('tab-work');
const tabShopping = document.getElementById('tab-shopping');

let currentTab = localStorage.getItem('lastActiveTab') || 'routine';

// =============================================
// 2. 탭에 따라 입력창 placeholder 변경
// =============================================
function updatePlaceholder() {
    taskInput.placeholder = currentTab === 'shopping'
        ? '사야 하는 제품을 입력하세요'
        : '새로운 할 일을 입력하세요';
}

// =============================================
// 3. 할 일 추가
// =============================================
addBtn.addEventListener('click', function() {
    const text = taskInput.value.trim();
    if (text === '') return;

    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    const today = new Date().toISOString().split('T')[0];

    tasks.push({
        id: Date.now(),
        tab: currentTab,
        text: text,
        urgency: 0,
        effort: 0,
        repeat: 0,
        lastDone: null,
        necessity: currentTab === 'shopping' ? 'optional' : null, // 쇼핑: 기본값 '선택'
        addedDate: currentTab === 'shopping' ? today : null        // 쇼핑: 추가일 기록
    });

    localStorage.setItem('myTasks', JSON.stringify(tasks));
    taskInput.value = '';
    renderTasks();
});

// =============================================
// 4. 루틴 밀린 비율 계산
// =============================================
function getOverdueRatio(task) {
    if (!task.repeat || task.repeat === 0) return null;
    if (!task.lastDone) return null;

    const today = new Date(); today.setHours(0,0,0,0);
    const last  = new Date(task.lastDone); last.setHours(0,0,0,0);
    const daysSinceDone = Math.floor((today - last) / (1000*60*60*24));
    const overdueDays = daysSinceDone - task.repeat;
    if (overdueDays <= 0) return 0;
    return overdueDays / task.repeat;
}

function ratioToUrgency(ratio) {
    if (ratio === null || ratio === 0) return null;
    if (ratio > 0.5)  return 3;
    if (ratio > 0.25) return 2;
    return 1;
}

// =============================================
// 5. 쇼핑 항목 잠금 여부 및 남은 날수 계산
// =============================================
const LOCK_DAYS = 3; // 숙려 기간

function getShoppingLockInfo(task) {
    if (task.necessity === 'essential') return { locked: false, remainDays: 0 };
    if (!task.addedDate) return { locked: false, remainDays: 0 };

    const today = new Date(); today.setHours(0,0,0,0);
    const added = new Date(task.addedDate); added.setHours(0,0,0,0);
    const daysPassed = Math.floor((today - added) / (1000*60*60*24));
    const remainDays = LOCK_DAYS - daysPassed;

    return {
        locked: remainDays > 0,
        remainDays: remainDays > 0 ? remainDays : 0
    };
}

// =============================================
// 6. 화면에 목록 그려주기
// =============================================
function renderTasks() {
    taskList.innerHTML = '';
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    let filteredTasks = tasks.filter(task => task.tab === currentTab);

    // --- 정렬 ---
    filteredTasks.sort((a, b) => {
        // 쇼핑 탭: 필수 → 선택(잠금해제) → 선택(잠금중) 순
        if (currentTab === 'shopping') {
            const aEssential = a.necessity === 'essential' ? 0 : 1;
            const bEssential = b.necessity === 'essential' ? 0 : 1;
            if (aEssential !== bEssential) return aEssential - bEssential;

            const aLocked = getShoppingLockInfo(a).locked ? 1 : 0;
            const bLocked = getShoppingLockInfo(b).locked ? 1 : 0;
            if (aLocked !== bLocked) return aLocked - bLocked;

            // 같은 그룹 내에서는 긴급도 내림차순
            return (b.urgency ?? 0) - (a.urgency ?? 0);
        }

        // 일상/업무 탭: 기존 정렬 로직
        const aUnassigned = ((a.urgency ?? 0) === 0 || (a.effort ?? 0) === 0);
        const bUnassigned = ((b.urgency ?? 0) === 0 || (b.effort ?? 0) === 0);

        if (aUnassigned && !bUnassigned) return -1;
        if (!aUnassigned && bUnassigned) return 1;

        if (!aUnassigned && !bUnassigned) {
            const aRatio = getOverdueRatio(a);
            const bRatio = getOverdueRatio(b);
            const aIsRoutine = a.repeat > 0 && aRatio !== null;
            const bIsRoutine = b.repeat > 0 && bRatio !== null;

            if (aIsRoutine && bIsRoutine) return bRatio - aRatio;

            if (aIsRoutine && !bIsRoutine) {
                const aEq = ratioToUrgency(aRatio) ?? 0;
                if (aEq !== b.urgency) return b.urgency - aEq;
                return a.effort - b.effort;
            }
            if (!aIsRoutine && bIsRoutine) {
                const bEq = ratioToUrgency(bRatio) ?? 0;
                if (a.urgency !== bEq) return bEq - a.urgency;
                return a.effort - b.effort;
            }
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

        // --- 상단: 텍스트 + 편집 버튼 ---
        const headerDiv = document.createElement('div');
        headerDiv.className = 'task-header';

        const textSpan = document.createElement('div');
        textSpan.style.fontWeight = 'bold';
        textSpan.style.fontSize = '18px';

        if (task.repeat > 0 && task.lastDone) {
            const today = new Date(); today.setHours(0,0,0,0);
            const last  = new Date(task.lastDone); last.setHours(0,0,0,0);
            const daysSince = Math.floor((today - last) / (1000*60*60*24));
            const overdue   = daysSince - task.repeat;
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
            const newText = prompt('내용을 수정하세요:', task.text);
            if (newText !== null && newText.trim() !== '') {
                task.text = newText.trim();
                localStorage.setItem('myTasks', JSON.stringify(tasks));
                renderTasks();
            }
        });

        headerDiv.appendChild(textSpan);
        headerDiv.appendChild(editBtn);
        div.appendChild(headerDiv);

        // --- 하단: 속성 버튼들 ---
        const propsDiv = document.createElement('div');
        propsDiv.className = 'props-container';

        // 긴급도 버튼 (모든 탭 공통)
        const urgencyBtn = document.createElement('button');
        urgencyBtn.className = `prop-btn urgency-${task.urgency ?? 0}`;
        urgencyBtn.innerText = urgencyIcons[task.urgency ?? 0];
        urgencyBtn.addEventListener('click', () => {
            task.urgency = ((task.urgency ?? 0) + 1) % 4;
            localStorage.setItem('myTasks', JSON.stringify(tasks));
            urgencyBtn.className = `prop-btn urgency-${task.urgency}`;
            urgencyBtn.innerText = urgencyIcons[task.urgency];
        });
        propsDiv.appendChild(urgencyBtn);

        if (currentTab !== 'shopping') {
            // 소요 자원 버튼 (일상/업무 탭만)
            const effortBtn = document.createElement('button');
            effortBtn.className = 'prop-btn';
            effortBtn.innerText = effortIcons[task.effort ?? 0];
            effortBtn.addEventListener('click', () => {
                task.effort = ((task.effort ?? 0) + 1) % 4;
                localStorage.setItem('myTasks', JSON.stringify(tasks));
                effortBtn.className = 'prop-btn';
                effortBtn.innerText = effortIcons[task.effort];
            });
            propsDiv.appendChild(effortBtn);

            // 반복 버튼 (일상/업무 탭만)
            const repeatBtn = document.createElement('button');
            repeatBtn.className = 'prop-btn';
            repeatBtn.innerText = task.repeat > 0 ? `🔁 ${task.repeat}일` : '⚪ 반복';
            repeatBtn.addEventListener('click', () => {
                const input = prompt('며칠 주기로 반복할까요?\n(숫자만 입력. 반복을 없애려면 0을 입력하세요)');
                if (input === null) return;
                const num = parseInt(input);
                if (isNaN(num) || num < 0) { alert('올바른 숫자를 입력해주세요.'); return; }
                task.repeat = num;
                if (num === 0) task.lastDone = null;
                localStorage.setItem('myTasks', JSON.stringify(tasks));
                repeatBtn.innerText = num > 0 ? `🔁 ${num}일` : '⚪ 반복';
            });
            propsDiv.appendChild(repeatBtn);

            // 완료 버튼
            const completeBtn = document.createElement('button');
            completeBtn.className = 'btn-list-complete';
            completeBtn.innerText = '완료';
            completeBtn.addEventListener('click', () => {
                if (task.repeat > 0) {
                    task.lastDone = new Date().toISOString().split('T')[0];
                    localStorage.setItem('myTasks', JSON.stringify(tasks));
                    alert('수고하셨습니다! 다음 예정일이 업데이트됐어요 🔁');
                    renderTasks();
                } else {
                    let allTasks = JSON.parse(localStorage.getItem('myTasks')) || [];
                    allTasks = allTasks.filter(t => t.id !== task.id);
                    localStorage.setItem('myTasks', JSON.stringify(allTasks));
                    renderTasks();
                }
            });
            propsDiv.appendChild(completeBtn);

        } else {
            // 필수/선택 버튼 (쇼핑 탭만)
            const necessityBtn = document.createElement('button');
            const isEssential = task.necessity === 'essential';
            necessityBtn.className = `prop-btn ${isEssential ? 'necessity-essential' : 'necessity-optional'}`;
            necessityBtn.innerText = isEssential ? '✅ 필수' : '💭 선택';
            necessityBtn.addEventListener('click', () => {
                task.necessity = isEssential ? 'optional' : 'essential';
                // 선택→필수로 바꿀 때 잠금 해제를 위해 addedDate 초기화
                if (task.necessity === 'essential') task.addedDate = null;
                else task.addedDate = new Date().toISOString().split('T')[0];
                localStorage.setItem('myTasks', JSON.stringify(tasks));
                renderTasks();
            });
            propsDiv.appendChild(necessityBtn);

            // 구매 버튼 (쇼핑 탭만)
            const lockInfo = getShoppingLockInfo(task);
            const buyBtn = document.createElement('button');
            buyBtn.className = 'btn-list-complete';

            if (lockInfo.locked) {
                buyBtn.innerText = `🔒 ${lockInfo.remainDays}일 후`;
                buyBtn.style.backgroundColor = '#adb5bd';
                buyBtn.style.cursor = 'not-allowed';
                buyBtn.addEventListener('click', () => {
                    alert(`💭 선택 항목은 추가 후 ${LOCK_DAYS}일이 지나야 구매할 수 있어요.\n앞으로 ${lockInfo.remainDays}일 남았습니다.\n정말 필요한 물건이라면 '필수'로 바꿔주세요!`);
                });
            } else {
                buyBtn.innerText = '🛒 구매';
                buyBtn.addEventListener('click', () => {
                    let allTasks = JSON.parse(localStorage.getItem('myTasks')) || [];
                    allTasks = allTasks.filter(t => t.id !== task.id);
                    localStorage.setItem('myTasks', JSON.stringify(allTasks));
                    renderTasks();
                });
            }
            propsDiv.appendChild(buyBtn);
        }

        div.appendChild(propsDiv);
        taskList.appendChild(div);
    });
}

// =============================================
// 7. 탭 전환
// =============================================
function setActiveTab(tab) {
    currentTab = tab;
    localStorage.setItem('lastActiveTab', currentTab);
    tabRoutine.classList.toggle('active', tab === 'routine');
    tabWork.classList.toggle('active', tab === 'work');
    tabShopping.classList.toggle('active', tab === 'shopping');
    updatePlaceholder();
    renderTasks();
}

tabRoutine.addEventListener('click',  () => setActiveTab('routine'));
tabWork.addEventListener('click',     () => setActiveTab('work'));
tabShopping.addEventListener('click', () => setActiveTab('shopping'));

setActiveTab(currentTab);

// =============================================
// 8. 오늘의 할 일 팝업 (일상/업무 탭만)
// =============================================
const popupOverlay  = document.getElementById('popup-overlay');
const popupTaskText = document.getElementById('popup-task-text');
const btnComplete   = document.getElementById('btn-complete');
const btnNext       = document.getElementById('btn-next');
const btnLater      = document.getElementById('btn-later');

let popupTasksList    = [];
let currentPopupIndex = 0;

function showTodayTask() {
    if (currentTab === 'shopping') return; // 쇼핑 탭에서는 팝업 없음

    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];

    let candidates = tasks.filter(task => {
        if (task.tab !== currentTab) return false;
        if (task.repeat > 0) {
            const ratio = getOverdueRatio(task);
            return ratioToUrgency(ratio) !== null;
        } else {
            return task.urgency > 0 && task.effort > 0;
        }
    });

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
        popupTaskText.innerText = popupTasksList[currentPopupIndex].text;
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
        tasks = tasks.map(t => {
            if (t.id === task.id) t.lastDone = new Date().toISOString().split('T')[0];
            return t;
        });
        localStorage.setItem('myTasks', JSON.stringify(tasks));
        alert('수고하셨습니다! 다음 예정일이 업데이트됐어요 🔁');
    } else {
        tasks = tasks.filter(t => t.id !== task.id);
        localStorage.setItem('myTasks', JSON.stringify(tasks));
        alert('수고하셨습니다! 완료 처리되었습니다.');
    }

    renderTasks();
    popupOverlay.classList.add('hidden');
});

btnNext.addEventListener('click',  () => { currentPopupIndex++; updatePopupUI(); });
btnLater.addEventListener('click', () => { popupOverlay.classList.add('hidden'); });

// =============================================
// 9. 모바일 스와이프 새로고침
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
// 10. 튜토리얼
// =============================================
const tutorialOverlay = document.getElementById('tutorial-overlay');
const elIndicator     = document.getElementById('step-indicator');
const elTitle         = document.getElementById('tutorial-title');
const elVisual        = document.getElementById('tutorial-visual');
const elText          = document.getElementById('tutorial-text');
const btnTutorialPrev = document.getElementById('btn-tutorial-prev');
const btnTutorialNext = document.getElementById('btn-tutorial-next');

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
        text: "새로 추가된 할 일은 속성이 부여될 때까지 목록의 가장 위에 고정됩니다. 버튼을 눌러, 해당 일이 얼마나 긴급한지, 소요 자원과 시간이 얼마나 필요한 일인지 설정하세요."
    },
    {
        title: "하나씩 시작해보기",
        visual: `<div class="mock-task"><div class="mock-task-title">주간 보고서 초안 작성</div><div class="mock-complete-btn">완료</div></div>`,
        text: "할 일을 고르기 어려우신가요? 앱을 실행 할 때마다 설정된 우선순위에 따라 가장 중요한 할 일 하나를 팝업으로 추천합니다."
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
