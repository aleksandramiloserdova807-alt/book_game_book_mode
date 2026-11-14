
document.addEventListener("DOMContentLoaded", function () {
    const map = document.getElementById("game-map");

    // Настройки карты
    const columns = 30;
    const rows = 20;
    const radius = 20;

    const hexWidth = Math.sqrt(3) * radius;
    const hexHeight = radius * 2;

    const mapWidth = columns * hexWidth + hexWidth / 2;
    const mapHeight = (rows - 1) * radius * 1.5 + hexHeight;

    const svgNS = "http://www.w3.org/2000/svg";

    // Создание SVG
    const svg = document.createElementNS(svgNS, "svg");

    svg.setAttribute(
        "viewBox",
        `0 0 ${mapWidth} ${mapHeight}`
    );

    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "hex-map");

    // Создание 600 ячеек
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {

            const centerX =
                hexWidth / 2 +
                col * hexWidth +
                (row % 2) * hexWidth / 2;

            const centerY =
                radius + row * radius * 1.5;

            const points = [];

            for (let i = 0; i < 6; i++) {
                const angle = (-90 + i * 60) * Math.PI / 180;

                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);

                points.push(`${x},${y}`);
            }

            const hexagon = document.createElementNS(
                svgNS,
                "polygon"
            );

            hexagon.setAttribute("points", points.join(" "));
            hexagon.setAttribute("class", "hex-cell");

            svg.appendChild(hexagon);
        }
    }

    map.appendChild(svg);

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

    // Приближение и отдаление колесом мыши
    svg.addEventListener("wheel", function (event) {
        event.preventDefault();

        const rect = svg.getBoundingClientRect();

        const mouseX =
            (event.clientX - rect.left) / rect.width;

        const mouseY =
            (event.clientY - rect.top) / rect.height;

        // Точка карты под курсором
        const anchorX = view.x + mouseX * view.width;
        const anchorY = view.y + mouseY * view.height;

        const zoomFactor = event.deltaY < 0 ? 0.9 : 1.1;

        const newWidth = Math.min(
            maxWidth,
            Math.max(minWidth, view.width * zoomFactor)
        );

        const scale = newWidth / view.width;
        const newHeight = view.height * scale;

        // Сохраняем точку под курсором
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
            (event.clientX - startX) *
            (view.width / rect.width);

        const deltaY =
            (event.clientY - startY) *
            (view.height / rect.height);

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

    console.log(`Карта создана: ${columns * rows} ячеек`);
});
