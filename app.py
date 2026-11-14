
import os
import time

from datetime import timedelta
from threading import Lock

from flask import (
    Flask,
    render_template,
    jsonify,
    request,
    redirect,
    url_for,
    session
)

from google_sheets import (
    load_cells,
    load_master_players,
    find_master_by_credentials
)


app = Flask(__name__)

app.secret_key = os.environ.get(
    "FLASK_SECRET_KEY",
    "local-development-key-change-before-deploy"
)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=(
        os.environ.get("SESSION_COOKIE_SECURE", "false").lower()
        == "true"
    ),
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8)
)


# --------------------------------
# КЭШ КЛЕТОК
# --------------------------------

cells_cache = None
cells_lock = Lock()


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

                app.logger.info(
                    f"Загрузка клеток из Google Sheets. "
                    f"Попытка {attempt}/{attempts}"
                )

                cells = load_cells()

                cells_cache = cells

                app.logger.info(
                    f"Кэш успешно заполнен. Клеток: {len(cells_cache)}"
                )

                return cells_cache

            except Exception:

                app.logger.exception(
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
# ПРОВЕРКА АВТОРИЗАЦИИ
# --------------------------------

def is_master_logged_in():

    return (
        session.get("is_master") is True
        and session.get("player_id") is not None
    )


# --------------------------------
# ГЛАВНАЯ СТРАНИЦА — ВХОД
# --------------------------------

@app.route("/")
def index():

    if is_master_logged_in():
        return redirect(url_for("master"))

    return render_template("index.html")


# --------------------------------
# ОБРАБОТКА ВХОДА
# --------------------------------

@app.route("/login", methods=["POST"])
def login():

    login_value = request.form.get("login", "").strip()
    password_value = request.form.get("password", "")

    if not login_value or not password_value:

        return render_template(
            "index.html",
            error="Введите логин и пароль."
        )

    try:

        player = find_master_by_credentials(
            login_value,
            password_value
        )

    except Exception:

        app.logger.exception(
            "Ошибка проверки данных авторизации"
        )

        return render_template(
            "index.html",
            error="Не удалось проверить данные. Попробуйте позже."
        ), 500

    if player is None:

        return render_template(
            "index.html",
            error="Неверный логин или пароль."
        )

    session.clear()

    session["player_id"] = player["player_id"]
    session["player_name"] = player["name"]
    session["is_master"] = True
    session.permanent = True

    return redirect(url_for("master"))


# --------------------------------
# МАСТЕРСКИЙ РЕЖИМ
# --------------------------------

@app.route("/master")
def master():

    if not is_master_logged_in():
        return redirect(url_for("index"))

    return render_template("master.html")


# --------------------------------
# ВЫХОД ИЗ АККАУНТА
# --------------------------------

@app.route("/logout")
def logout():

    session.clear()

    return redirect(url_for("index"))


# --------------------------------
# ПОЛУЧЕНИЕ СПИСКА ИГРОКОВ
# --------------------------------

@app.route("/api/players")
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

        app.logger.exception(
            "Ошибка получения списка игроков"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить список игроков."
        }), 500


# --------------------------------
# ПОЛУЧЕНИЕ СПИСКА ВСЕХ ЗАДАНИЙ
# --------------------------------

@app.route("/api/tasks")
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

        app.logger.exception(
            "Ошибка получения списка заданий"
        )

        return jsonify({
            "success": False,
            "error": "Не удалось загрузить список заданий."
        }), 500


# --------------------------------
# ПОЛУЧЕНИЕ ДАННЫХ ОДНОЙ КЛЕТКИ
# --------------------------------

@app.route("/api/cells/<int:column>/<int:row>")
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

        app.logger.exception(
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

@app.route("/api/cells")
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

        app.logger.exception(
            "Ошибка получения данных клеток"
        )

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500


# --------------------------------
# ЗАПУСК ПРИЛОЖЕНИЯ
# --------------------------------

if __name__ == "__main__":

    app.run(
        debug=True,
        use_reloader=False
    )
