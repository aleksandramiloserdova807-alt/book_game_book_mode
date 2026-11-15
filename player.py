import time

from flask import (
    Blueprint,
    render_template,
    jsonify,
    session,
    redirect,
    url_for,
    current_app,
    request
)

from google_sheets import (
    load_cells,
    load_player_masters,
    load_player_tasks,
    load_player_color,
    save_player_color,
    load_player_path,
    move_player_to_cell,
    select_player_start_cell,
    submit_player_task,
    PLAYER_COLORS
)


player_bp = Blueprint("player", __name__)


# --------------------------------
# ПРОВЕРКА АВТОРИЗАЦИИ УЧАСТНИКА
# --------------------------------

def is_player_logged_in():

    return (
        session.get("player_id") is not None
        and session.get("is_master") is False
    )


# --------------------------------
# ПРОФИЛЬ УЧАСТНИКА
# --------------------------------

@player_bp.route("/player")
def player_page():

    if not is_player_logged_in():
        return redirect(url_for("index"))

    return render_template("player.html")


# --------------------------------
# ПОЛУЧЕНИЕ ЦВЕТА УЧАСТНИКА
# --------------------------------

@player_bp.route("/api/player/color", methods=["GET"])
def get_player_color():

    if not is_player_logged_in():
        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    started = time.perf_counter()

    try:
        color = load_player_color(session["player_id"])

        elapsed = (time.perf_counter() - started) * 1000

        current_app.logger.info(
            "Загрузка цвета игрока: %.0f мс",
            elapsed
        )

        return jsonify({
            "success": True,
            "color": color
        })

    except Exception:
        current_app.logger.exception(
            "Ошибка получения цвета участника"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось получить цвет игрока."
        }), 500


# --------------------------------
# СОХРАНЕНИЕ ЦВЕТА УЧАСТНИКА
# --------------------------------

@player_bp.route("/api/player/color", methods=["POST"])
def update_player_color():

    if not is_player_logged_in():
        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    data = request.get_json(silent=True) or {}

    color = str(data.get("color", "")).strip().upper()

    if color not in PLAYER_COLORS:
        return jsonify({
            "success": False,
            "error": "Выбран недопустимый цвет."
        }), 400

    try:

        saved_color = save_player_color(
            session["player_id"],
            color
        )

        return jsonify({
            "success": True,
            "color": saved_color
        })

    except Exception:

        current_app.logger.exception(
            "Ошибка сохранения цвета участника"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось сохранить цвет."
        }), 500


# --------------------------------
# ПОЛУЧЕНИЕ СПИСКА МАСТЕРОВ
# --------------------------------

@player_bp.route("/api/player/masters")
def get_player_masters():

    if not is_player_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    try:

        masters = load_player_masters()

        return jsonify({
            "success": True,
            "count": len(masters),
            "masters": masters
        })

    except Exception:

        current_app.logger.exception(
            "Ошибка получения списка мастеров"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить список мастеров."
        }), 500


# --------------------------------
# ПОЛУЧЕНИЕ ЛИЧНЫХ ЗАДАНИЙ
# --------------------------------

@player_bp.route("/api/player/tasks")
def get_player_tasks():

    if not is_player_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    try:

        tasks = load_player_tasks(
            session["player_id"]
        )

        return jsonify({
            "success": True,
            "count": len(tasks),
            "tasks": tasks
        })

    except Exception:

        current_app.logger.exception(
            "Ошибка получения личных заданий"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить задания."
        }), 500


# --------------------------------
# ПОЛУЧЕНИЕ КАРТЫ БЕЗ ЗАДАНИЙ КЛЕТОК
# --------------------------------

@player_bp.route("/api/player/cells")
def get_player_cells():

    if not is_player_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    try:

        cells = load_cells()

        public_cells = [
            {
                "cell_id": cell["cell_id"],
                "column": cell["column"],
                "row": cell["row"]
            }
            for cell in cells
        ]

        return jsonify({
            "success": True,
            "count": len(public_cells),
            "cells": public_cells
        })

    except Exception:

        current_app.logger.exception(
            "Ошибка получения карты участника"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить карту."
        }), 500


# --------------------------------
# ПОЛУЧЕНИЕ МАРШРУТА ИГРОКА
# --------------------------------

@player_bp.route("/api/player/path", methods=["GET"])
def get_player_path():

    if not is_player_logged_in():
        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    started = time.perf_counter()

    try:
        player_path = load_player_path(
            session["player_id"]
        )

        elapsed = (time.perf_counter() - started) * 1000

        current_app.logger.info(
            "Загрузка маршрута игрока: %.0f мс",
            elapsed
        )

        return jsonify({
            "success": True,
            "path": player_path["path"],
            "current_cell_id": player_path["current_cell_id"],
            "visited_cells": player_path["visited_cells"]
        })

    except Exception:
        current_app.logger.exception(
            "Ошибка получения маршрута игрока"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить маршрут."
        }), 500


# --------------------------------
# ВЫБОР СТАРТОВОЙ КЛЕТКИ
# --------------------------------

@player_bp.route("/api/player/select-cell", methods=["POST"])
def select_cell():

    if not is_player_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    data = request.get_json(silent=True) or {}

    cell_id = str(
        data.get("cell_id", "")
    ).strip()

    if not cell_id:

        return jsonify({
            "success": False,
            "error": "Не указана клетка."
        }), 400

    try:

        result = select_player_start_cell(
            session["player_id"],
            cell_id
        )

        return jsonify(result)

    except ValueError as error:

        return jsonify({
            "success": False,
            "error": str(error)
        }), 400

    except Exception:

        current_app.logger.exception(
            "Ошибка выбора стартовой клетки"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось выбрать стартовую клетку."
        }), 500


# --------------------------------
# ОТПРАВКА ЗАДАНИЯ
# --------------------------------

@player_bp.route("/api/player/submit-task", methods=["POST"])
def submit_task():

    if not is_player_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    data = request.get_json(silent=True) or {}

    cell_id = str(
        data.get("cell_id", "")
    ).strip()

    task_url = str(
        data.get("task_url", "")
    ).strip()

    if not cell_id:

        return jsonify({
            "success": False,
            "error": "Не указана клетка."
        }), 400

    if not task_url:

        return jsonify({
            "success": False,
            "error": "Не указана ссылка на задание."
        }), 400

    try:

        result = submit_player_task(
            session["player_id"],
            cell_id,
            task_url
        )

        return jsonify(result)

    except ValueError as error:

        return jsonify({
            "success": False,
            "error": str(error)
        }), 400

    except Exception:

        current_app.logger.exception(
            "Ошибка отправки задания"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось отправить задание."
        }), 500


# --------------------------------
# ПЕРЕХОД ИГРОКА НА СОСЕДНЮЮ КЛЕТКУ
# --------------------------------

@player_bp.route("/api/player/move", methods=["POST"])
def move_player():

    if not is_player_logged_in():

        return jsonify({
            "success": False,
            "error": "Требуется авторизация."
        }), 401

    data = request.get_json(silent=True) or {}

    target_cell_id = str(
        data.get("cell_id", "")
    ).strip()

    if not target_cell_id:

        return jsonify({
            "success": False,
            "error": "Не указана клетка."
        }), 400

    try:

        result = move_player_to_cell(
            session["player_id"],
            target_cell_id
        )

        return jsonify(result)

    except ValueError as error:

        return jsonify({
            "success": False,
            "error": str(error)
        }), 400

    except Exception:

        current_app.logger.exception(
            "Ошибка перехода игрока на клетку"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось выполнить переход."
        }), 500
