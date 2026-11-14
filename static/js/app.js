
document.addEventListener("DOMContentLoaded", async function () {
    const map = document.getElementById("game-map");

    const radius = 20;
    const hexWidth = Math.sqrt(3) * radius;
    const hexHeight = radius * 2;

    const svgNS = "http://www.w3.org/2000/svg";

    // Координаты вершин шестиугольника вычисляем один раз
    const hexOffsets = [];

    for (let i = 0; i < 6; i++) {
        const angle = (-90 + i * 60) * Math.PI / 180;

        hexOffsets.push({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        });
    }

    // --------------------------------
    // ЗАГРУЗКА ДАННЫХ
    // --------------------------------

    let cells;

    const fetchStart = performance.now();

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

    console.log(
        `Загрузка данных: ${(performance.now() - fetchStart).toFixed(1)} мс`
    );

    if (cells.length === 0) {
        console.error("В таблице нет клеток.");
        return;
    }

    // --------------------------------
    // РАЗМЕРЫ КАРТЫ
    // --------------------------------

    const columns = Math.max(...cells.map(cell => Number(cell.column)));
    const rows = Math.max(...cells.map(cell => Number(cell.row)));

    const mapWidth = columns * hexWidth + hexWidth / 2;
    const mapHeight = (rows - 1) * radius * 1.5 + hexHeight;

    // --------------------------------
    // СОЗДАНИЕ SVG
    // --------------------------------

    const svg = document.createElementNS(svgNS, "svg");

    svg.setAttribute(
        "viewBox",
        `0 0 ${mapWidth} ${mapHeight}`
    );

    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "hex-map");

    // Все ячейки сначала создаются в памяти
    const fragment = document.createDocumentFragment();

    const renderStart = performance.now();

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

        const hexagon = document.createElementNS(
            svgNS,
            "polygon"
        );

        hexagon.setAttribute("points", points.join(" "));
        hexagon.setAttribute("class", "hex-cell");
        hexagon.setAttribute("data-cell-id", cell.cell_id);

        fragment.appendChild(hexagon);
    });

    // Добавляем все 600 ячеек одной операцией
    svg.appendChild(fragment);
    map.appendChild(svg);

    console.log(
        `Отрисовка карты: ${(performance.now() - renderStart).toFixed(1)} мс`
    );

    console.log(`Карта создана: ${cells.length} ячеек`);

    // --------------------------------
    // МАСШТАБИРОВАНИЕ И ПЕРЕМЕЩЕНИЕ
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
    }

    // Масштабирование колесом мыши
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

    // Перемещение карты мышью
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startViewX = 0;
    let startViewY = 0;

    svg.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;

        dragging = true;

        startX = event.clientX;
        startY = event.clientY;

        startViewX = view.x;
        startViewY = view.y;

        svg.setPointerCapture(event.pointerId);
        svg.classList.add("dragging");
    });

    svg.addEventListener("pointermove", function (event) {
        if (!dragging) return;

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
        dragging = false;
        svg.classList.remove("dragging");
    }

    svg.addEventListener("pointerup", stopDragging);
    svg.addEventListener("pointercancel", stopDragging);
    svg.addEventListener("lostpointercapture", stopDragging);
});
