
document.addEventListener("DOMContentLoaded", async function () {
    const map = document.getElementById("game-map");

    const radius = 20;
    const hexWidth = Math.sqrt(3) * radius;
    const hexHeight = radius * 2;
    const svgNS = "http://www.w3.org/2000/svg";

    // Вершины шестиугольника
    const hexOffsets = [];

    for (let i = 0; i < 6; i++) {
        const angle = (-90 + i * 60) * Math.PI / 180;

        hexOffsets.push({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        });
    }

    // Загрузка клеток
    let cells;

    try {
        const response = await fetch("/api/cells");

        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.cells)) {
            throw new Error("Некорректные данные сервера.");
        }

        cells = data.cells;

    } catch (error) {
        console.error("Не удалось загрузить карту:", error);
        return;
    }

    if (cells.length === 0) {
        console.error("В таблице нет клеток.");
        return;
    }

    // Размеры карты
    const columns = Math.max(...cells.map(cell => Number(cell.column)));
    const rows = Math.max(...cells.map(cell => Number(cell.row)));

    const mapWidth = columns * hexWidth + hexWidth / 2;
    const mapHeight = (rows - 1) * radius * 1.5 + hexHeight;

    // Создание SVG
    const svg = document.createElementNS(svgNS, "svg");

    svg.setAttribute("viewBox", `0 0 ${mapWidth} ${mapHeight}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "hex-map");

    const fragment = document.createDocumentFragment();

    cells.forEach(function (cell) {
        const col = Number(cell.column) - 1;
        const row = Number(cell.row) - 1;

        const centerX =
            hexWidth / 2 +
            col * hexWidth +
            (row % 2) * hexWidth / 2;

        const centerY = radius + row * radius * 1.5;

        const points = hexOffsets.map(function (offset) {
            return `${centerX + offset.x},${centerY + offset.y}`;
        });

        const hexagon = document.createElementNS(svgNS, "polygon");

        hexagon.setAttribute("points", points.join(" "));
        hexagon.setAttribute("class", "hex-cell");
        hexagon.setAttribute("data-cell-id", cell.cell_id);
        hexagon.setAttribute("data-column", cell.column);
        hexagon.setAttribute("data-row", cell.row);
        hexagon.setAttribute("data-task", cell.task);

        fragment.appendChild(hexagon);
    });

    svg.appendChild(fragment);
    map.appendChild(svg);

    console.log(`Карта создана: ${cells.length} ячеек`);

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

    map.appendChild(popup);

    let selectedCell = null;

    function updatePopupPosition() {
        if (!selectedCell) return;

        const cellRect = selectedCell.getBoundingClientRect();
        const mapRect = map.getBoundingClientRect();

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

        // Если сверху недостаточно места, показываем снизу
        if (top < 8) {
            top = cellRect.bottom + 8 - mapRect.top;
            popup.classList.add("below");
        }

        // Не позволяем окошку выходить за границы карты
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

    function showCellInfo(cell) {
        popupTitle.textContent = `Клетка № ${cell.dataset.cellId}`;

        popupCoordinates.textContent =
            `Столбец: ${cell.dataset.column} · Строка: ${cell.dataset.row}`;

        popupTask.textContent = cell.dataset.task;

        updatePopupPosition();
    }

    // --------------------------------
    // МАСШТАБИРОВАНИЕ
    // --------------------------------

    const view = {
        x: 0,
        y: 0,
        width: mapWidth,
        height: mapHeight
    };

    const minWidth = mapWidth / 12;
    const maxWidth = mapWidth * 2;

    function updateViewBox() {
        svg.setAttribute(
            "viewBox",
            `${view.x} ${view.y} ${view.width} ${view.height}`
        );

        updatePopupPosition();
    }

    svg.addEventListener("wheel", function (event) {
        event.preventDefault();

        const rect = svg.getBoundingClientRect();

        const mouseX = (event.clientX - rect.left) / rect.width;
        const mouseY = (event.clientY - rect.top) / rect.height;

        const anchorX = view.x + mouseX * view.width;
        const anchorY = view.y + mouseY * view.height;

        const zoomFactor = event.deltaY < 0 ? 0.9 : 1.1;

        const newWidth = Math.min(
            maxWidth,
            Math.max(minWidth, view.width * zoomFactor)
        );

        const scale = newWidth / view.width;
        const newHeight = view.height * scale;

        view.x = anchorX - mouseX * newWidth;
        view.y = anchorY - mouseY * newHeight;

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

    svg.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;

        dragging = true;
        hasDragged = false;
        suppressNextClick = false;

        startX = event.clientX;
        startY = event.clientY;

        startViewX = view.x;
        startViewY = view.y;

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

        const rect = svg.getBoundingClientRect();

        const deltaX =
            (event.clientX - startX) * (view.width / rect.width);

        const deltaY =
            (event.clientY - startY) * (view.height / rect.height);

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

        if (!cell) return;

        if (selectedCell) {
            selectedCell.classList.remove("selected");
        }

        cell.classList.add("selected");
        selectedCell = cell;

        const selectedCellData = {
            cell_id: cell.dataset.cellId,
            column: Number(cell.dataset.column),
            row: Number(cell.dataset.row),
            task: cell.dataset.task
        };

        console.log("Выбрана клетка:", selectedCellData);

        showCellInfo(cell);
    });

    // Обновление положения окошка при изменении размера окна
    window.addEventListener("resize", updatePopupPosition);
});
