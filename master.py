
import time
import gspread

from threading import Lock

from flask import (
    Blueprint,
    render_template,
    jsonify,
    session,
    current_app,
    request
)

from google_sheets import (
    load_cells,
    load_master_players,
    get_worksheets,
    normalize_player_id,
    is_true_flag
)


master_bp = Blueprint("master", __name__)


# --------------------------------
# КЭШ КЛЕТОК
# --------------------------------

cells_cache = None
cells_lock = Lock()


# --------------------------------
# ПРОВЕРКА АВТОРИЗАЦИИ
# --------------------------------

def is_master_logged_in():

    return (
        session.get("is_master") is True
        and session.get("player_id") is not None
    )


# --------------------------------
# ЗАГРУЗКА КЛЕТОК С ПОВТОРНЫМИ ПОПЫТКАМИ
# --------------------------------

def initialize_cells_cache():

    global cells_cache

    if cells_cache is not None:
        return cells_cache

    with cells_lock:

        if cells_cache is not None:
            return cells_cache

        attempts = 3

        for attempt in range(1, attempts + 1):

            try:

                current_app.logger.info(
                    f"Загрузка клеток из Google Sheets. "
                    f"Попытка {attempt}/{attempts}"
                )

                cells = load_cells()

                cells_cache = cells

                current_app.logger.info(
                    f"Кэш успешно заполнен. Клеток: {len(cells_cache)}"
                )

                return cells_cache

            except Exception:

                current_app.logger.exception(
                    f"Ошибка загрузки клеток. "
                    f"Попытка {attempt}/{attempts}"
                )

                if attempt < attempts:
                    time.sleep(3)

        raise RuntimeError(
            "Не удалось загрузить клетки из Google Sheets "
            "после трёх попыток."
        )


# --------------------------------
# ПОИСК КЛЕТКИ ПО КООРДИНАТАМ
# --------------------------------

def find_cell_by_coordinates(column, row):

    cells = initialize_cells_cache()

    for cell in cells:

        if (
            int(cell["column"]) == column
            and int(cell["row"]) == row
        ):
            return cell

    return None


# --------------------------------
# ПОЛУЧЕНИЕ СТОЛБЦОВ ЛИСТА ЗАДАНИЙ
# --------------------------------

def get_tasks_headers():

    worksheet = get_worksheets()["tasks"]

    headers = worksheet.row_values(1)

    if not headers:
        raise ValueError(
            "Лист «Задания» не содержит заголовков."
        )

    return worksheet, headers


# --------------------------------
# СОЗДАНИЕ СТОЛБЦА ОТКЛОНЕНИЯ
# --------------------------------

def ensure_rejected_column(worksheet, headers):

    if "Отклонено" in headers:
        return headers

    new_column = len(headers) + 1

    worksheet.update_cell(
        1,
        new_column,
        "Отклонено"
    )

    headers.append("Отклонено")

    current_app.logger.info(
        "В лист «Задания» добавлен столбец «Отклонено»."
    )

    return headers


# --------------------------------
# ПОЛУЧЕНИЕ НЕПРИНЯТЫХ ЗАДАНИЙ
# --------------------------------

@master_bp.route("/api/tasks/rejected")
def get_rejected_tasks():

    if not is_master_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    try:

        worksheet, headers = get_tasks_headers()

        task_records = worksheet.get_all_records()

        player_records = get_worksheets()[
            "players"
        ].get_all_records()

        cells = initialize_cells_cache()

        current_player_id = normalize_player_id(
            session["player_id"]
        )

        player_names = {}

        for player in player_records:

            player_id = normalize_player_id(
                player.get("Player_ID", "")
            )

            if not player_id:
                continue

            player_name = str(
                player.get("Имя игрока", "")
            ).strip()

            player_names[player_id] = (
                player_name or f"Игрок {player_id}"
            )

        cell_tasks = {}

        for cell in cells:

            cell_id = normalize_player_id(
                cell.get("cell_id", "")
            )

            if cell_id:
                cell_tasks[cell_id] = str(
                    cell.get("task", "")
                ).strip()

        rejected_tasks = []

        for record in task_records:

            player_id = normalize_player_id(
                record.get("Player_ID", "")
            )

            cell_id = normalize_player_id(
                record.get("Cell_ID", "")
            )

            if not player_id or not cell_id:
                continue

            if player_id == current_player_id:
                continue

            is_rejected = is_true_flag(
                record.get("Отклонено", False)
            )

            if not is_rejected:
                continue

            task_url = str(
                record.get("Ссылка на задание", "")
            ).strip()

            rejected_tasks.append({

                "player_id": player_id,

                "player_name": player_names.get(
                    player_id,
                    f"Игрок {player_id}"
                ),

                "cell_id": cell_id,

                "task": cell_tasks.get(
                    cell_id,
                    "Текст задания не найден."
                ),

                "task_url": task_url,

                "submitted_date": str(
                    record.get("Дата сдачи", "")
                ).strip()

            })

        return jsonify({
            "success": True,
            "count": len(rejected_tasks),
            "tasks": rejected_tasks
        })

    except Exception:

        current_app.logger.exception(
            "Ошибка получения непринятых заданий"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить непринятые задания."
        }), 500

# --------------------------------
# ПОЛУЧЕНИЕ НЕПРОВЕРЕННЫХ ЗАДАНИЙ
# --------------------------------

@master_bp.route("/api/tasks/pending")
def get_pending_tasks():

    if not is_master_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    try:

        worksheet, headers = get_tasks_headers()

        task_records = worksheet.get_all_records()

        player_records = get_worksheets()[
            "players"
        ].get_all_records()

        cells = initialize_cells_cache()

        current_player_id = normalize_player_id(
            session["player_id"]
        )

        player_names = {}

        for player in player_records:

            player_id = normalize_player_id(
                player.get("Player_ID", "")
            )

            if not player_id:
                continue

            player_name = str(
                player.get("Имя игрока", "")
            ).strip()

            player_names[player_id] = (
                player_name or f"Игрок {player_id}"
            )

        cell_tasks = {}

        for cell in cells:

            cell_id = normalize_player_id(
                cell.get("cell_id", "")
            )

            if cell_id:
                cell_tasks[cell_id] = str(
                    cell.get("task", "")
                ).strip()

        pending_tasks = []

        for record in task_records:

            player_id = normalize_player_id(
                record.get("Player_ID", "")
            )

            cell_id = normalize_player_id(
                record.get("Cell_ID", "")
            )

            if not player_id or not cell_id:
                continue

            if player_id == current_player_id:
                continue

            is_submitted = is_true_flag(
                record.get("Сдано", False)
            )

            is_accepted = is_true_flag(
                record.get("Принято", False)
            )

            is_rejected = is_true_flag(
                record.get("Отклонено", False)
            )

            if not is_submitted:
                continue

            if is_accepted or is_rejected:
                continue

            task_url = str(
                record.get("Ссылка на задание", "")
            ).strip()

            pending_tasks.append({

                "player_id": player_id,

                "player_name": player_names.get(
                    player_id,
                    f"Игрок {player_id}"
                ),

                "cell_id": cell_id,

                "task": cell_tasks.get(
                    cell_id,
                    "Текст задания не найден."
                ),

                "task_url": task_url,

                "submitted_date": str(
                    record.get("Дата сдачи", "")
                ).strip()

            })

        return jsonify({
            "success": True,
            "count": len(pending_tasks),
            "tasks": pending_tasks
        })

    except Exception:

        current_app.logger.exception(
            "Ошибка получения непроверенных заданий"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить непроверенные задания."
        }), 500


# --------------------------------
# ПРИНЯТИЕ ИЛИ ОТКЛОНЕНИЕ ЗАДАНИЯ
# --------------------------------

@master_bp.route(
    "/api/tasks/<player_id>/<cell_id>/review",
    methods=["POST"]
)
def review_player_task(player_id, cell_id):

    if not is_master_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    try:

        data = request.get_json(silent=True) or {}

        decision = str(
            data.get("decision", "")
        ).strip().lower()

        if decision not in ("accept", "reject"):

            return jsonify({
                "success": False,
                "error": "Некорректное решение."
            }), 400

        player_id = normalize_player_id(player_id)
        cell_id = normalize_player_id(cell_id)

        if not player_id or not cell_id:

            return jsonify({
                "success": False,
                "error": "Не указан игрок или клетка."
            }), 400

        worksheet, headers = get_tasks_headers()

        headers = ensure_rejected_column(
            worksheet,
            headers
        )

        required_headers = [
            "Player_ID",
            "Cell_ID",
            "Сдано",
            "Принято",
            "Отклонено"
        ]

        for header in required_headers:

            if header not in headers:
                raise ValueError(
                    f"Отсутствует столбец «{header}»."
                )

        records = worksheet.get_all_records()

        target_row = None
        target_record = None

        for row_number, record in enumerate(
            records,
            start=2
        ):

            record_player_id = normalize_player_id(
                record.get("Player_ID", "")
            )

            record_cell_id = normalize_player_id(
                record.get("Cell_ID", "")
            )

            if (
                record_player_id == player_id
                and record_cell_id == cell_id
            ):

                target_row = row_number
                target_record = record
                break

        if target_row is None:

            return jsonify({
                "success": False,
                "error": "Задание не найдено."
            }), 404

        if not is_true_flag(
            target_record.get("Сдано", False)
        ):

            return jsonify({
                "success": False,
                "error": "Это задание уже не ожидает проверки."
            }), 409

        if is_true_flag(
            target_record.get("Принято", False)
        ):

            return jsonify({
                "success": False,
                "error": "Задание уже принято."
            }), 409

        submitted_column = headers.index("Сдано") + 1
        accepted_column = headers.index("Принято") + 1
        rejected_column = headers.index("Отклонено") + 1

        if decision == "accept":

            updates = [

                {
                    "range": gspread.utils.rowcol_to_a1(
                        target_row,
                        accepted_column
                    ),
                    "values": [["TRUE"]]
                },

                {
                    "range": gspread.utils.rowcol_to_a1(
                        target_row,
                        rejected_column
                    ),
                    "values": [["FALSE"]]
                }

            ]

            result_status = "accepted"

        else:

            updates = [

                {
                    "range": gspread.utils.rowcol_to_a1(
                        target_row,
                        submitted_column
                    ),
                    "values": [["FALSE"]]
                },

                {
                    "range": gspread.utils.rowcol_to_a1(
                        target_row,
                        accepted_column
                    ),
                    "values": [["FALSE"]]
                },

                {
                    "range": gspread.utils.rowcol_to_a1(
                        target_row,
                        rejected_column
                    ),
                    "values": [["TRUE"]]
                }

            ]

            result_status = "rejected"

        worksheet.batch_update(
            updates,
            value_input_option="USER_ENTERED"
        )

        return jsonify({
            "success": True,
            "status": result_status,
            "player_id": player_id,
            "cell_id": cell_id
        })

    except Exception:

        current_app.logger.exception(
            "Ошибка проверки задания игрока"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось сохранить решение мастера."
        }), 500


# --------------------------------
# ВОЗВРАТ ОТКЛОНЁННОГО ЗАДАНИЯ НА ВЫПОЛНЕНИЕ
# --------------------------------

@master_bp.route(
    "/api/tasks/<player_id>/<cell_id>/return",
    methods=["POST"]
)
def return_player_task(player_id, cell_id):

    if not is_master_logged_in():
        return jsonify({
            "success": False,
            "error": "Требуется авторизация мастера."
        }), 401

    player_id = normalize_player_id(player_id)
    cell_id = normalize_player_id(cell_id)

    if not player_id or not cell_id:
        return jsonify({
            "success": False,
            "error": "Не указан игрок или клетка."
        }), 400

    try:
        worksheet, headers = get_tasks_headers()

        required_headers = [
            "Player_ID",
            "Cell_ID",
            "Сдано",
            "Отклонено",
            "Ссылка на задание",
            "Дата сдачи"
        ]

        missing_headers = [
            header for header in required_headers
            if header not in headers
        ]

        if missing_headers:
            raise ValueError(
                "В листе «Задания» отсутствуют столбцы: "
                + ", ".join(missing_headers)
            )

        records = worksheet.get_all_records()

        for row_number, record in enumerate(records, start=2):

            record_player_id = normalize_player_id(
                record.get("Player_ID", "")
            )

            record_cell_id = normalize_player_id(
                record.get("Cell_ID", "")
            )

            if (
                record_player_id != player_id
                or record_cell_id != cell_id
            ):
                continue

            if not is_true_flag(
                record.get("Отклонено", False)
            ):
                return jsonify({
                    "success": False,
                    "error": "Задание уже не находится в списке отклонённых."
                }), 400

            updates = [
                {
                    "range": gspread.utils.rowcol_to_a1(
                        row_number,
                        headers.index("Сдано") + 1
                    ),
                    "values": [["FALSE"]]
                },
                {
                    "range": gspread.utils.rowcol_to_a1(
                        row_number,
                        headers.index("Отклонено") + 1
                    ),
                    "values": [["FALSE"]]
                },
                {
                    "range": gspread.utils.rowcol_to_a1(
                        row_number,
                        headers.index("Ссылка на задание") + 1
                    ),
                    "values": [[""]]
                },
                {
                    "range": gspread.utils.rowcol_to_a1(
                        row_number,
                        headers.index("Дата сдачи") + 1
                    ),
                    "values": [[""]]
                }
            ]

            # Дополнительно сбрасываем «Принято», если столбец существует.
            if "Принято" in headers:
                updates.append({
                    "range": gspread.utils.rowcol_to_a1(
                        row_number,
                        headers.index("Принято") + 1
                    ),
                    "values": [["FALSE"]]
                })

            worksheet.batch_update(
                updates,
                value_input_option="USER_ENTERED"
            )

            return jsonify({
                "success": True,
                "player_id": player_id,
                "cell_id": cell_id
            })

        return jsonify({
            "success": False,
            "error": "Задание не найдено."
        }), 404

    except ValueError as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 400

    except Exception:
        current_app.logger.exception(
            "Ошибка возврата отклонённого задания"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось вернуть задание на выполнение."
        }), 500

# --------------------------------
# МАСТЕРСКИЙ ПРОФИЛЬ
# --------------------------------

@master_bp.route("/master")
def master():

    if not is_master_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    return render_template("master.html")


# --------------------------------
# ПОЛУЧЕНИЕ СПИСКА ИГРОКОВ
# --------------------------------

@master_bp.route("/api/players")
def get_players():

    if not is_master_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    try:

        players = load_master_players(
            session["player_id"]
        )

        return jsonify({
            "success": True,
            "count": len(players),
            "players": players
        })

    except Exception:

        current_app.logger.exception(
            "Ошибка получения списка игроков"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить список игроков."
        }), 500


# --------------------------------
# ПОЛУЧЕНИЕ СПИСКА ВСЕХ ЗАДАНИЙ
# --------------------------------

@master_bp.route("/api/tasks")
def get_tasks():

    if not is_master_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    try:

        cells = initialize_cells_cache()

        tasks = []

        for cell in cells:

            task_text = str(
                cell.get("task", "")
            ).strip()

            if not task_text:
                continue

            tasks.append({
                "cell_id": cell["cell_id"],
                "task": task_text
            })

        return jsonify({
            "success": True,
            "count": len(tasks),
            "tasks": tasks
        })

    except Exception:

        current_app.logger.exception(
            "Ошибка получения списка заданий"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить список заданий."
        }), 500


# --------------------------------
# ПОЛУЧЕНИЕ ДАННЫХ ОДНОЙ КЛЕТКИ
# --------------------------------

@master_bp.route("/api/cells/<int:column>/<int:row>")
def get_cell(column, row):

    if not is_master_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    if not (1 <= column <= 30 and 1 <= row <= 20):

        return jsonify({
            "success": False,
            "error": "Некорректные координаты клетки."
        }), 400

    try:

        cell = find_cell_by_coordinates(column, row)

        if cell is None:

            return jsonify({
                "success": False,
                "error": "Клетка не найдена."
            }), 404

        return jsonify({
            "success": True,
            "cell": cell
        })

    except Exception:

        current_app.logger.exception(
            f"Ошибка получения клетки: столбец {column}, строка {row}"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить данные клетки."
        }), 500


# --------------------------------
# СТАРЫЙ API ВСЕХ КЛЕТОК
# ОСТАВЛЕН ДЛЯ СОВМЕСТИМОСТИ
# --------------------------------

@master_bp.route("/api/cells")
def get_cells():

    if not is_master_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    try:

        cells = initialize_cells_cache()

        return jsonify({
            "success": True,
            "count": len(cells),
            "cells": cells
        })

    except Exception as error:

        current_app.logger.exception(
            "Ошибка получения данных клеток"
        )

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500
