
document.addEventListener("DOMContentLoaded", function () {

    // ============================================================
    // ПАРАМЕТРЫ КАРТЫ
    // ============================================================

    const map = document.getElementById("game-map");
    const mapFrame = document.getElementById("map-frame");

    if (!map || !mapFrame) {
        console.error("Не найдены элементы игровой карты.");
        return;
    }

    const columns = 30;
    const rows = 20;

    const radius = 20;
    const hexWidth = Math.sqrt(3) * radius;
    const hexHeight = radius * 2;

    const svgNS = "http://www.w3.org/2000/svg";

    const playerColors = [
        "#F44336", "#E91E63", "#9C27B0", "#673AB7",
        "#3F51B5", "#2196F3", "#03A9F4", "#00BCD4",
        "#009688", "#4CAF50", "#8BC34A", "#CDDC39",
        "#FFEB3B", "#FFC107", "#FF9800", "#FF5722",
        "#795548", "#9E9E9E", "#607D8B", "#263238",
        "#B71C1C", "#880E4F", "#4A148C", "#311B92",
        "#1A237E", "#0D47A1", "#01579B", "#006064",
        "#004D40", "#1B5E20", "#33691E", "#827717",
        "#F9A825", "#E65100", "#BF360C", "#455A64"
    ];

    // ============================================================
    // ГЕОМЕТРИЯ ШЕСТИУГОЛЬНИКОВ
    // ============================================================

    const hexOffsets = [];

    for (let i = 0; i < 6; i++) {
        const angle = (-90 + i * 60) * Math.PI / 180;

        hexOffsets.push({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        });
    }

    // ============================================================
    // РАЗМЕРЫ КАРТЫ И ОТСТУПЫ
    // ============================================================

    const contentWidth = columns * hexWidth + hexWidth / 2;
    const contentHeight = (rows - 1) * radius * 1.5 + hexHeight;

    // Отступы по шесть размеров шестиугольника с каждой стороны.
    const paddingX = hexWidth * 6;
    const paddingY = hexHeight * 6;

    const mapWidth = contentWidth + paddingX * 2;
    const mapHeight = contentHeight + paddingY * 2;

    // ============================================================
    // РАЗМЕР НЕПОДВИЖНОЙ РАМКИ
    // ============================================================

    function updateFrameSize() {

        const availableWidth = Math.max(100, window.innerWidth - 32);
        const availableHeight = Math.max(100, window.innerHeight - 32);

        const scale = Math.min(
            availableWidth / mapWidth,
            availableHeight / mapHeight
        );

        mapFrame.style.width = `${mapWidth * scale}px`;
        mapFrame.style.height = `${mapHeight * scale}px`;
    }

    updateFrameSize();
    window.addEventListener("resize", updateFrameSize);

    // ============================================================
    // СОЗДАНИЕ SVG
    // ============================================================

    const svg = document.createElementNS(svgNS, "svg");

    svg.setAttribute("viewBox", `0 0 ${mapWidth} ${mapHeight}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "hex-map");

    const defs = document.createElementNS(svgNS, "defs");

    const arrowMarker = document.createElementNS(svgNS, "marker");

    arrowMarker.setAttribute("id", "player-direction-arrowhead");
    arrowMarker.setAttribute("markerWidth", "8");
    arrowMarker.setAttribute("markerHeight", "8");
    arrowMarker.setAttribute("refX", "5");
    arrowMarker.setAttribute("refY", "3");
    arrowMarker.setAttribute("orient", "auto");
    arrowMarker.setAttribute("markerUnits", "userSpaceOnUse");

    const arrowHead = document.createElementNS(svgNS, "path");

    arrowHead.setAttribute("d", "M0,0 L6,3 L0,6 Z");
    arrowHead.setAttribute("fill", "#333333");

    arrowMarker.appendChild(arrowHead);
    defs.appendChild(arrowMarker);
    svg.appendChild(defs);

    const mapLayer = document.createElementNS(svgNS, "g");
    const directionLayer = document.createElementNS(svgNS, "g");
    const playerLayer = document.createElementNS(svgNS, "g");

    svg.appendChild(mapLayer);
    svg.appendChild(directionLayer);
    svg.appendChild(playerLayer);

    const fragment = document.createDocumentFragment();

    const hexagons = new Map();
    const cellCenters = new Map();

    // ============================================================
    // ПОСТРОЕНИЕ 600 КЛЕТОК
    // ============================================================

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

            const hexagon = document.createElementNS(svgNS, "polygon");

            hexagon.setAttribute("points", points.join(" "));
            hexagon.setAttribute("class", "hex-cell");
            hexagon.setAttribute("data-column", col + 1);
            hexagon.setAttribute("data-row", row + 1);

            const cellId = row * columns + col + 1;

            hexagon.setAttribute("data-cell-id", cellId);

            hexagons.set(String(cellId), hexagon);

            cellCenters.set(String(cellId), {
                x: centerX,
                y: centerY
            });

            fragment.appendChild(hexagon);
        }
    }

    mapLayer.appendChild(fragment);

    // ============================================================
    // РАМКА ВСЕЙ SVG-ОБЛАСТИ
    // ============================================================

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

    mapFrame.replaceChildren(svg);

    console.log("Карта игрока создана: 600 ячеек");

    // ============================================================
    // МАСШТАБ И ПОЛОЖЕНИЕ КАРТЫ
    // ============================================================

    const view = {
        x: 0,
        y: 0,
        width: mapWidth,
        height: mapHeight
    };

    const maxWidth = mapWidth;
    const minWidth = mapWidth / 12;

    function limitView() {

        view.x = Math.max(0, Math.min(view.x, mapWidth - view.width));
        view.y = Math.max(0, Math.min(view.y, mapHeight - view.height));
    }

    function updateViewBox() {

        limitView();

        svg.setAttribute(
            "viewBox",
            `${view.x} ${view.y} ${view.width} ${view.height}`
        );
    }

    // ============================================================
    // ПЕРЕВОД КООРДИНАТ МЫШИ В SVG
    // ============================================================

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

    // ============================================================
    // МАСШТАБИРОВАНИЕ КОЛЕСОМ МЫШИ
    // ============================================================

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

    // ============================================================
    // ПЕРЕМЕЩЕНИЕ КАРТЫ
    // ============================================================

    let dragging = false;
    let hasDragged = false;

    let startX = 0;
    let startY = 0;

    let startViewX = 0;
    let startViewY = 0;

    let dragScale = 1;

    svg.addEventListener("pointerdown", function (event) {

        if (event.button !== 0) return;

        dragging = true;
        hasDragged = false;

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

        if (distance > 5) hasDragged = true;
        if (!hasDragged) return;

        const deltaX = (event.clientX - startX) / dragScale;
        const deltaY = (event.clientY - startY) / dragScale;

        view.x = startViewX - deltaX;
        view.y = startViewY - deltaY;

        updateViewBox();
    });

    function stopDragging() {

        dragging = false;
        svg.classList.remove("dragging");
    }

    svg.addEventListener("pointerup", function (event) {

        const wasDragging = hasDragged;

        stopDragging();

        if (!wasDragging) {
            selectCellAtPointer(event);
        }

        hasDragged = false;
    });

    svg.addEventListener("pointercancel", function () {

        stopDragging();
        hasDragged = false;
    });

    svg.addEventListener("lostpointercapture", function () {

        stopDragging();
        hasDragged = false;
    });

    // ============================================================
    // СОСТОЯНИЕ ИГРОКА
    // ============================================================

    let playerPath = [];
    let currentCellId = null;
    let visitedCells = new Set();

    let pathLoaded = false;
    let pathLoading = false;

    let pendingCellId = null;

    let taskSubmitted = false;
    let currentTaskCellId = null;
    let currentTask = null;

    let playerTasks = [];

    let currentPlayerColor = "";

    let tasksLoaded = false;
    let tasksLoading = false;

    // ============================================================
    // API
    // ============================================================

    async function apiRequest(url, options = {}) {

        let response;

        try {

            response = await fetch(url, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    ...(options.headers || {})
                }
            });

        } catch (error) {

            console.error("Ошибка соединения:", error);

            throw new Error("Не удалось соединиться с сервером.");
        }

        let data;

        try {
            data = await response.json();
        } catch (error) {
            throw new Error("Сервер вернул некорректный ответ.");
        }

        if (response.status === 401) {
            window.location.href = "/login";
            throw new Error("Требуется авторизация.");
        }

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Не удалось выполнить запрос.");
        }

        return data;
    }

    // ============================================================
    // СОСЕДСТВО КЛЕТОК
    // ============================================================

    function areCellsNeighborsClient(currentId, targetId) {

        const currentHexagon = hexagons.get(String(currentId));
        const targetHexagon = hexagons.get(String(targetId));

        if (!currentHexagon || !targetHexagon) return false;

        const currentColumn = Number(currentHexagon.dataset.column);
        const currentRow = Number(currentHexagon.dataset.row);

        const targetColumn = Number(targetHexagon.dataset.column);
        const targetRow = Number(targetHexagon.dataset.row);

        const rowDifference = targetRow - currentRow;
        const columnDifference = targetColumn - currentColumn;

        if (rowDifference === 0) {
            return Math.abs(columnDifference) === 1;
        }

        if (Math.abs(rowDifference) !== 1) {
            return false;
        }

        if (currentRow % 2 === 1) {
            return columnDifference === 0 || columnDifference === -1;
        }

        return columnDifference === 0 || columnDifference === 1;
    }

    // ============================================================
    // ОТРИСОВКА МАРШРУТА
    // ============================================================

    function renderPlayerPath() {

        hexagons.forEach(function (hexagon, cellId) {

            hexagon.classList.remove(
                "visited-cell",
                "current-cell",
                "inactive-cell",
                "available-cell"
            );

            if (currentCellId === null) {
                hexagon.style.fill = "#ffffff";
                return;
            }

            hexagon.style.fill = "#bdbdbd";
            hexagon.classList.add("inactive-cell");

            if (visitedCells.has(cellId)) {

                hexagon.style.fill = currentPlayerColor || "#ffffff";
                hexagon.classList.add("visited-cell");
            }

            if (cellId === String(currentCellId)) {

                hexagon.style.fill = "#ffffff";

                hexagon.classList.remove("inactive-cell");
                hexagon.classList.add("current-cell");

                return;
            }

            if (
                taskSubmitted &&
                areCellsNeighborsClient(currentCellId, cellId) &&
                !visitedCells.has(cellId)
            ) {

                hexagon.style.fill = "#ffffff";

                hexagon.classList.remove("inactive-cell");
                hexagon.classList.add("available-cell");
            }
        });

        renderAvailableDirections();
        renderPlayerMarker();
    }

    // ============================================================
    // МАРКЕР ИГРОКА
    // ============================================================

    function renderPlayerMarker() {

        playerLayer.replaceChildren();

        if (currentCellId === null) return;

        const center = cellCenters.get(String(currentCellId));

        if (!center) return;

        const marker = document.createElementNS(svgNS, "circle");

        marker.setAttribute("cx", center.x);
        marker.setAttribute("cy", center.y);
        marker.setAttribute("r", "7");
        marker.setAttribute("fill", currentPlayerColor || "#333333");
        marker.setAttribute("stroke", "#ffffff");
        marker.setAttribute("stroke-width", "2");
        marker.setAttribute("class", "player-map-marker");

        playerLayer.appendChild(marker);
    }

    // ============================================================
    // СТРЕЛКИ ДОСТУПНЫХ ПЕРЕХОДОВ
    // ============================================================

    function renderAvailableDirections() {

        directionLayer.replaceChildren();

        const arrowColor = currentPlayerColor || "#333333";

        arrowHead.setAttribute("fill", arrowColor);

        if (!taskSubmitted || currentCellId === null) return;

        const currentCenter = cellCenters.get(String(currentCellId));

        if (!currentCenter) return;

        hexagons.forEach(function (hexagon, cellId) {

            if (visitedCells.has(cellId)) return;
            if (!areCellsNeighborsClient(currentCellId, cellId)) return;

            const targetCenter = cellCenters.get(cellId);

            if (!targetCenter) return;

            const dx = targetCenter.x - currentCenter.x;
            const dy = targetCenter.y - currentCenter.y;

            const distance = Math.hypot(dx, dy);

            if (!distance) return;

            const unitX = dx / distance;
            const unitY = dy / distance;

            const startOffset = 9;
            const endOffset = 12;

            const arrow = document.createElementNS(svgNS, "line");

            arrow.setAttribute(
                "x1",
                currentCenter.x + unitX * startOffset
            );

            arrow.setAttribute(
                "y1",
                currentCenter.y + unitY * startOffset
            );

            arrow.setAttribute(
                "x2",
                targetCenter.x - unitX * endOffset
            );

            arrow.setAttribute(
                "y2",
                targetCenter.y - unitY * endOffset
            );

            arrow.setAttribute("stroke", arrowColor);
            arrow.setAttribute("stroke-width", "2.5");
            arrow.setAttribute("stroke-linecap", "round");
            arrow.setAttribute(
                "marker-end",
                "url(#player-direction-arrowhead)"
            );
            arrow.setAttribute("vector-effect", "non-scaling-stroke");

            directionLayer.appendChild(arrow);
        });
    }

    // ============================================================
    // ЗАГРУЗКА МАРШРУТА
    // ============================================================

    async function loadPlayerPath() {

        if (pathLoading) return;

        pathLoading = true;

        try {

            const data = await apiRequest("/api/player/path");

            playerPath = data.path || [];

            currentCellId =
                data.current_cell_id !== null &&
                    data.current_cell_id !== undefined
                    ? String(data.current_cell_id)
                    : null;

            visitedCells = new Set(
                (data.visited_cells || []).map(String)
            );

            pathLoaded = true;

            renderPlayerPath();

            console.log(
                "Маршрут игрока загружен:",
                playerPath.length,
                "переходов"
            );

        } finally {

            pathLoading = false;
        }
    }

    // ============================================================
    // ПРОФИЛЬ И ВКЛАДКИ
    // ============================================================

    const profileButton = document.getElementById(
        "player-profile-button"
    );

    const profileWindow = document.getElementById(
        "player-profile-window"
    );

    const mainTabs = document.querySelectorAll(
        ".player-profile-main-tab"
    );

    const mainPanels = document.querySelectorAll(
        ".player-profile-main-panel"
    );

    const mastersPanel = document.querySelector(
        '.player-profile-main-panel[data-main-panel="masters"]'
    );

    const tasksPanel = document.querySelector(
        '.player-profile-main-panel[data-main-panel="tasks"]'
    );

    let mastersLoaded = false;
    let mastersLoading = false;

    // ============================================================
    // ЗАГРУЗКА ЗАДАНИЙ
    // ============================================================

    async function loadTasks(force = false) {

        if (tasksLoading) return;
        if (tasksLoaded && !force) return;

        tasksLoading = true;

        try {

            const data = await apiRequest("/api/player/tasks");

            playerTasks = data.tasks || [];
            tasksLoaded = true;

            updateCurrentTask();
            renderTasks(playerTasks);

        } finally {

            tasksLoading = false;
        }
    }

    // ============================================================
    // ОБНОВЛЕНИЕ ТЕКУЩЕГО ЗАДАНИЯ
    // ============================================================

    function updateCurrentTask() {

        currentTask = null;
        currentTaskCellId = null;
        taskSubmitted = false;

        if (currentCellId === null) {
            renderPlayerPath();
            return;
        }

        currentTask = playerTasks.find(function (task) {
            return String(task.cell_id) === String(currentCellId);
        }) || null;

        currentTaskCellId = String(currentCellId);

        if (currentTask) {
            taskSubmitted = Boolean(currentTask.submitted);
        }

        renderPlayerPath();
    }

    // ============================================================
    // ОТРИСОВКА ЛИЧНЫХ ЗАДАНИЙ
    // ============================================================

    function renderTasks(tasks) {

        if (!tasksPanel) return;

        tasksPanel.replaceChildren();

        const list = document.createElement("div");
        list.className = "player-task-list";

        if (!tasks.length) {

            const emptyMessage = document.createElement("div");

            emptyMessage.className = "task-list-message";
            emptyMessage.textContent = "Пока что нет заданий.";

            list.appendChild(emptyMessage);
            tasksPanel.appendChild(list);

            return;
        }

        tasks.forEach(function (task) {

            const item = document.createElement("div");
            item.className = "player-task-item";

            const isCurrentTask =
                currentCellId !== null &&
                String(task.cell_id) === String(currentCellId);

            const title = document.createElement("div");
            title.className = "player-task-title";
            title.textContent = `Клетка № ${task.cell_id}`;

            item.appendChild(title);

            const taskText = document.createElement("div");
            taskText.className = "player-task-text";
            taskText.textContent =
                task.task_text || "Текст задания отсутствует.";

            item.appendChild(taskText);

            if (task.task_url) {

                const link = document.createElement("a");

                link.className = "player-task-link";
                link.href = task.task_url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = "Открыть отправленную ссылку";

                item.appendChild(link);
            }

            const dates = document.createElement("div");
            dates.className = "player-task-dates";

            if (task.accepted_date) {

                const acceptedDate = document.createElement("div");
                acceptedDate.textContent =
                    `Дата принятия: ${task.accepted_date}`;

                dates.appendChild(acceptedDate);
            }

            if (task.submitted_date) {

                const submittedDate = document.createElement("div");
                submittedDate.textContent =
                    `Дата сдачи: ${task.submitted_date}`;

                dates.appendChild(submittedDate);
            }

            if (dates.childElementCount > 0) {
                item.appendChild(dates);
            }

            const status = document.createElement("div");

            status.className = "player-task-status";
            status.textContent = task.status || "В работе";

            if (task.accepted && task.submitted) {
                status.classList.add("completed");
            } else if (task.submitted) {
                status.classList.add("pending");
            } else {
                status.classList.add("in-progress");
            }

            item.appendChild(status);

            // ФОРМА ОТПРАВКИ ТЕКУЩЕГО ЗАДАНИЯ
            // Находится внутри карточки задания во вкладке профиля.

            if (isCurrentTask) {

                const form = document.createElement("div");
                form.className = "player-task-submit-form";

                const label = document.createElement("div");
                label.className = "player-task-submit-label";
                label.textContent = "Ссылка на выполненное задание";

                const input = document.createElement("input");
                input.type = "url";
                input.className = "player-task-url";
                input.placeholder = "Вставьте ссылку";
                input.value = task.task_url || "";
                input.disabled = Boolean(task.submitted);

                const submitButton = document.createElement("button");
                submitButton.type = "button";
                submitButton.className = "player-task-submit-button";
                submitButton.textContent = task.submitted
                    ? "Отправлено"
                    : "Отправить";

                submitButton.disabled = Boolean(task.submitted);

                const error = document.createElement("div");
                error.className = "player-task-submit-error";

                if (task.submitted) {

                    const submittedMessage = document.createElement("div");
                    submittedMessage.className =
                        "player-task-submitted-message";

                    submittedMessage.textContent = task.accepted
                        ? "Задание принято."
                        : "Задание отправлено и ожидает проверки.";

                    form.appendChild(submittedMessage);

                } else {

                    form.appendChild(label);
                    form.appendChild(input);
                    form.appendChild(submitButton);
                    form.appendChild(error);

                    submitButton.addEventListener(
                        "click",
                        function () {
                            submitCurrentTask(
                                String(task.cell_id),
                                input,
                                submitButton,
                                error
                            );
                        }
                    );
                }

                item.appendChild(form);
            }

            list.appendChild(item);
        });

        tasksPanel.appendChild(list);
    }

    // ============================================================
    // ОТПРАВКА ТЕКУЩЕГО ЗАДАНИЯ
    // ============================================================

    async function submitCurrentTask(
        cellId,
        input,
        submitButton,
        errorElement
    ) {

        if (String(cellId) !== String(currentCellId)) {
            errorElement.textContent =
                "Это задание больше не является текущим.";
            return;
        }

        const taskUrl = input.value.trim();

        if (!taskUrl) {
            errorElement.textContent = "Укажите ссылку на задание.";
            return;
        }

        try {
            new URL(taskUrl);
        } catch {
            errorElement.textContent = "Введите корректную ссылку.";
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Отправка...";
        errorElement.textContent = "";

        try {

            await apiRequest("/api/player/submit-task", {

                method: "POST",

                body: JSON.stringify({
                    cell_id: cellId,
                    task_url: taskUrl
                })
            });

            tasksLoaded = false;

            await loadTasks(true);

            renderPlayerPath();

        } catch (error) {

            console.error("Ошибка отправки задания:", error);

            errorElement.textContent = error.message;

            submitButton.disabled = false;
            submitButton.textContent = "Отправить";
        }
    }

    // ============================================================
    // ОКНО ПОДТВЕРЖДЕНИЯ ПЕРЕХОДА
    // ============================================================

    const moveOverlay = document.createElement("div");

    moveOverlay.id = "player-move-overlay";

    Object.assign(moveOverlay.style, {
        display: "none",
        position: "fixed",
        inset: "0",
        zIndex: "10001",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(0, 0, 0, 0.35)"
    });

    const moveWindow = document.createElement("div");

    Object.assign(moveWindow.style, {
        width: "100%",
        maxWidth: "360px",
        padding: "22px",
        background: "#ffffff",
        border: "1px solid #dedede",
        borderRadius: "8px",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.16)"
    });

    const moveTitle = document.createElement("div");

    Object.assign(moveTitle.style, {
        marginBottom: "10px",
        fontSize: "17px",
        fontWeight: "600",
        color: "#333333"
    });

    const moveDescription = document.createElement("div");

    Object.assign(moveDescription.style, {
        marginBottom: "16px",
        fontSize: "14px",
        lineHeight: "1.5",
        color: "#666666"
    });

    const moveError = document.createElement("div");

    Object.assign(moveError.style, {
        minHeight: "18px",
        marginBottom: "10px",
        fontSize: "12px",
        color: "#d32f2f"
    });

    const moveActions = document.createElement("div");

    Object.assign(moveActions.style, {
        display: "flex",
        gap: "10px"
    });

    const moveCancelButton = document.createElement("button");

    moveCancelButton.type = "button";
    moveCancelButton.textContent = "Передумать";

    const moveConfirmButton = document.createElement("button");

    moveConfirmButton.type = "button";
    moveConfirmButton.textContent = "Перейти";

    [moveCancelButton, moveConfirmButton].forEach(function (button) {

        Object.assign(button.style, {
            flex: "1",
            height: "38px",
            border: "1px solid #cccccc",
            borderRadius: "5px",
            background: "#ffffff",
            color: "#444444",
            fontFamily: "inherit",
            fontSize: "13px",
            cursor: "pointer"
        });
    });

    Object.assign(moveConfirmButton.style, {
        background: "#333333",
        borderColor: "#333333",
        color: "#ffffff"
    });

    moveActions.appendChild(moveCancelButton);
    moveActions.appendChild(moveConfirmButton);

    moveWindow.appendChild(moveTitle);
    moveWindow.appendChild(moveDescription);
    moveWindow.appendChild(moveError);
    moveWindow.appendChild(moveActions);

    moveOverlay.appendChild(moveWindow);
    document.body.appendChild(moveOverlay);

    function openMoveDialog(cellId, errorMessage = "") {

        pendingCellId = errorMessage ? null : String(cellId);

        moveError.textContent = errorMessage;

        if (errorMessage) {

            moveTitle.textContent = "Переход невозможен";
            moveDescription.textContent = "Выберите другую клетку.";

            moveConfirmButton.style.display = "none";
            moveCancelButton.textContent = "Закрыть";

        } else {

            moveTitle.textContent = "Перейти на клетку?";

            moveDescription.textContent =
                `Вы действительно хотите перейти на клетку № ${cellId}?`;

            moveConfirmButton.style.display = "block";
            moveCancelButton.textContent = "Передумать";
        }

        moveOverlay.style.display = "flex";
    }

    function closeMoveDialog() {

        moveOverlay.style.display = "none";
        pendingCellId = null;

        moveConfirmButton.disabled = false;
        moveConfirmButton.textContent = "Перейти";
    }

    moveCancelButton.addEventListener("click", closeMoveDialog);

    moveOverlay.addEventListener("click", function (event) {

        if (event.target === moveOverlay) {
            closeMoveDialog();
        }
    });

    // ============================================================
    // ВЫБОР КЛЕТКИ НА КАРТЕ
    // ============================================================

    function selectCellAtPointer(event) {

        const target = document.elementFromPoint(
            event.clientX,
            event.clientY
        );

        if (
            !target ||
            !target.classList ||
            !target.classList.contains("hex-cell")
        ) {
            return;
        }

        if (!pathLoaded) return;

        const targetCellId = String(
            target.getAttribute("data-cell-id")
        );

        if (
            currentCellId !== null &&
            targetCellId === String(currentCellId)
        ) {
            if (!profileWindow.classList.contains("visible")) {
                profileWindow.classList.add("visible");
            }

            switchProfileTab("tasks");
            loadTasks();

            return;
        }

        if (visitedCells.has(targetCellId)) {

            openMoveDialog(
                targetCellId,
                "Вы уже посещали эту клетку."
            );

            return;
        }

        if (currentCellId === null) {

            openMoveDialog(targetCellId);
            return;
        }

        if (!taskSubmitted) {

            openMoveDialog(
                targetCellId,
                "Сначала отправьте задание текущей клетки."
            );

            return;
        }

        if (!areCellsNeighborsClient(currentCellId, targetCellId)) {

            openMoveDialog(
                targetCellId,
                "Можно перейти только на соседнюю клетку."
            );

            return;
        }

        openMoveDialog(targetCellId);
    }

    // ============================================================
    // ПОДТВЕРЖДЕНИЕ ПЕРЕХОДА
    // ============================================================

    moveConfirmButton.addEventListener("click", async function () {

        if (!pendingCellId) return;

        moveConfirmButton.disabled = true;
        moveConfirmButton.textContent = "Сохранение...";
        moveError.textContent = "";

        try {

            const isFirstCell = currentCellId === null;

            const endpoint = isFirstCell
                ? "/api/player/select-cell"
                : "/api/player/move";

            await apiRequest(endpoint, {

                method: "POST",

                body: JSON.stringify({
                    cell_id: pendingCellId
                })
            });

            closeMoveDialog();

            tasksLoaded = false;

            await loadPlayerPath();
            await loadTasks(true);

            switchProfileTab("tasks");

        } catch (error) {

            console.error("Ошибка перехода:", error);

            moveError.textContent = error.message;

            moveConfirmButton.disabled = false;
            moveConfirmButton.textContent = "Перейти";
        }
    });

    // ============================================================
    // ЗАГРУЗКА МАСТЕРОВ
    // ============================================================

    async function loadMasters() {

        if (!mastersPanel || mastersLoading || mastersLoaded) return;

        mastersLoading = true;
        mastersPanel.replaceChildren();

        const loadingMessage = document.createElement("div");

        loadingMessage.className = "player-list-message";
        loadingMessage.textContent = "Загрузка списка мастеров...";

        mastersPanel.appendChild(loadingMessage);

        try {

            const data = await apiRequest("/api/player/masters");

            renderMasters(data.masters || []);

            mastersLoaded = true;

        } catch (error) {

            console.error("Ошибка загрузки мастеров:", error);

            mastersPanel.replaceChildren();

            const errorMessage = document.createElement("div");

            errorMessage.className = "player-list-message";
            errorMessage.textContent = error.message;

            mastersPanel.appendChild(errorMessage);

        } finally {

            mastersLoading = false;
        }
    }

    // ============================================================
    // ОТРИСОВКА МАСТЕРОВ
    // ============================================================

    function renderMasters(masters) {

        mastersPanel.replaceChildren();

        const list = document.createElement("div");
        list.className = "player-master-list";

        if (!masters.length) {

            const emptyMessage = document.createElement("div");

            emptyMessage.className = "player-list-message";
            emptyMessage.textContent = "Мастеров пока нет.";

            list.appendChild(emptyMessage);
            mastersPanel.appendChild(list);

            return;
        }

        masters.forEach(function (master) {

            const item = document.createElement("div");
            item.className = "player-list-item";

            const identity = document.createElement("div");
            identity.className = "player-list-identity";

            const avatar = document.createElement("span");
            avatar.className = "player-master-avatar";
            avatar.textContent = "М";

            if (master.color) {
                avatar.style.backgroundColor = master.color;
            }

            const name = document.createElement("span");
            name.className = "player-list-name";
            name.textContent = master.name || "Мастер";

            identity.appendChild(avatar);
            identity.appendChild(name);

            item.appendChild(identity);
            list.appendChild(item);
        });

        mastersPanel.appendChild(list);
    }

    // ============================================================
    // ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ПРОФИЛЯ
    // ============================================================

    function switchProfileTab(selectedTab) {

        mainTabs.forEach(function (tab) {

            tab.classList.toggle(
                "active",
                tab.dataset.mainTab === selectedTab
            );
        });

        mainPanels.forEach(function (panel) {

            panel.classList.toggle(
                "active",
                panel.dataset.mainPanel === selectedTab
            );
        });

        if (selectedTab === "masters") {
            loadMasters();
        }

        if (selectedTab === "tasks") {
            loadTasks();
        }
    }

    mainTabs.forEach(function (tab) {

        tab.addEventListener("click", function () {
            switchProfileTab(tab.dataset.mainTab);
        });
    });

    // ============================================================
    // ОТКРЫТИЕ И ЗАКРЫТИЕ ПРОФИЛЯ
    // ============================================================

    if (profileButton && profileWindow) {

        profileButton.addEventListener("click", function (event) {

            event.stopPropagation();

            profileWindow.classList.toggle("visible");

            if (!profileWindow.classList.contains("visible")) {
                return;
            }

            const activeTab = document.querySelector(
                ".player-profile-main-tab.active"
            );

            if (!activeTab || activeTab.dataset.mainTab === "masters") {
                loadMasters();
            } else {
                loadTasks();
            }
        });

        document.addEventListener("click", function (event) {

            if (
                !profileWindow.contains(event.target) &&
                !profileButton.contains(event.target) &&
                !colorOverlay.contains(event.target)
            ) {
                profileWindow.classList.remove("visible");
            }
        });
    }

    // ============================================================
    // ВЫБОР ЦВЕТА
    // ============================================================

    const colorOverlay = document.getElementById(
        "player-color-overlay"
    );

    const colorPalette = document.getElementById(
        "player-color-palette"
    );

    const colorSaveButton = document.getElementById(
        "player-color-save"
    );

    const colorCancelButton = document.getElementById(
        "player-color-cancel"
    );

    const colorError = document.getElementById(
        "player-color-error"
    );

    const profileAvatar = document.querySelector(
        ".player-profile-avatar"
    );

    let selectedPlayerColor = "";
    let requiredColorSelection = false;

    function applyPlayerColor(color) {

        currentPlayerColor = color;

        if (profileAvatar) {
            profileAvatar.style.backgroundColor = color;
            profileAvatar.style.borderColor = color;
        }

        renderPlayerPath();
    }

    function renderColorPalette() {

        if (!colorPalette) return;

        colorPalette.replaceChildren();

        playerColors.forEach(function (color) {

            const button = document.createElement("button");

            button.type = "button";
            button.className = "player-color-option";
            button.style.backgroundColor = color;
            button.title = color;
            button.dataset.color = color;

            if (color === selectedPlayerColor) {
                button.classList.add("selected");
            }

            button.addEventListener("click", function () {

                selectedPlayerColor = color;

                colorPalette
                    .querySelectorAll(".player-color-option")
                    .forEach(function (item) {
                        item.classList.remove("selected");
                    });

                button.classList.add("selected");

                colorSaveButton.disabled = false;
                colorError.textContent = "";
            });

            colorPalette.appendChild(button);
        });
    }

    function openColorPicker(required) {

        if (!colorOverlay) return;

        requiredColorSelection = required;

        selectedPlayerColor = currentPlayerColor;

        colorError.textContent = "";

        renderColorPalette();

        colorCancelButton.style.display =
            required ? "none" : "block";

        colorSaveButton.disabled =
            !playerColors.includes(selectedPlayerColor);

        colorOverlay.classList.add("visible");
    }

    function closeColorPicker() {

        if (requiredColorSelection) return;

        colorOverlay.classList.remove("visible");
    }

    async function initializePlayerColor() {

        try {

            const data = await apiRequest("/api/player/color");

            const color = String(data.color || "").toUpperCase();

            if (playerColors.includes(color)) {

                applyPlayerColor(color);

            } else {

                currentPlayerColor = "";
                openColorPicker(true);
            }

        } catch (error) {

            console.error("Ошибка получения цвета игрока:", error);

            openColorPicker(true);

            if (colorError) {
                colorError.textContent =
                    "Не удалось загрузить цвет. Проверьте соединение и обновите страницу.";
            }
        }
    }

    if (colorSaveButton) {

        colorSaveButton.addEventListener("click", async function () {

            if (!playerColors.includes(selectedPlayerColor)) return;

            colorSaveButton.disabled = true;
            colorError.textContent = "";

            try {

                const data = await apiRequest(
                    "/api/player/color",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            color: selectedPlayerColor
                        })
                    }
                );

                applyPlayerColor(data.color);

                requiredColorSelection = false;

                colorOverlay.classList.remove("visible");

            } catch (error) {

                console.error("Ошибка сохранения цвета:", error);

                colorError.textContent = error.message;

            } finally {

                colorSaveButton.disabled = false;
            }
        });
    }

    if (colorCancelButton) {

        colorCancelButton.addEventListener("click", function () {
            closeColorPicker();
        });
    }

    if (profileAvatar) {

        profileAvatar.addEventListener("click", function (event) {

            event.stopPropagation();

            openColorPicker(false);
        });
    }

    if (colorOverlay) {

        colorOverlay.addEventListener("click", function (event) {

            if (event.target === colorOverlay) {
                closeColorPicker();
            }
        });
    }

    // ============================================================
    // ВЫХОД
    // ============================================================

    const logoutButton = document.getElementById(
        "player-logout-button"
    );

    if (logoutButton) {

        logoutButton.addEventListener("click", function () {
            window.location.href = "/logout";
        });
    }

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================

    async function initializePlayer() {

        try {

            await initializePlayerColor();

            await loadPlayerPath();

            await loadTasks(true);

            renderPlayerPath();

        } catch (error) {

            console.error("Ошибка инициализации игрока:", error);
        }
    }

    initializePlayer();

});
