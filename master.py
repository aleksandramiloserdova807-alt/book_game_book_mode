
import time

from threading import Lock

from flask import (
    Blueprint,
    render_template,
    jsonify,
    session,
    current_app
)

from google_sheets import (
    load_cells,
    load_master_players
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
