// 1. 필요한 HTML 요소들을 불러오기
const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-btn');
const taskList = document.getElementById('task-list');
const tabRoutine = document.getElementById('tab-routine');
const tabWork = document.getElementById('tab-work');

// 현재 선택된 탭 상태 저장 (기본값: 일상)
let currentTab = 'routine'; 

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
        return 0; 
    });

    // 아이콘 데이터베이스
    const urgencyIcons = ['⚪ 미지정', '🟢 여유', '🟡 보통', '🔴 긴급'];
    const effortIcons = ['⚪ 미지정', '🍊 가볍게', '🏀 중간', '🌍 묵직하게'];

  filteredTasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-item';

        // [추가된 부분] 상단 영역 (텍스트 + 완료 버튼을 묶는 상자)
        const headerDiv = document.createElement('div');
        headerDiv.className = 'task-header';

        const textSpan = document.createElement('div');
        textSpan.innerText = task.text;
        textSpan.style.fontWeight = 'bold';
        textSpan.style.fontSize = '18px';

        // [추가된 부분] 목록 전용 완료 버튼
        const completeBtn = document.createElement('button');
        completeBtn.className = 'btn-list-complete';
        completeBtn.innerText = '완료';
        completeBtn.addEventListener('click', () => {
            // 현재 완료한 할 일을 전체 배열에서 걸러내고 다시 저장
            tasks = tasks.filter(t => t.id !== task.id);
            localStorage.setItem('myTasks', JSON.stringify(tasks));
            renderTasks(); // 지워진 상태로 화면 새로고침
        });

        headerDiv.appendChild(textSpan);
        headerDiv.appendChild(completeBtn);
        div.appendChild(headerDiv);

        // 버튼들을 담을 상자
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
        });

        propsDiv.appendChild(urgencyBtn);
        propsDiv.appendChild(effortBtn);
        div.appendChild(propsDiv);

        taskList.appendChild(div);
    });
}
// 4. 탭 전환 기능
tabRoutine.addEventListener('click', () => {
    currentTab = 'routine';
    tabRoutine.classList.add('active');
    tabWork.classList.remove('active');
    renderTasks();
});

tabWork.addEventListener('click', () => {
    currentTab = 'work';
    tabWork.classList.add('active');
    tabRoutine.classList.remove('active');
    renderTasks();
});

// 앱이 처음 켜질 때 저장된 목록 불러오기
renderTasks();

// --- [오늘의 할 일 팝업 관련 로직] ---
const popupOverlay = document.getElementById('popup-overlay');
const popupTaskText = document.getElementById('popup-task-text');
const btnComplete = document.getElementById('btn-complete');
const btnNext = document.getElementById('btn-next');
const btnLater = document.getElementById('btn-later');

let popupTasksList = []; // 팝업에 띄울 후보 목록
let currentPopupIndex = 0; // 현재 보고 있는 팝업의 순번

// 팝업에 띄울 할 일들 정리하고 화면에 보여주기
function showTodayTask() {
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    
    // 1. 현재 탭에 맞고, 속성이 모두 지정된(0이 아닌) 일만 걸러내기
    popupTasksList = tasks.filter(task => task.tab === currentTab && task.urgency > 0 && task.effort > 0);

    // 2. 우선순위 정렬 (기획하신 로직)
    popupTasksList.sort((a, b) => {
        if (b.urgency !== a.urgency) {
            return b.urgency - a.urgency; // 긴급도 내림차순 (빨강 3 -> 노랑 2 -> 초록 1)
        }
        return a.effort - b.effort; // 에너지 오름차순 (오렌지 1 -> 농구공 2 -> 지구 3)
    });

    if (popupTasksList.length > 0) {
        currentPopupIndex = 0;
        updatePopupUI();
        popupOverlay.classList.remove('hidden'); // 팝업 보이기
    } else {
        // 처음 테스트 시 매번 알림창이 뜨면 번거로울 수 있어, 알림 대신 조용히 넘어갑니다.
        console.log("오늘 추천해 드릴 할 일이 없습니다.");
    }
}

// 팝업 화면 글자 업데이트
function updatePopupUI() {
    if (currentPopupIndex < popupTasksList.length) {
        popupTaskText.innerText = popupTasksList[currentPopupIndex].text;
    } else {
        popupTaskText.innerText = "모든 추천 업무를 확인했습니다!";
        btnNext.style.display = 'none'; // 더 볼 일이 없으면 다른 일 버튼 숨기기
    }
}

// [완료] 버튼: 해당 할 일을 목록에서 완전히 삭제하고 팝업 닫기
btnComplete.addEventListener('click', () => {
    if (currentPopupIndex >= popupTasksList.length) return; // 이미 끝났으면 무시

    const completedTaskId = popupTasksList[currentPopupIndex].id;
    let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];
    
    // 완료된 일 빼고 다시 저장
    tasks = tasks.filter(task => task.id !== completedTaskId);
    localStorage.setItem('myTasks', JSON.stringify(tasks));
    
    alert("수고하셨습니다! 완료 처리되었습니다.");
    
    renderTasks(); // 뒤에 있는 배경 목록 새로고침
    popupOverlay.classList.add('hidden'); // 팝업 닫기
});

// [다른 일] 버튼: 다음 우선순위 할 일 보여주기
btnNext.addEventListener('click', () => {
    currentPopupIndex++;
    updatePopupUI();
});

// [나중에] 버튼: 팝업 닫기
btnLater.addEventListener('click', () => {
    popupOverlay.classList.add('hidden');
});

// 앱 처음 시작 시 팝업 띄우기 (약 0.5초 뒤에 자연스럽게 등장)
setTimeout(() => {
    showTodayTask();
}, 500);