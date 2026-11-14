import os

from pathlib import Path
from functools import lru_cache
import time

import gspread


# --------------------------------
# НАСТРОЙКИ
# --------------------------------

BASE_DIR = Path(__file__).resolve().parent

CREDENTIALS_FILE = Path(
    os.environ.get(
        "GOOGLE_APPLICATION_CREDENTIALS",
        BASE_DIR / "service_account.json"
    )
)

SPREADSHEET_ID = "198xm5KrUsmvhweVEzz_ka487uVrxTMrq2WpEQapCPQk"

MAP_COLUMNS = 30
MAP_ROWS = 20

CONNECTION_ATTEMPTS = 3
CONNECTION_RETRY_DELAY = 2


# --------------------------------
# ПОДКЛЮЧЕНИЕ К GOOGLE SHEETS
# --------------------------------

@lru_cache(maxsize=1)
def connect_to_google_sheets():

    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            f"Не найден файл авторизации: {CREDENTIALS_FILE}"
        )

    last_error = None

    for attempt in range(1, CONNECTION_ATTEMPTS + 1):

        try:

            client = gspread.service_account(
                filename=str(CREDENTIALS_FILE)
            )

            return client.open_by_key(SPREADSHEET_ID)

        except Exception as error:

            last_error = error

            if attempt < CONNECTION_ATTEMPTS:
                time.sleep(CONNECTION_RETRY_DELAY * attempt)

    raise last_error


# --------------------------------
# ПОЛУЧЕНИЕ ЛИСТОВ
# --------------------------------

@lru_cache(maxsize=1)
def get_worksheets():

    spreadsheet = connect_to_google_sheets()

    return {
        "players": spreadsheet.worksheet("Игроки"),
        "cells": spreadsheet.worksheet("Клетки"),
        "game_data": spreadsheet.worksheet("Игровые данные"),
        "tasks": spreadsheet.worksheet("Задания")
    }


# --------------------------------
# ПРОВЕРКА ЛОГИЧЕСКОГО ЗНАЧЕНИЯ
# --------------------------------

def is_true_flag(value):

    if isinstance(value, bool):
        return value

    return str(value).strip().upper() in (
        "TRUE",
        "1",
        "ДА",
        "YES"
    )


# --------------------------------
# ПРОВЕРКА ФЛАГА МАСТЕРА
# --------------------------------

def is_master_flag(value):

    return is_true_flag(value)


# --------------------------------
# НОРМАЛИЗАЦИЯ PLAYER_ID
# --------------------------------

def normalize_player_id(value):

    if value is None:
        return ""

    result = str(value).strip()

    if result.endswith(".0"):
        result = result[:-2]

    return result


# --------------------------------
# ПОИСК МАСТЕРА ПО ЛОГИНУ И ПАРОЛЮ
# --------------------------------

def find_master_by_credentials(login, password):

    worksheets = get_worksheets()
    worksheet = worksheets["players"]

    records = worksheet.get_all_records()

    for record in records:

        player_login = str(
            record.get("Логин", "")
        ).strip()

        player_password = str(
            record.get("Пароль", "")
        )

        if (
            player_login == login
            and player_password == password
            and is_master_flag(record.get("Мастер", False))
        ):

            return {
                "player_id": normalize_player_id(
                    record.get("Player_ID", "")
                ),
                "name": str(
                    record.get("Имя игрока", "")
                ).strip()
            }

    return None


# --------------------------------
# ЗАГРУЗКА СПИСКА ИГРОКОВ ДЛЯ МАСТЕРА
# --------------------------------

def load_master_players(current_player_id):

    worksheets = get_worksheets()

    player_records = worksheets["players"].get_all_records()
    task_records = worksheets["tasks"].get_all_records()

    current_player_id = normalize_player_id(
        current_player_id
    )

    accepted_counts = {}
    pending_counts = {}

    for task in task_records:

        player_id = normalize_player_id(
            task.get("Player_ID", "")
        )

        if not player_id:
            continue

        is_submitted = is_true_flag(
            task.get("Сдано", False)
        )

        is_accepted = is_true_flag(
            task.get("Принято", False)
        )

        if is_submitted and is_accepted:

            accepted_counts[player_id] = (
                accepted_counts.get(player_id, 0) + 1
            )

        elif is_submitted and not is_accepted:

            pending_counts[player_id] = (
                pending_counts.get(player_id, 0) + 1
            )

    players = []

    for record in player_records:

        player_id = normalize_player_id(
            record.get("Player_ID", "")
        )

        if not player_id:
            continue

        if player_id == current_player_id:
            continue

        name = str(
            record.get("Имя игрока", "")
        ).strip()

        if not name:
            name = f"Игрок {player_id}"

        color = str(
            record.get("Цвет игрока", "")
        ).strip()

        is_master = is_master_flag(
            record.get("Мастер", False)
        )

        players.append({
            "player_id": player_id,
            "name": name,
            "is_master": is_master,
            "color": color if color else "#ffffff",
            "accepted_count": accepted_counts.get(player_id, 0),
            "pending_count": pending_counts.get(player_id, 0)
        })

    return players


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
