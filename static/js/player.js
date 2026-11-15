
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
    const hexagons = new Map();

    // --------------------------------
    // ПОСТРОЕНИЕ 600 КЛЕТОК
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

            const cellId = (row * columns) + col + 1;

            hexagon.setAttribute(
                "data-cell-id",
                cellId
            );

            hexagons.set(String(cellId), hexagon);

            fragment.appendChild(hexagon);
        }
    }

    svg.appendChild(fragment);

    // --------------------------------
    // РАМКА ИГРОВОЙ ОБЛАСТИ
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

    console.log("Карта игрока создана: 600 ячеек");

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

        dragging = false;
        hasDragged = false;

        svg.classList.remove("dragging");
    }

    svg.addEventListener("pointerup", function (event) {

        const wasDragging = hasDragged;

        stopDragging();

        if (!wasDragging) {
            selectCellAtPointer(event);
        }
    });

    svg.addEventListener("pointercancel", stopDragging);
    svg.addEventListener("lostpointercapture", stopDragging);



    // --------------------------------
    // МАРШРУТ И ЗАДАНИЕ ИГРОКА
    // --------------------------------

    let playerPath = [];
    let currentCellId = null;
    let visitedCells = new Set();
    let pathLoaded = false;
    let pathLoading = false;
    let pendingCellId = null;

    let taskSubmitted = false;
    let currentTaskCellId = null;



    // --------------------------------
    // СОЗДАНИЕ ОКНА ПОДТВЕРЖДЕНИЯ
    // --------------------------------

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


    // --------------------------------
    // ПАНЕЛЬ ТЕКУЩЕГО ЗАДАНИЯ
    // --------------------------------

    const taskPanel = document.createElement("div");

    Object.assign(taskPanel.style, {
        display: "none",
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: "10000",
        width: "min(360px, calc(100vw - 40px))",
        padding: "18px",
        background: "#ffffff",
        border: "1px solid #dedede",
        borderRadius: "8px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        boxSizing: "border-box"
    });

    const taskTitle = document.createElement("div");
    taskTitle.textContent = "Задание клетки";

    Object.assign(taskTitle.style, {
        fontSize: "17px",
        fontWeight: "600",
        marginBottom: "12px"
    });

    const taskText = document.createElement("div");

    Object.assign(taskText.style, {
        fontSize: "14px",
        lineHeight: "1.5",
        whiteSpace: "pre-wrap",
        marginBottom: "14px",
        color: "#444444"
    });

    const taskUrlInput = document.createElement("input");

    taskUrlInput.type = "url";
    taskUrlInput.placeholder = "Вставьте ссылку на задание";

    Object.assign(taskUrlInput.style, {
        width: "100%",
        height: "38px",
        padding: "0 10px",
        boxSizing: "border-box",
        border: "1px solid #cccccc",
        borderRadius: "5px",
        marginBottom: "10px",
        fontFamily: "inherit"
    });

    const taskSubmitButton = document.createElement("button");

    taskSubmitButton.type = "button";
    taskSubmitButton.textContent = "Отправить";

    Object.assign(taskSubmitButton.style, {
        width: "100%",
        height: "38px",
        border: "none",
        borderRadius: "5px",
        background: "#333333",
        color: "#ffffff",
        cursor: "pointer",
        fontFamily: "inherit"
    });

    const taskStatus = document.createElement("div");

    Object.assign(taskStatus.style, {
        marginTop: "10px",
        fontSize: "12px",
        color: "#666666"
    });

    taskPanel.appendChild(taskTitle);
    taskPanel.appendChild(taskText);
    taskPanel.appendChild(taskUrlInput);
    taskPanel.appendChild(taskSubmitButton);
    taskPanel.appendChild(taskStatus);

    document.body.appendChild(taskPanel);


    // --------------------------------
    // ПОКАЗ ТЕКУЩЕГО ЗАДАНИЯ
    // --------------------------------

    function showCurrentTask(cellId, text) {

        currentTaskCellId = String(cellId);
        taskSubmitted = false;

        taskTitle.textContent =
            `Задание клетки № ${cellId}`;

        taskText.textContent = text || "Текст задания отсутствует.";

        taskUrlInput.value = "";
        taskUrlInput.disabled = false;

        taskSubmitButton.disabled = false;
        taskSubmitButton.textContent = "Отправить";

        taskStatus.textContent =
            "После отправки задания станут доступны соседние клетки.";

        taskPanel.style.display = "block";

        renderPlayerPath();
    }


    // --------------------------------
    // ОТПРАВКА ТЕКУЩЕГО ЗАДАНИЯ
    // --------------------------------

    taskSubmitButton.addEventListener("click", async function () {

        if (!currentTaskCellId || taskSubmitted) {
            return;
        }

        const taskUrl = taskUrlInput.value.trim();

        if (!taskUrl) {
            taskStatus.textContent = "Укажите ссылку на задание.";
            return;
        }

        try {

            new URL(taskUrl);

        } catch {

            taskStatus.textContent = "Введите корректную ссылку.";
            return;
        }

        taskSubmitButton.disabled = true;
        taskSubmitButton.textContent = "Отправка...";
        taskStatus.textContent = "";

        try {

            const response = await fetch("/api/player/submit-task", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    cell_id: currentTaskCellId,
                    task_url: taskUrl
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || "Не удалось отправить задание."
                );
            }

            taskSubmitted = true;

            taskUrlInput.disabled = true;

            taskSubmitButton.textContent = "Отправлено";

            taskStatus.textContent =
                "Задание отправлено и ожидает проверки. Теперь можно выбрать соседнюю клетку.";

            renderPlayerPath();

            tasksLoaded = false;

        } catch (error) {

            console.error("Ошибка отправки задания:", error);

            taskStatus.textContent = error.message;

            taskSubmitButton.disabled = false;
            taskSubmitButton.textContent = "Отправить";
        }
    });


    // --------------------------------
    // ОТРИСОВКА ПОСЕЩЁННЫХ КЛЕТОК
    // --------------------------------


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

            // По умолчанию клетка недоступна

            hexagon.style.fill = "#bdbdbd";
            hexagon.classList.add("inactive-cell");

            // Посещённые клетки окрашиваются цветом игрока

            if (visitedCells.has(cellId)) {

                hexagon.style.fill =
                    currentPlayerColor || "#ffffff";

                hexagon.classList.add("visited-cell");
            }

            // Текущая клетка остаётся белой

            if (cellId === String(currentCellId)) {

                hexagon.style.fill = "#ffffff";

                hexagon.classList.remove("inactive-cell");
                hexagon.classList.add("current-cell");

                return;
            }

            // Соседние клетки становятся доступными
            // только после отправки задания

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
    }



    // --------------------------------
    // ПРОВЕРКА СОСЕДСТВА НА КЛИЕНТЕ
    // --------------------------------

    function areCellsNeighborsClient(currentId, targetId) {

        const currentHexagon = hexagons.get(
            String(currentId)
        );

        const targetHexagon = hexagons.get(
            String(targetId)
        );

        if (!currentHexagon || !targetHexagon) {
            return false;
        }

        const currentColumn = Number(
            currentHexagon.dataset.column
        );

        const currentRow = Number(
            currentHexagon.dataset.row
        );

        const targetColumn = Number(
            targetHexagon.dataset.column
        );

        const targetRow = Number(
            targetHexagon.dataset.row
        );

        const rowDifference = targetRow - currentRow;
        const columnDifference = targetColumn - currentColumn;

        if (rowDifference === 0) {
            return Math.abs(columnDifference) === 1;
        }

        if (Math.abs(rowDifference) !== 1) {
            return false;
        }

        if (currentRow % 2 === 1) {
            return columnDifference === 0 ||
                columnDifference === -1;
        }

        return columnDifference === 0 ||
            columnDifference === 1;
    }


    // --------------------------------
    // ОТКРЫТИЕ ОКНА ПОДТВЕРЖДЕНИЯ
    // --------------------------------

    function openMoveDialog(cellId, errorMessage = "") {

        pendingCellId = errorMessage ? null : String(cellId);

        moveError.textContent = errorMessage;

        if (errorMessage) {

            moveTitle.textContent = "Переход невозможен";

            moveDescription.textContent =
                "Выберите другую клетку.";

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


    // --------------------------------
    // ЗАКРЫТИЕ ОКНА
    // --------------------------------

    function closeMoveDialog() {

        moveOverlay.style.display = "none";

        pendingCellId = null;

        moveConfirmButton.disabled = false;
        moveConfirmButton.textContent = "Перейти";
    }

    moveCancelButton.addEventListener("click", function () {

        closeMoveDialog();
    });

    moveOverlay.addEventListener("click", function (event) {

        if (event.target === moveOverlay) {
            closeMoveDialog();
        }
    });


    // --------------------------------
    // ЗАГРУЗКА МАРШРУТА ПРИ ВХОДЕ
    // --------------------------------

    async function loadPlayerPath() {

        if (pathLoading) return;

        pathLoading = true;

        try {

            const response = await fetch("/api/player/path");

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.error || "Не удалось загрузить маршрут."
                );
            }

            playerPath = data.path || [];

            currentCellId = data.current_cell_id
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

        } catch (error) {

            console.error("Ошибка загрузки маршрута:", error);

        } finally {

            pathLoading = false;
        }
    }



    // --------------------------------
    // ПОДТВЕРЖДЕНИЕ ВЫБОРА КЛЕТКИ И ПЕРЕХОДА
    // --------------------------------

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

            const response = await fetch(endpoint, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    cell_id: pendingCellId
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.error || "Не удалось выбрать клетку."
                );
            }

            const selectedCellId = String(data.cell_id);

            if (isFirstCell) {

                playerPath.push({
                    order: data.path_order,
                    cell_id: selectedCellId,
                    date: data.path_date
                });

            } else {

                playerPath.push({
                    order: data.order,
                    cell_id: selectedCellId,
                    date: data.date
                });
            }

            currentCellId = selectedCellId;
            visitedCells.add(selectedCellId);

            closeMoveDialog();

            showCurrentTask(
                selectedCellId,
                data.task
            );

            renderPlayerPath();

            tasksLoaded = false;

        } catch (error) {

            console.error("Ошибка выбора клетки:", error);

            moveError.textContent = error.message;

            moveConfirmButton.disabled = false;
            moveConfirmButton.textContent = "Перейти";
        }
    });

    // --------------------------------
    // ВЫБОР КЛЕТКИ КАРТЫ
    // --------------------------------

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

        if (!pathLoaded) {
            console.warn("Маршрут ещё не загружен.");
            return;
        }

        const targetCellId = String(
            target.getAttribute("data-cell-id")
        );

        // Уже посещённые клетки недоступны

        if (visitedCells.has(targetCellId)) {

            openMoveDialog(
                targetCellId,
                "Вы уже посещали эту клетку."
            );

            return;
        }

        // Первая клетка может быть любой

        if (currentCellId === null) {

            openMoveDialog(targetCellId);

            return;
        }

        // Нельзя двигаться до отправки задания

        if (!taskSubmitted) {

            openMoveDialog(
                targetCellId,
                "Сначала отправьте задание текущей клетки."
            );

            return;
        }

        // После отправки доступны только соседи

        if (!areCellsNeighborsClient(currentCellId, targetCellId)) {

            openMoveDialog(
                targetCellId,
                "Можно перейти только на соседнюю клетку."
            );

            return;
        }

        openMoveDialog(targetCellId);
    }



    // --------------------------------
    // ПРОФИЛЬ ИГРОКА
    // --------------------------------

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

    let tasksLoaded = false;
    let tasksLoading = false;

    // --------------------------------
    // ВЫБОР ЦВЕТА ИГРОКА
    // --------------------------------

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

    let currentPlayerColor = "";
    let selectedPlayerColor = "";
    let requiredColorSelection = false;


    // --------------------------------
    // ПРИМЕНЕНИЕ ЦВЕТА
    // --------------------------------

    function applyPlayerColor(color) {

        currentPlayerColor = color;

        if (profileAvatar) {
            profileAvatar.style.backgroundColor = color;
            profileAvatar.style.borderColor = color;
        }
    }


    // --------------------------------
    // ОТРИСОВКА ПАЛИТРЫ
    // --------------------------------

    function renderColorPalette() {

        if (!colorPalette) {
            console.error("Не найден элемент player-color-palette");
            return;
        }

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


    // --------------------------------
    // ОТКРЫТИЕ ОКНА ВЫБОРА ЦВЕТА
    // --------------------------------

    function openColorPicker(required) {

        requiredColorSelection = required;

        if (required && profileWindow) {
            profileWindow.classList.add("visible");
        }

        selectedPlayerColor = currentPlayerColor;

        colorError.textContent = "";

        renderColorPalette();

        colorCancelButton.style.display =
            required ? "none" : "block";

        colorSaveButton.disabled =
            !playerColors.includes(selectedPlayerColor);

        colorOverlay.classList.add("visible");
    }


    // --------------------------------
    // ЗАКРЫТИЕ ОКНА ВЫБОРА ЦВЕТА
    // --------------------------------

    function closeColorPicker() {

        if (requiredColorSelection) {
            return;
        }

        colorOverlay.classList.remove("visible");
    }


    // --------------------------------
    // ПОЛУЧЕНИЕ ЦВЕТА ПРИ ВХОДЕ
    // --------------------------------

    async function initializePlayerColor() {

        try {

            const response = await fetch("/api/player/color");

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || "Не удалось получить цвет."
                );
            }

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

            colorError.textContent =
                "Не удалось загрузить цвет. Проверьте соединение и обновите страницу.";
        }
    }


    // --------------------------------
    // СОХРАНЕНИЕ ЦВЕТА
    // --------------------------------

    colorSaveButton.addEventListener("click", async function () {

        if (!playerColors.includes(selectedPlayerColor)) {
            return;
        }

        colorSaveButton.disabled = true;
        colorError.textContent = "";

        try {

            const response = await fetch("/api/player/color", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    color: selectedPlayerColor
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || "Не удалось сохранить цвет."
                );
            }

            applyPlayerColor(data.color);

            requiredColorSelection = false;

            colorOverlay.classList.remove("visible");

        } catch (error) {

            console.error("Ошибка сохранения цвета:", error);

            colorError.textContent =
                "Не удалось сохранить цвет. Попробуйте ещё раз.";

        } finally {

            colorSaveButton.disabled = false;
        }
    });


    // --------------------------------
    // ОТМЕНА ВЫБОРА
    // --------------------------------

    colorCancelButton.addEventListener("click", function () {

        closeColorPicker();
    });


    // --------------------------------
    // НАЖАТИЕ НА ИКОНКУ ЦВЕТА В ПРОФИЛЕ
    // --------------------------------

    if (profileAvatar) {

        profileAvatar.addEventListener("click", function (event) {

            event.stopPropagation();

            openColorPicker(false);
        });
    }

    // --------------------------------
    // ОТРИСОВКА СПИСКА МАСТЕРОВ
    // --------------------------------

    function renderMasters(masters) {

        mastersPanel.replaceChildren();

        const list = document.createElement("div");
        list.className = "player-master-list";

        if (!masters.length) {

            const emptyMessage = document.createElement("div");

            emptyMessage.className = "player-list-empty";
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

            const name = document.createElement("span");
            name.className = "player-list-name";
            name.textContent = master.name;

            identity.appendChild(avatar);
            identity.appendChild(name);

            item.appendChild(identity);
            list.appendChild(item);
        });

        mastersPanel.appendChild(list);
    }

    // --------------------------------
    // ЗАГРУЗКА СПИСКА МАСТЕРОВ
    // --------------------------------

    async function loadMasters() {

        if (mastersLoading || mastersLoaded) return;

        mastersLoading = true;

        mastersPanel.replaceChildren();

        const loadingMessage = document.createElement("div");

        loadingMessage.className = "player-list-message";
        loadingMessage.textContent = "Загрузка списка мастеров...";

        mastersPanel.appendChild(loadingMessage);

        try {

            const response = await fetch("/api/player/masters");

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.error || `Ошибка сервера: ${response.status}`
                );
            }

            renderMasters(data.masters);

            mastersLoaded = true;

        } catch (error) {

            console.error("Ошибка загрузки мастеров:", error);

            mastersPanel.replaceChildren();

            const errorMessage = document.createElement("div");

            errorMessage.className = "player-list-message";
            errorMessage.textContent =
                "Не удалось загрузить список мастеров.";

            mastersPanel.appendChild(errorMessage);

        } finally {

            mastersLoading = false;
        }
    }

    // --------------------------------
    // ОТРИСОВКА ЛИЧНЫХ ЗАДАНИЙ
    // --------------------------------

    function renderTasks(tasks) {

        tasksPanel.replaceChildren();

        const list = document.createElement("div");
        list.className = "player-task-list";

        if (!tasks.length) {

            const emptyMessage = document.createElement("div");

            emptyMessage.className = "task-list-message";
            emptyMessage.textContent =
                "Пока что нет принятых заданий";

            list.appendChild(emptyMessage);
            tasksPanel.appendChild(list);

            return;
        }

        tasks.forEach(function (task) {

            const item = document.createElement("div");
            item.className = "player-task-item";

            // Заголовок задания

            const title = document.createElement("div");
            title.className = "player-task-title";

            title.textContent = task.cell_id
                ? `Клетка № ${task.cell_id}`
                : "Задание";

            item.appendChild(title);

            // Ссылка на задание

            if (task.task_url) {

                const link = document.createElement("a");

                link.className = "player-task-link";
                link.href = task.task_url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = "Открыть задание";

                item.appendChild(link);
            }

            // Даты

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

            // Статус

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

            list.appendChild(item);
        });

        tasksPanel.appendChild(list);
    }

    // --------------------------------
    // ЗАГРУЗКА ЛИЧНЫХ ЗАДАНИЙ
    // --------------------------------

    async function loadTasks() {

        if (tasksLoading || tasksLoaded) return;

        tasksLoading = true;

        tasksPanel.replaceChildren();

        const loadingMessage = document.createElement("div");

        loadingMessage.className = "task-list-message";
        loadingMessage.textContent = "Загрузка заданий...";

        tasksPanel.appendChild(loadingMessage);

        try {

            const response = await fetch("/api/player/tasks");

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.error || `Ошибка сервера: ${response.status}`
                );
            }

            renderTasks(data.tasks);

            tasksLoaded = true;

        } catch (error) {

            console.error("Ошибка загрузки заданий:", error);

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

    // --------------------------------
    // ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
    // --------------------------------

    mainTabs.forEach(function (tab) {

        tab.addEventListener("click", function () {

            const selectedTab = tab.dataset.mainTab;

            mainTabs.forEach(function (item) {
                item.classList.remove("active");
            });

            mainPanels.forEach(function (panel) {
                panel.classList.remove("active");
            });

            tab.classList.add("active");

            const selectedPanel = document.querySelector(
                `.player-profile-main-panel[data-main-panel="${selectedTab}"]`
            );

            if (selectedPanel) {
                selectedPanel.classList.add("active");
            }

            if (selectedTab === "masters") {
                loadMasters();
            }

            if (selectedTab === "tasks") {
                loadTasks();
            }
        });
    });

    // --------------------------------
    // ВЫХОД ИЗ ПРОФИЛЯ
    // --------------------------------

    const logoutButton = document.getElementById(
        "player-logout-button"
    );

    if (logoutButton) {

        logoutButton.addEventListener("click", function () {
            window.location.href = "/logout";
        });
    }

    // --------------------------------
    // ИЗМЕНЕНИЕ РАЗМЕРА ОКНА
    // --------------------------------

    // Проверка цвета при входе на страницу
    initializePlayerColor();

    // Загрузка маршрута игрока
    loadPlayerPath();

    window.addEventListener("resize", updateViewBox);
});
