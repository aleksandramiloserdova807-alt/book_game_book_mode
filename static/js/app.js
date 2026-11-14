
document.addEventListener("DOMContentLoaded", function () {

    const map = document.getElementById("game-map");
    const mapFrame = document.getElementById("map-frame");

    // --------------------------------
    // ПАРАМЕТРЫ КАРТЫ
    // --------------------------------

    const columns = 30;
    const rows = 20;

    const radius = 20;
    const hexWidth = Math.sqrt(3) * radius;
    const hexHeight = radius * 2;

    const svgNS = "http://www.w3.org/2000/svg";

    // --------------------------------
    // ГЕОМЕТРИЯ ШЕСТИУГОЛЬНИКОВ
    // --------------------------------

    const hexOffsets = [];

    for (let i = 0; i < 6; i++) {

        const angle = (-90 + i * 60) * Math.PI / 180;

        hexOffsets.push({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        });
    }

    // --------------------------------
    // РАЗМЕРЫ КАРТЫ
    // --------------------------------

    const contentWidth =
        columns * hexWidth + hexWidth / 2;

    const contentHeight =
        (rows - 1) * radius * 1.5 + hexHeight;

    const paddingX = hexWidth * 6;
    const paddingY = hexHeight * 6;

    const mapWidth = contentWidth + paddingX * 2;
    const mapHeight = contentHeight + paddingY * 2;

    // --------------------------------
    // РАЗМЕР НЕПОДВИЖНОЙ РАМКИ
    // --------------------------------

    function updateFrameSize() {

        const availableWidth = window.innerWidth - 32;
        const availableHeight = window.innerHeight - 32;

        const scale = Math.min(
            availableWidth / mapWidth,
            availableHeight / mapHeight
        );

        mapFrame.style.width = `${mapWidth * scale}px`;
        mapFrame.style.height = `${mapHeight * scale}px`;
    }

    updateFrameSize();

    window.addEventListener("resize", updateFrameSize);

    // --------------------------------
    // СОЗДАНИЕ SVG
    // --------------------------------

    const svg = document.createElementNS(svgNS, "svg");

    svg.setAttribute(
        "viewBox",
        `0 0 ${mapWidth} ${mapHeight}`
    );

    svg.setAttribute(
        "preserveAspectRatio",
        "xMidYMid meet"
    );

    svg.setAttribute("class", "hex-map");

    const fragment = document.createDocumentFragment();

    // --------------------------------
    // ПОСТРОЕНИЕ ВСЕХ 600 КЛЕТОК
    // --------------------------------

    for (let row = 0; row < rows; row++) {

        for (let col = 0; col < columns; col++) {

            const centerX =
                paddingX +
                hexWidth / 2 +
                col * hexWidth +
                (row % 2) * hexWidth / 2;

            const centerY =
                paddingY +
                radius +
                row * radius * 1.5;

            const points = hexOffsets.map(function (offset) {

                return `${centerX + offset.x},${centerY + offset.y}`;

            });

            const hexagon = document.createElementNS(
                svgNS,
                "polygon"
            );

            hexagon.setAttribute("points", points.join(" "));
            hexagon.setAttribute("class", "hex-cell");

            hexagon.setAttribute("data-column", col + 1);
            hexagon.setAttribute("data-row", row + 1);

            hexagon.setAttribute(
                "data-cell-id",
                (row * columns) + col + 1
            );

            fragment.appendChild(hexagon);
        }
    }

    svg.appendChild(fragment);

    // --------------------------------
    // РАМКА ВОКРУГ ИГРОВОЙ ОБЛАСТИ
    // --------------------------------

    const mapBorder = document.createElementNS(svgNS, "rect");

    mapBorder.setAttribute("x", 0);
    mapBorder.setAttribute("y", 0);
    mapBorder.setAttribute("width", mapWidth);
    mapBorder.setAttribute("height", mapHeight);
    mapBorder.setAttribute("fill", "none");
    mapBorder.setAttribute("stroke", "#dedede");
    mapBorder.setAttribute("stroke-width", "1.2");
    mapBorder.setAttribute("vector-effect", "non-scaling-stroke");

    svg.appendChild(mapBorder);

    mapFrame.appendChild(svg);

    console.log("Карта создана: 600 ячеек");

    // --------------------------------
    // МАСШТАБ И ПОЛОЖЕНИЕ КАРТЫ
    // --------------------------------

    const view = {
        x: 0,
        y: 0,
        width: mapWidth,
        height: mapHeight
    };

    const maxWidth = mapWidth;
    const minWidth = mapWidth / 12;

    // --------------------------------
    // ОГРАНИЧЕНИЕ ПЕРЕМЕЩЕНИЯ
    // --------------------------------

    function limitView() {

        view.x = Math.max(
            0,
            Math.min(view.x, mapWidth - view.width)
        );

        view.y = Math.max(
            0,
            Math.min(view.y, mapHeight - view.height)
        );
    }

    function updateViewBox() {

        limitView();

        svg.setAttribute(
            "viewBox",
            `${view.x} ${view.y} ${view.width} ${view.height}`
        );

        updatePopupPosition();
    }

    // --------------------------------
    // ПЕРЕХОД К КЛЕТКЕ ПО CELL_ID
    // --------------------------------

    function goToCell(cellId) {

        const cell = svg.querySelector(
            `.hex-cell[data-cell-id="${cellId}"]`
        );

        if (!cell) {
            console.error("Клетка не найдена:", cellId);
            return;
        }

        const column = Number(cell.dataset.column);
        const row = Number(cell.dataset.row);

        const centerX =
            paddingX +
            hexWidth / 2 +
            (column - 1) * hexWidth +
            ((row - 1) % 2) * hexWidth / 2;

        const centerY =
            paddingY +
            radius +
            (row - 1) * radius * 1.5;

        // Сохраняем текущий масштаб.

        view.x = centerX - view.width / 2;
        view.y = centerY - view.height / 2;

        updateViewBox();

        // Выделяем выбранную клетку.

        if (selectedCell) {
            selectedCell.classList.remove("selected");
        }

        selectedCell = cell;
        cell.classList.add("selected");

        loadCellData(cell);
    }

    // --------------------------------
    // ПЕРЕВОД КООРДИНАТ МЫШИ В SVG
    // --------------------------------

    function getViewScale() {

        const rect = svg.getBoundingClientRect();

        return Math.min(
            rect.width / view.width,
            rect.height / view.height
        );
    }

    function mouseToSvg(event) {

        const rect = svg.getBoundingClientRect();

        const scale = getViewScale();

        const renderedWidth = view.width * scale;
        const renderedHeight = view.height * scale;

        const offsetX = (rect.width - renderedWidth) / 2;
        const offsetY = (rect.height - renderedHeight) / 2;

        return {
            x: view.x + (event.clientX - rect.left - offsetX) / scale,
            y: view.y + (event.clientY - rect.top - offsetY) / scale
        };
    }

    // --------------------------------
    // ОКОШКО ИНФОРМАЦИИ
    // --------------------------------

    const popup = document.createElement("div");

    popup.className = "cell-info-popup";

    const popupTitle = document.createElement("div");
    popupTitle.className = "cell-info-title";

    const popupCoordinates = document.createElement("div");
    popupCoordinates.className = "cell-info-coordinates";

    const popupTask = document.createElement("div");
    popupTask.className = "cell-info-task";

    popup.appendChild(popupTitle);
    popup.appendChild(popupCoordinates);
    popup.appendChild(popupTask);

    mapFrame.appendChild(popup);

    let selectedCell = null;
    let selectionRequest = 0;

    // --------------------------------
    // АВТОМАТИЧЕСКОЕ ЗАКРЫТИЕ ОКОШКА
    // --------------------------------

    let popupIdleTimer = null;

    const POPUP_IDLE_TIMEOUT = 15 * 60 * 1000;

    function resetPopupIdleTimer() {

        clearTimeout(popupIdleTimer);

        if (!selectedCell) return;

        popupIdleTimer = setTimeout(function () {

            hideCellInfo();

        }, POPUP_IDLE_TIMEOUT);
    }

    function hideCellInfo() {

        clearTimeout(popupIdleTimer);

        popup.classList.remove("visible");

        if (selectedCell) {
            selectedCell.classList.remove("selected");
        }

        selectedCell = null;

        // Игнорируем результат незавершённой загрузки клетки.

        selectionRequest++;
    }

    function updatePopupPosition() {

        if (!selectedCell) return;

        const cellRect = selectedCell.getBoundingClientRect();
        const mapRect = mapFrame.getBoundingClientRect();

        popup.classList.add("visible");

        const popupWidth = popup.offsetWidth;
        const popupHeight = popup.offsetHeight;

        let left =
            cellRect.left +
            cellRect.width / 2 -
            popupWidth / 2 -
            mapRect.left;

        let top =
            cellRect.top -
            popupHeight -
            8 -
            mapRect.top;

        popup.classList.remove("below");

        if (top < 8) {

            top = cellRect.bottom + 8 - mapRect.top;

            popup.classList.add("below");
        }

        left = Math.max(
            8,
            Math.min(left, map.clientWidth - popupWidth - 8)
        );

        top = Math.max(
            8,
            Math.min(top, map.clientHeight - popupHeight - 8)
        );

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }

    function showCellInfo(cell, data = null) {

        const column = cell.dataset.column;
        const row = cell.dataset.row;

        if (data) {

            popupTitle.textContent =
                `Клетка № ${data.cell_id}`;

            popupTask.textContent = data.task || "Задание отсутствует.";

        } else {

            popupTitle.textContent =
                `Клетка (${column}, ${row})`;

            popupTask.textContent = "Загрузка данных...";
        }

        popupCoordinates.textContent =
            `Столбец: ${column} · Строка: ${row}`;

        updatePopupPosition();
        resetPopupIdleTimer();
    }

    // --------------------------------
    // ЗАГРУЗКА ДАННЫХ ВЫБРАННОЙ КЛЕТКИ
    // --------------------------------

    async function loadCellData(cell) {

        const column = Number(cell.dataset.column);
        const row = Number(cell.dataset.row);

        if (cell.__cellData) {

            showCellInfo(cell, cell.__cellData);

            return;
        }

        const currentRequest = ++selectionRequest;

        showCellInfo(cell);

        try {

            const response = await fetch(
                `/api/cells/${column}/${row}`
            );

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.error || `Ошибка сервера: ${response.status}`
                );
            }

            cell.__cellData = data.cell;

            if (
                selectedCell !== cell ||
                currentRequest !== selectionRequest
            ) {
                return;
            }

            showCellInfo(cell, data.cell);

            console.log("Загружены данные клетки:", data.cell);

        } catch (error) {

            console.error("Ошибка загрузки клетки:", error);

            if (
                selectedCell !== cell ||
                currentRequest !== selectionRequest
            ) {
                return;
            }

            popupTask.textContent =
                "Не удалось загрузить данные. Нажмите на клетку ещё раз.";
        }
    }

    // --------------------------------
    // МАСШТАБИРОВАНИЕ КОЛЕСОМ МЫШИ
    // --------------------------------

    svg.addEventListener("wheel", function (event) {

        event.preventDefault();

        const anchor = mouseToSvg(event);

        const zoomFactor = event.deltaY < 0 ? 0.9 : 1.1;

        const newWidth = Math.min(
            maxWidth,
            Math.max(minWidth, view.width * zoomFactor)
        );

        const scale = newWidth / view.width;
        const newHeight = view.height * scale;

        const relativeX = (anchor.x - view.x) / view.width;
        const relativeY = (anchor.y - view.y) / view.height;

        view.x = anchor.x - relativeX * newWidth;
        view.y = anchor.y - relativeY * newHeight;

        view.width = newWidth;
        view.height = newHeight;

        updateViewBox();

    }, { passive: false });

    // --------------------------------
    // ПЕРЕМЕЩЕНИЕ КАРТЫ
    // --------------------------------

    let dragging = false;
    let hasDragged = false;
    let suppressNextClick = false;

    let startX = 0;
    let startY = 0;

    let startViewX = 0;
    let startViewY = 0;

    let dragScale = 1;

    svg.addEventListener("pointerdown", function (event) {

        if (event.button !== 0) return;

        dragging = true;
        hasDragged = false;
        suppressNextClick = false;

        startX = event.clientX;
        startY = event.clientY;

        startViewX = view.x;
        startViewY = view.y;

        dragScale = getViewScale();

        svg.setPointerCapture(event.pointerId);

        svg.classList.add("dragging");
    });

    svg.addEventListener("pointermove", function (event) {

        if (!dragging) return;

        const distance = Math.hypot(
            event.clientX - startX,
            event.clientY - startY
        );

        if (distance > 5) {
            hasDragged = true;
        }

        if (!hasDragged) return;

        const deltaX =
            (event.clientX - startX) / dragScale;

        const deltaY =
            (event.clientY - startY) / dragScale;

        view.x = startViewX - deltaX;
        view.y = startViewY - deltaY;

        updateViewBox();
    });

    function stopDragging() {

        if (hasDragged) {
            suppressNextClick = true;
        }

        dragging = false;

        svg.classList.remove("dragging");
    }

    svg.addEventListener("pointerup", stopDragging);
    svg.addEventListener("pointercancel", stopDragging);
    svg.addEventListener("lostpointercapture", stopDragging);

    // --------------------------------
    // ВЫБОР КЛЕТКИ
    // --------------------------------

    svg.addEventListener("click", function (event) {

        if (suppressNextClick) {

            suppressNextClick = false;

            return;
        }

        const element = document.elementFromPoint(
            event.clientX,
            event.clientY
        );

        if (!element) return;

        const cell = element.closest(".hex-cell");

        if (!cell) {

            hideCellInfo();

            return;
        }

        if (!cell) return;

        if (selectedCell) {
            selectedCell.classList.remove("selected");
        }

        cell.classList.add("selected");

        selectedCell = cell;

        console.log("Выбрана клетка:", {
            column: Number(cell.dataset.column),
            row: Number(cell.dataset.row)
        });

        loadCellData(cell);
    });

    // --------------------------------
    // СБРОС ТАЙМЕРА ПРИ АКТИВНОСТИ
    // --------------------------------

    document.addEventListener("pointerdown", function () {

        resetPopupIdleTimer();

    });

    document.addEventListener("keydown", function () {

        resetPopupIdleTimer();

    });

    document.addEventListener("wheel", function () {

        resetPopupIdleTimer();

    }, { passive: true });

    document.addEventListener("touchstart", function () {

        resetPopupIdleTimer();

    }, { passive: true });

    // --------------------------------
    // ИЗМЕНЕНИЕ РАЗМЕРА ОКНА
    // --------------------------------

    window.addEventListener("resize", function () {

        updatePopupPosition();

    });


    // --------------------------------
    // ПРОФИЛЬ МАСТЕРА
    // --------------------------------

    const profileButton = document.getElementById(
        "master-profile-button"
    );

    const profileWindow = document.getElementById(
        "master-profile-window"
    );

    const mainTabs = document.querySelectorAll(
        ".master-profile-main-tab"
    );

    const mainPanels = document.querySelectorAll(
        ".master-profile-main-panel"
    );

    const subTabs = document.querySelectorAll(
        ".master-profile-subtab"
    );

    const subPanels = document.querySelectorAll(
        ".master-profile-subpanel"
    );

    const playersPanel = document.querySelector(
        '.master-profile-main-panel[data-main-panel="players"]'
    );

    const tasksPanel = document.querySelector(
        '.master-profile-subpanel[data-subpanel="list"]'
    );

    let tasksLoaded = false;
    let tasksLoading = false;

    let playersLoaded = false;
    let playersLoading = false;


    // --------------------------------
    // ОТРИСОВКА СПИСКА ИГРОКОВ
    // --------------------------------

    function renderPlayers(players) {

        playersPanel.replaceChildren();

        const list = document.createElement("div");
        list.className = "player-list";

        if (!players.length) {

            const emptyMessage = document.createElement("div");

            emptyMessage.className = "player-list-empty";
            emptyMessage.textContent = "Других игроков пока нет.";

            list.appendChild(emptyMessage);
            playersPanel.appendChild(list);

            return;
        }

        players.forEach(function (player) {

            const item = document.createElement("div");
            item.className = "player-list-item";

            const identity = document.createElement("div");
            identity.className = "player-list-identity";

            if (player.is_master) {

                const masterBadge = document.createElement("span");

                masterBadge.className = "player-master-badge";
                masterBadge.textContent = "М";
                masterBadge.title = "Мастер";

                identity.appendChild(masterBadge);

            } else {

                const colorDot = document.createElement("span");

                colorDot.className = "player-color-dot";

                const playerColor = String(
                    player.color || "#ffffff"
                ).trim();

                if (
                    window.CSS &&
                    CSS.supports("color", playerColor)
                ) {
                    colorDot.style.backgroundColor = playerColor;
                } else {
                    colorDot.style.backgroundColor = "#ffffff";
                }

                colorDot.title = "Цвет игрока";

                identity.appendChild(colorDot);
            }

            const name = document.createElement("span");

            name.className = "player-list-name";
            name.textContent = player.name;

            identity.appendChild(name);

            item.appendChild(identity);

            // У мастеров счётчики не отображаются.

            if (!player.is_master) {

                const counts = document.createElement("div");
                counts.className = "player-task-counts";

                // Сданные и принятые задания.

                const acceptedCount = document.createElement("span");

                acceptedCount.className = "player-accepted-count";
                acceptedCount.textContent = player.accepted_count ?? 0;
                acceptedCount.title = "Сданные и принятые задания";

                // Сданные, но ещё не принятые задания.

                const pendingCount = document.createElement("span");

                pendingCount.className = "player-pending-count";
                pendingCount.textContent = player.pending_count ?? 0;
                pendingCount.title = "Сданные, но ещё не принятые задания";

                counts.appendChild(acceptedCount);
                counts.appendChild(pendingCount);

                item.appendChild(counts);
            }

            list.appendChild(item);
        });

        playersPanel.appendChild(list);
    }


    // --------------------------------
    // ЗАГРУЗКА СПИСКА ИГРОКОВ
    // --------------------------------

    async function loadPlayers() {

        if (playersLoading) return;

        playersLoading = true;

        playersPanel.replaceChildren();

        const loadingMessage = document.createElement("div");

        loadingMessage.className = "player-list-message";
        loadingMessage.textContent = "Загрузка игроков...";

        playersPanel.appendChild(loadingMessage);

        try {

            const response = await fetch("/api/players");

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.error || `Ошибка сервера: ${response.status}`
                );
            }

            renderPlayers(data.players);

            playersLoaded = true;

        } catch (error) {

            console.error("Ошибка загрузки игроков:", error);

            playersPanel.replaceChildren();

            const errorMessage = document.createElement("div");

            errorMessage.className = "player-list-message";
            errorMessage.textContent =
                "Не удалось загрузить список игроков.";

            playersPanel.appendChild(errorMessage);

        } finally {

            playersLoading = false;
        }
    }

    // --------------------------------
    // ОТРИСОВКА СПИСКА ЗАДАНИЙ
    // --------------------------------

    function renderTasks(tasks) {

        tasksPanel.replaceChildren();

        const list = document.createElement("div");
        list.className = "task-list";

        if (!tasks.length) {

            const emptyMessage = document.createElement("div");

            emptyMessage.className = "task-list-message";
            emptyMessage.textContent = "Список заданий пока пуст.";

            list.appendChild(emptyMessage);
            tasksPanel.appendChild(list);

            return;
        }

        tasks.forEach(function (task) {

            const item = document.createElement("div");
            item.className = "task-list-item";

            item.style.cursor = "pointer";

            item.addEventListener("click", function () {
                goToCell(task.cell_id);
            });

            const taskText = document.createElement("span");
            taskText.className = "task-list-text";
            taskText.textContent = task.task;

            item.appendChild(taskText);

            list.appendChild(item);
        });

        tasksPanel.appendChild(list);
    }


    // --------------------------------
    // ЗАГРУЗКА СПИСКА ЗАДАНИЙ
    // --------------------------------

    async function loadTasks() {

        if (tasksLoading || tasksLoaded) return;

        tasksLoading = true;

        tasksPanel.replaceChildren();

        const loadingMessage = document.createElement("div");
        loadingMessage.className = "task-list-message";
        loadingMessage.textContent = "Загружаем список заданий...";

        tasksPanel.appendChild(loadingMessage);

        console.log("Плашка загрузки добавлена");

        try {
            const response = await fetch("/api/tasks");

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.error || `Ошибка сервера: ${response.status}`
                );
            }

            renderTasks(data.tasks);

            tasksLoaded = true;

        } catch (error) {

            console.error("Ошибка загрузки списка заданий:", error);

            tasksPanel.replaceChildren();

            const errorMessage = document.createElement("div");

            errorMessage.className = "task-list-message";
            errorMessage.textContent =
                "Не удалось загрузить список заданий.";

            tasksPanel.appendChild(errorMessage);

        } finally {

            tasksLoading = false;
        }
    }

    // --------------------------------
    // ОТКРЫТИЕ И ЗАКРЫТИЕ ПРОФИЛЯ
    // --------------------------------

    profileButton.addEventListener("click", function (event) {

        event.stopPropagation();

        profileWindow.classList.toggle("visible");

        if (
            profileWindow.classList.contains("visible") &&
            !playersLoaded
        ) {
            loadPlayers();
        }
    });

    document.addEventListener("click", function (event) {

        if (
            !profileWindow.contains(event.target) &&
            !profileButton.contains(event.target)
        ) {
            profileWindow.classList.remove("visible");
        }
    });


    // --------------------------------
    // ПЕРЕКЛЮЧЕНИЕ ОСНОВНЫХ ВКЛАДОК
    // --------------------------------

    mainTabs.forEach(function (tab) {

        tab.addEventListener("click", function () {

            const selectedTab = tab.dataset.mainTab;

            mainTabs.forEach(item => {
                item.classList.remove("active");
            });

            mainPanels.forEach(panel => {
                panel.classList.remove("active");
            });

            tab.classList.add("active");

            const selectedPanel = document.querySelector(
                `.master-profile-main-panel[data-main-panel="${selectedTab}"]`
            );

            if (selectedPanel) {
                selectedPanel.classList.add("active");
            }

            if (selectedTab === "players" && !playersLoaded) {
                loadPlayers();
            }

            if (selectedTab === "tasks" && !tasksLoaded) {

                const activeSubTab = document.querySelector(
                    ".master-profile-subtab.active"
                );

                if (
                    activeSubTab &&
                    activeSubTab.dataset.subtab === "list"
                ) {
                    loadTasks();
                }
            }

            if (selectedTab === "list" && !tasksLoaded) {
                loadTasks();
            }

        });

    });


    // --------------------------------
    // ПЕРЕКЛЮЧЕНИЕ ПОДВКЛАДОК ЗАДАНИЙ
    // --------------------------------

    subTabs.forEach(function (tab) {

        tab.addEventListener("click", function () {

            const selectedTab = tab.dataset.subtab;

            subTabs.forEach(item => {
                item.classList.remove("active");
            });

            subPanels.forEach(panel => {
                panel.classList.remove("active");
            });

            tab.classList.add("active");

            const selectedPanel = document.querySelector(
                `.master-profile-subpanel[data-subpanel="${selectedTab}"]`
            );

            if (selectedPanel) {
                selectedPanel.classList.add("active");
            }

            if (selectedTab === "list" && !tasksLoaded) {
                loadTasks();
            }

        });

    });

});
