
document.addEventListener("DOMContentLoaded", function () {

    const rejectedPanel = document.querySelector(
        '.master-profile-subpanel[data-subpanel="rejected"]'
    );

    const rejectedTab = document.querySelector(
        '.master-profile-subtab[data-subtab="rejected"]'
    );

    const tasksMainTab = document.querySelector(
        '.master-profile-main-tab[data-main-tab="tasks"]'
    );

    if (!rejectedPanel || !rejectedTab || !tasksMainTab) {
        return;
    }

    let loading = false;

    function showMessage(message) {

        rejectedPanel.replaceChildren();

        const element = document.createElement("div");

        element.className = "task-list-message";
        element.textContent = message;

        rejectedPanel.appendChild(element);
    }

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

    function createTaskCard(task) {

        const card = document.createElement("div");

        card.className = "master-pending-task";

        const taskText = document.createElement("div");

        taskText.className = "master-pending-task-text";
        taskText.textContent =
            task.task || "                       .";

        card.appendChild(taskText);

        const playerInfo = document.createElement("div");

        playerInfo.className = "master-pending-task-info";

        playerInfo.textContent =
            `${task.player_name || "     "}            ${task.cell_id}`;

        card.appendChild(playerInfo);

        const taskUrl = getSafeUrl(task.task_url || "");

        if (taskUrl) {

            const link = document.createElement("a");

            link.className = "master-pending-task-link";
            link.href = taskUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "                     ";

            card.appendChild(link);

        } else {

            const missingLink = document.createElement("div");

            missingLink.className = "master-pending-task-no-link";
            missingLink.textContent = "                           .";

            card.appendChild(missingLink);
        }

        //                                      

        const returnButton = document.createElement("button");

        returnButton.type = "button";
        returnButton.className = "master-rejected-return-button";
        returnButton.textContent = "Вернуть на выполнение";

        returnButton.addEventListener("click", function () {
            returnRejectedTask(task, returnButton);
        });

        card.appendChild(returnButton);

        return card;
    }

    function renderRejectedTasks(tasks) {

        rejectedPanel.replaceChildren();

        if (!tasks || tasks.length === 0) {

            showMessage(
                "Ещё нет непринятых заданий."
            );

            return;
        }

        tasks.forEach(function (task) {

            rejectedPanel.appendChild(
                createTaskCard(task)
            );

        });
    }

    async function loadRejectedTasks() {

        if (loading) return;

        loading = true;

        showMessage("Загружаем непринятые задания...");

        try {

            const response = await fetch(
                "/api/tasks/rejected"
            );

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.error || `              : ${response.status}`
                );
            }

            renderRejectedTasks(data.tasks);

        } catch (error) {

            console.error(
                "                                  :",
                error
            );

            showMessage(
                "Не удалось загрузить непринятые задания."
            );

        } finally {

            loading = false;
        }
    }

    async function returnRejectedTask(task, button) {

        const playerId = String(task.player_id || "").trim();
        const cellId = String(task.cell_id || "").trim();

        if (!playerId || !cellId) {
            alert("                                       .");
            return;
        }

        button.disabled = true;
        button.textContent = "...";

        try {
            const response = await fetch(
                `/api/tasks/${encodeURIComponent(playerId)}/${encodeURIComponent(cellId)}/return`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({})
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.error || "                          ."
                );
            }

            await loadRejectedTasks();

        } catch (error) {
            alert(error.message || "                       .");
            button.disabled = false;
            button.textContent = "                     ";
        }
    }

    tasksMainTab.addEventListener("click", function () {

        if (rejectedTab.classList.contains("active")) {
            loadRejectedTasks();
        }

    });

    rejectedTab.addEventListener("click", function () {

        loadRejectedTasks();

    });

});