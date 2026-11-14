
from pathlib import Path

import gspread


# --------------------------------
# НАСТРОЙКИ
# --------------------------------

BASE_DIR = Path(__file__).resolve().parent

CREDENTIALS_FILE = BASE_DIR / "service_account.json"

SPREADSHEET_ID = "198xm5KrUsmvhweVEzz_ka487uVrxTMrq2WpEQapCPQk"

MAP_COLUMNS = 30
MAP_ROWS = 20


# --------------------------------
# ПОДКЛЮЧЕНИЕ К GOOGLE SHEETS
# --------------------------------

def connect_to_google_sheets():

    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            f"Не найден файл авторизации: {CREDENTIALS_FILE}"
        )

    client = gspread.service_account(
        filename=str(CREDENTIALS_FILE)
    )

    return client.open_by_key(SPREADSHEET_ID)


# --------------------------------
# ПОЛУЧЕНИЕ ЛИСТОВ
# --------------------------------

def get_worksheets():

    spreadsheet = connect_to_google_sheets()

    return {
        "players": spreadsheet.worksheet("Игроки"),
        "cells": spreadsheet.worksheet("Клетки"),
        "game_data": spreadsheet.worksheet("Игровые данные")
    }


# --------------------------------
# ЗАГРУЗКА КЛЕТОК
# --------------------------------

def load_cells():

    worksheets = get_worksheets()
    worksheet = worksheets["cells"]

    records = worksheet.get_all_records()

    cells = []

    for record in records:

        cells.append({
            "cell_id": record["Cell_ID"],
            "column": record["Столбец"],
            "row": record["Строка"],
            "task": record["Задание"]
        })

    if len(cells) != MAP_COLUMNS * MAP_ROWS:
        raise ValueError(
            f"Ожидалось {MAP_COLUMNS * MAP_ROWS} клеток, "
            f"получено {len(cells)}."
        )

    return cells
