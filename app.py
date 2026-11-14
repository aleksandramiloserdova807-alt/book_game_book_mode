
import time
from threading import Lock

from flask import Flask, render_template, jsonify

from google_sheets import load_cells


app = Flask(__name__)


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

        # Проверяем повторно после получения блокировки
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
# ГЛАВНАЯ СТРАНИЦА
# --------------------------------

@app.route("/")
def index():

    return render_template("index.html")


# --------------------------------
# ПОЛУЧЕНИЕ ДАННЫХ КЛЕТОК
# --------------------------------

@app.route("/api/cells")
def get_cells():

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
