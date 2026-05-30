// 1. 필요한 HTML 요소들을 불러오기
const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-btn');
const taskList = document.getElementById('task-list');
const tabRoutine = document.getElementById('tab-routine');
const tabWork = document.getElementById('tab-work');

// 현재 선택된 탭 상태 저장 (기본값: 로컬 스토리지에 저장된 탭 또는 'routine')
let currentTab = localStorage.getItem('lastActiveTab') || 'routine'; 

// 2. 할 일을 추가하고 기기에 영구 저장하는 기능
addBtn.addEventListener('click', function() {
    const text = taskInput.value.trim();
    if (text === '') return;

    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    
    tasks.push({
        id: Date.now(),
        tab: currentTab,
        text: text,
        urgency: 0, 
        effort: 0   
    });

    localStorage.setItem('myTasks', JSON.stringify(tasks));
    taskInput.value = '';
    renderTasks(); 
});

// 데이터 저장 및 화면 새로고침을 동시에 처리하는 도우미 함수
function saveAndRender(tasks) {
    localStorage.setItem('myTasks', JSON.stringify(tasks));
    renderTasks();
}

// 3. 화면에 할 일 목록 그려주기 및 정렬 로직
function renderTasks() {
    taskList.innerHTML = ''; 
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    let filteredTasks = tasks.filter(task => task.tab === currentTab);

    // 정렬: 미지정된 항목(0)이 하나라도 있으면 무조건 맨 위로 올림
    filteredTasks.sort((a, b) => {
        const aUnassigned = ((a.urgency ?? 0) === 0 || (a.effort ?? 0) === 0);
        const bUnassigned = ((b.urgency ?? 0) === 0 || (b.effort ?? 0) === 0);

        if (aUnassigned && !bUnassigned) return -1; 
        if (!aUnassigned && bUnassigned) return 1;  
        
        // 둘 다 지정된 경우: 긴급도 내림차순(3->2->1) 후 소요 자원 오름차순(1->2->3)
        if (!aUnassigned && !bUnassigned) {
            if (b.urgency !== a.urgency) {
                return b.urgency - a.urgency;
            }
            return a.effort - b.effort;
        }
        return 0; 
    });

    // 아이콘 데이터베이스
    const urgencyIcons = ['⚪ 미지정', '🟢 여유', '🟡 보통', '🔴 긴급'];
    const effortIcons = ['⚪ 미지정', '🍊 가볍게', '🏀 중간', '🌍 묵직하게'];

    filteredTasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-item';

        // 상단 영역 (텍스트 + 편집 버튼을 묶는 상자)
        const headerDiv = document.createElement('div');
        headerDiv.className = 'task-header';

        const textSpan = document.createElement('div');
        textSpan.innerText = task.text;
        textSpan.style.fontWeight = 'bold';
        textSpan.style.fontSize = '18px';

        // [편집] 버튼 생성 (우측 상단 배치)
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

        // 하단 속성 버튼과 완료 버튼을 담을 상자
        const propsDiv = document.createElement('div');
        propsDiv.className = 'props-container';

        // 긴급도 버튼 생성
        const urgencyBtn = document.createElement('button');
        urgencyBtn.className = `prop-btn urgency-${task.urgency ?? 0}`;
        urgencyBtn.innerText = urgencyIcons[task.urgency ?? 0];
        
        urgencyBtn.addEventListener('click', () => {
            task.urgency = ((task.urgency ?? 0) + 1) % 4; 
            localStorage.setItem('myTasks', JSON.stringify(tasks));
            urgencyBtn.className = `prop-btn urgency-${task.urgency}`;
            urgencyBtn.innerText = urgencyIcons[task.urgency];
            renderTasks(); // 정렬 순서를 즉시 반영하기 위해 전체 새로고침
        });

        // 소요 자원 버튼 생성
        const effortBtn = document.createElement('button');
        effortBtn.className = 'prop-btn';
        effortBtn.innerText = effortIcons[task.effort ?? 0];
        
        effortBtn.addEventListener('click', () => {
            task.effort = ((task.effort ?? 0) + 1) % 4; 
            localStorage.setItem('myTasks', JSON.stringify(tasks));
            effortBtn.className = 'prop-btn';
            effortBtn.innerText = effortIcons[task.effort];
            renderTasks(); // 정렬 순서를 즉시 반영하기 위해 전체 새로고침
        });

        // [완료] 버튼 생성 (CSS에 의해 우측 하단 배치됨)
        const completeBtn = document.createElement('button');
        completeBtn.className = 'btn-list-complete';
        completeBtn.innerText = '완료';
        completeBtn.addEventListener('click', () => {
            tasks = tasks.filter(t => t.id !== task.id);
            localStorage.setItem('myTasks', JSON.stringify(tasks));
            renderTasks(); 
        });

        propsDiv.appendChild(urgencyBtn);
        propsDiv.appendChild(effortBtn);
        propsDiv.appendChild(completeBtn);
        div.appendChild(propsDiv);

        taskList.appendChild(div);
    });
}

// 4. 탭 전환 기능
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


// --- [오늘의 할 일 팝업 관련 로직] ---
const popupOverlay = document.getElementById('popup-overlay');
const popupTaskText = document.getElementById('popup-task-text');
const btnComplete = document.getElementById('btn-complete');
const btnNext = document.getElementById('btn-next');
const btnLater = document.getElementById('btn-later');

let popupTasksList = []; 
let currentPopupIndex = 0; 

function showTodayTask() {
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    
    // 현재 보고 있는 탭에 맞춰서 추천되도록 필터링 연동
    popupTasksList = tasks.filter(task => task.tab === currentTab && task.urgency > 0 && task.effort > 0);

    popupTasksList.sort((a, b) => {
        if (b.urgency !== a.urgency) {
            return b.urgency - a.urgency; 
        }
        return a.effort - b.effort; 
    });

    if (popupTasksList.length > 0) {
        currentPopupIndex = 0;
        updatePopupUI();
        popupOverlay.classList.remove('hidden'); 
    } else {
        console.log("오늘 추천해 드릴 할 일이 없습니다.");
    }
}

function updatePopupUI() {
    if (currentPopupIndex < popupTasksList.length) {
        popupTaskText.innerText = popupTasksList[currentPopupIndex].text;
        btnNext.style.display = 'inline-block'; 
    } else {
        popupTaskText.innerText = "모든 추천 업무를 확인했습니다!";
        btnNext.style.display = 'none'; 
    }
}

btnComplete.addEventListener('click', () => {
    if (currentPopupIndex >= popupTasksList.length) return; 

    const completedTaskId = popupTasksList[currentPopupIndex].id;
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    
    tasks = tasks.filter(task => task.id !== completedTaskId);
    localStorage.setItem('myTasks', JSON.stringify(tasks));
    
    alert("수고하셨습니다! 완료 처리되었습니다.");
    
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


// --- [모바일 스와이프 새로고침 감지 및 추천 연동] ---
let touchStart = 0;
window.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
        touchStart = e.touches[0].clientY;
    }
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (window.scrollY === 0 && touchStart > 0) {
        let touchEnd = e.changedTouches[0].clientY;
        // 위에서 아래로 손가락을 150픽셀 이상 쓸어내렸을 때 작동
        if (touchEnd - touchStart > 150) {
            showTodayTask(); // 현재 선택된 탭 기준 맞춤형 팝업 재등장!
        }
        touchStart = 0;
    }
}, { passive: true });


// --- [튜토리얼 기능 관련 로직] ---
const tutorialOverlay = document.getElementById('tutorial-overlay');
const elIndicator = document.getElementById('step-indicator');
const elTitle = document.getElementById('tutorial-title');
const elVisual = document.getElementById('tutorial-visual');
const elText = document.getElementById('tutorial-text');
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

    if (currentTutorialStep === 0) {
        btnTutorialPrev.style.display = 'none';
    } else {
        btnTutorialPrev.style.display = 'block';
    }

    if (currentTutorialStep === tutorialSteps.length - 1) {
        btnTutorialNext.innerText = "시작하기";
        btnTutorialNext.style.backgroundColor = "#28a745"; 
    } else {
        btnTutorialNext.innerText = "다음";
        btnTutorialNext.style.backgroundColor = "#343a40"; 
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
