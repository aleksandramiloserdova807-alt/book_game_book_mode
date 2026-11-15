
document.addEventListener("DOMContentLoaded", function () {

    const pendingPanel = document.querySelector(
        '.master-profile-subpanel[data-subpanel="pending"]'
    );

    const pendingTab = document.querySelector(
        '.master-profile-subtab[data-subtab="pending"]'
    );

    const tasksMainTab = document.querySelector(
        '.master-profile-main-tab[data-main-tab="tasks"]'
    );

    if (!pendingPanel || !pendingTab || !tasksMainTab) {
        return;
    }

    let loading = false;

    // --------------------------------
    // СООБЩЕНИЯ
    // --------------------------------

    function showMessage(message) {

        pendingPanel.replaceChildren();

        const element = document.createElement("div");

        element.className = "task-list-message";
        element.textContent = message;

        pendingPanel.appendChild(element);
    }


    // --------------------------------
    // ПРОВЕРКА ССЫЛКИ
    // --------------------------------

    function getSafeUrl(value) {

        try {

            const url = new URL(value);

            if (
                url.protocol !== "https:" &&
                url.protocol !== "http:"
            ) {
                return null;
            }

            return url.href;

        } catch {

            return null;
        }
    }


    // --------------------------------
    // ОБНОВЛЕНИЕ ПУСТОГО СПИСКА
    // --------------------------------

    function updateEmptyMessage() {

        const cards = pendingPanel.querySelectorAll(
            ".master-pending-task"
        );

        if (cards.length === 0) {
            showMessage(
                "Пока что нет непроверенных заданий."
            );
        }
    }


    // --------------------------------
    // СОЗДАНИЕ КАРТОЧКИ ЗАДАНИЯ
    // --------------------------------

    function createTaskCard(task) {

        const card = document.createElement("div");

        card.className = "master-pending-task";

        // Текст задания.

        const taskText = document.createElement("div");

        taskText.className = "master-pending-task-text";

        taskText.textContent =
            task.task || "Текст задания не найден.";

        card.appendChild(taskText);

        // Информация об игроке.

        const playerInfo = document.createElement("div");

        playerInfo.className = "master-pending-task-info";

        playerInfo.textContent =
            `${task.player_name || "Игрок"} · Клетка № ${task.cell_id}`;

        card.appendChild(playerInfo);

        // Ссылка на работу игрока.

        const taskUrl = getSafeUrl(task.task_url || "");

        if (taskUrl) {

            const link = document.createElement("a");

            link.className = "master-pending-task-link";
            link.href = taskUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Открыть задание игрока";

            card.appendChild(link);

        } else {

            const missingLink = document.createElement("div");

            missingLink.className = "master-pending-task-no-link";
            missingLink.textContent = "Ссылка на работу недоступна.";

            card.appendChild(missingLink);
        }

        // Кнопки проверки.

        const actions = document.createElement("div");

        actions.className = "master-pending-task-actions";

        const acceptButton = document.createElement("button");

        acceptButton.type = "button";
        acceptButton.className = "master-pending-task-accept";
        acceptButton.textContent = "Принять";

        const rejectButton = document.createElement("button");

        rejectButton.type = "button";
        rejectButton.className = "master-pending-task-reject";
        rejectButton.textContent = "Не принять";

        actions.appendChild(acceptButton);
        actions.appendChild(rejectButton);

        card.appendChild(actions);

        // Сообщение об ошибке.

        const errorMessage = document.createElement("div");

        errorMessage.className = "master-pending-task-error";

        card.appendChild(errorMessage);

        // Обработчики кнопок.

        acceptButton.addEventListener("click", function () {

            reviewTask(
                task,
                "accept",
                card,
                acceptButton,
                rejectButton,
                errorMessage
            );

        });

        rejectButton.addEventListener("click", function () {

            reviewTask(
                task,
                "reject",
                card,
                acceptButton,
                rejectButton,
                errorMessage
            );

        });

        return card;
    }


    // --------------------------------
    // ПРИНЯТИЕ ИЛИ ОТКЛОНЕНИЕ
    // --------------------------------

    async function reviewTask(
        task,
        decision,
        card,
        acceptButton,
        rejectButton,
        errorMessage
    ) {

        acceptButton.disabled = true;
        rejectButton.disabled = true;

        errorMessage.textContent = "";

        const previousAcceptText = acceptButton.textContent;
        const previousRejectText = rejectButton.textContent;

        if (decision === "accept") {
            acceptButton.textContent = "Обработка...";
        } else {
            rejectButton.textContent = "Обработка...";
        }

        try {

            const response = await fetch(
                `/api/tasks/${encodeURIComponent(task.player_id)}/${encodeURIComponent(task.cell_id)}/review`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        decision: decision
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.error || "Не удалось сохранить решение."
                );
            }

            // Убираем проверенное задание из списка.

            card.remove();

            updateEmptyMessage();

        } catch (error) {

            console.error(
                "Ошибка проверки задания:",
                error
            );

            errorMessage.textContent =
                error.message || "Произошла ошибка.";

            acceptButton.disabled = false;
            rejectButton.disabled = false;

            acceptButton.textContent = previousAcceptText;
            rejectButton.textContent = previousRejectText;
        }
    }


    // --------------------------------
    // ОТРИСОВКА СПИСКА
    // --------------------------------

    function renderPendingTasks(tasks) {

        pendingPanel.replaceChildren();

        if (!tasks || tasks.length === 0) {

            showMessage(
                "Пока что нет непроверенных заданий."
            );

            return;
        }

        tasks.forEach(function (task) {

            const card = createTaskCard(task);

            pendingPanel.appendChild(card);

        });
    }


    // --------------------------------
    // ЗАГРУЗКА НЕПРОВЕРЕННЫХ ЗАДАНИЙ
    // --------------------------------

    async function loadPendingTasks() {

        if (loading) return;

        loading = true;

        showMessage("Загрузка непроверенных заданий...");

        try {

            const response = await fetch(
                "/api/tasks/pending"
            );

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.error || `Ошибка сервера: ${response.status}`
                );
            }

            renderPendingTasks(data.tasks);

        } catch (error) {

            console.error(
                "Ошибка загрузки непроверенных заданий:",
                error
            );

            showMessage(
                "Не удалось загрузить непроверенные задания."
            );

        } finally {

            loading = false;
        }
    }


    // --------------------------------
    // ПЕРЕКЛЮЧЕНИЕ НА ВКЛАДКУ ЗАДАНИЙ
    // --------------------------------

    tasksMainTab.addEventListener("click", function () {

        if (pendingTab.classList.contains("active")) {
            loadPendingTasks();
        }

    });


    // --------------------------------
    // ПЕРЕКЛЮЧЕНИЕ НА НЕПРОВЕРЕННЫЕ
    // --------------------------------

    pendingTab.addEventListener("click", function () {

        loadPendingTasks();

    });

});
