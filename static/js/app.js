
document.addEventListener("DOMContentLoaded", async function () {

    const map = document.getElementById("game-map");
    const mapFrame = document.getElementById("map-frame");

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
    // ЗАГРУЗКА КЛЕТОК
    // --------------------------------

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

    // --------------------------------
    // РАЗМЕРЫ КАРТЫ
    // --------------------------------

    const columns = Math.max(
        ...cells.map(cell => Number(cell.column))
    );

    const rows = Math.max(
        ...cells.map(cell => Number(cell.row))
    );

    const contentWidth =
        columns * hexWidth + hexWidth / 2;

    const contentHeight =
        (rows - 1) * radius * 1.5 + hexHeight;

    // Отступы вокруг поля:
    // шесть шестиугольников с каждой стороны.

    const paddingX = hexWidth * 6;
    const paddingY = hexHeight * 6;

    const mapWidth = contentWidth + paddingX * 2;
    const mapHeight = contentHeight + paddingY * 2;

    const frame = document.getElementById("map-frame");

    function updateFrameSize() {
        const availableWidth = window.innerWidth - 32;
        const availableHeight = window.innerHeight - 32;

        const scale = Math.min(
            availableWidth / mapWidth,
            availableHeight / mapHeight
        );

        frame.style.width = `${mapWidth * scale}px`;
        frame.style.height = `${mapHeight * scale}px`;
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

    cells.forEach(function (cell) {

        const col = Number(cell.column) - 1;
        const row = Number(cell.row) - 1;

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

        hexagon.setAttribute("data-cell-id", cell.cell_id);
        hexagon.setAttribute("data-column", cell.column);
        hexagon.setAttribute("data-row", cell.row);
        hexagon.setAttribute("data-task", cell.task);

        fragment.appendChild(hexagon);
    });

    svg.appendChild(fragment);

    // СЕРАЯ РАМКА ВОКРУГ ИГРОВОЙ ОБЛАСТИ С ОТСТУПАМИ

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

    console.log(`Карта создана: ${cells.length} ячеек`);

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

    function showCellInfo(cell) {

        popupTitle.textContent =
            `Клетка № ${cell.dataset.cellId}`;

        popupCoordinates.textContent =
            `Столбец: ${cell.dataset.column} · Строка: ${cell.dataset.row}`;

        popupTask.textContent = cell.dataset.task;

        updatePopupPosition();
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

    // --------------------------------
    // ИЗМЕНЕНИЕ РАЗМЕРА ОКНА
    // --------------------------------

    window.addEventListener("resize", function () {

        updatePopupPosition();

    });

});
