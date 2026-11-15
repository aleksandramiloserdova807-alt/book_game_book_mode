import os
import time
import requests

from datetime import datetime
from pathlib import Path
from functools import lru_cache

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

            # Тайм-аут: 10 секунд на подключение, 30 секунд на ответ
            client.set_timeout((10, 30))

            return client.open_by_key(SPREADSHEET_ID)

        except Exception as error:

            last_error = error

            print(
                f"Ошибка подключения к Google Sheets "
                f"(попытка {attempt}/{CONNECTION_ATTEMPTS}): {error}"
            )

            if attempt < CONNECTION_ATTEMPTS:
                time.sleep(CONNECTION_RETRY_DELAY * attempt)

    raise last_error

# --------------------------------
# ЧТЕНИЕ GOOGLE SHEETS С ПОВТОРАМИ
# --------------------------------

def get_all_records_with_retry(worksheet):

    last_error = None

    for attempt in range(1, CONNECTION_ATTEMPTS + 1):

        try:

            return worksheet.get_all_records()

        except requests.exceptions.RequestException as error:

            last_error = error

            print(
                f"Ошибка чтения листа «{worksheet.title}» "
                f"(попытка {attempt}/{CONNECTION_ATTEMPTS}): {error}"
            )

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
       "tasks": spreadsheet.worksheet("Задания"),
       "paths": spreadsheet.worksheet("Пути")
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
# ПОИСК ПЕРВОЙ СВОБОДНОЙ СТРОКИ
# --------------------------------

def find_first_free_row(worksheet, required_empty_headers):

    values = worksheet.get_all_values()

    if not values:
        raise ValueError(
            f"Лист «{worksheet.title}» не содержит заголовков."
        )

    headers = values[0]

    columns = {}

    for header in required_empty_headers:

        if header not in headers:
            raise ValueError(
                f"В листе «{worksheet.title}» "
                f"отсутствует столбец «{header}»."
            )

        columns[header] = headers.index(header)

    # Ищем первую строку, в которой все ключевые поля пусты.
    # Значения FALSE в других столбцах не учитываются.

    for row_number, row in enumerate(values[1:], start=2):

        is_free = True

        for header, column_index in columns.items():

            value = (
                row[column_index]
                if column_index < len(row)
                else ""
            )

            if str(value).strip():
                is_free = False
                break

        if is_free:
            return row_number

    # Если свободной строки среди существующих записей нет,
    # используем следующую после последней строки с данными.

    return len(values) + 1


# --------------------------------
# ПОИСК МАСТЕРА ПО ЛОГИНУ И ПАРОЛЮ
# --------------------------------

def find_master_by_credentials(login, password):

    worksheets = get_worksheets()
    worksheet = worksheets["players"]

    records = get_all_records_with_retry(worksheet)

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

    submitted_counts = {}
    rejected_counts = {}

    for task in task_records:

        player_id = normalize_player_id(
            task.get("Player_ID", "")
        )

        if not player_id:
            continue

        is_submitted = is_true_flag(
            task.get("Сдано", False)
        )

        is_rejected = is_true_flag(
            task.get("Отклонено", False)
        )

        if is_submitted:

            submitted_counts[player_id] = (
                submitted_counts.get(player_id, 0) + 1
            )

        if is_rejected:

            rejected_counts[player_id] = (
                rejected_counts.get(player_id, 0) + 1
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
            "accepted_count": submitted_counts.get(player_id, 0),
            "pending_count": rejected_counts.get(player_id, 0)
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


# --------------------------------
# ЗАГРУЗКА СПИСКА МАСТЕРОВ
# --------------------------------

def load_player_masters():

    worksheets = get_worksheets()

    records = worksheets["players"].get_all_records()

    masters = []

    for record in records:

        if not is_master_flag(record.get("Мастер", False)):
            continue

        player_id = normalize_player_id(
            record.get("Player_ID", "")
        )

        if not player_id:
            continue

        name = str(
            record.get("Имя игрока", "")
        ).strip()

        if not name:
            name = f"Мастер {player_id}"

        masters.append({
            "player_id": player_id,
            "name": name,
            "color": str(
                record.get("Цвет игрока", "")
            ).strip() or "#ffffff"
        })

    return masters


# --------------------------------
# ЗАГРУЗКА ЛИЧНЫХ ЗАДАНИЙ УЧАСТНИКА
# --------------------------------

def load_player_tasks(player_id):

    worksheets = get_worksheets()

    player_id = normalize_player_id(player_id)

    # Получаем текущий маршрут игрока из листа «Пути»

    player_path = load_player_path(player_id)

    path = player_path["path"]

    if not path:
        return []

    # Cell_ID в порядке прохождения маршрута

    route_cell_ids = [
        str(item["cell_id"]).strip()
        for item in path
        if str(item["cell_id"]).strip()
    ]

    # Загружаем задания и тексты клеток

    task_records = worksheets["tasks"].get_all_records()
    cell_records = worksheets["cells"].get_all_records()

    # Создаём словарь текстов заданий по Cell_ID

    cell_tasks = {}

    for record in cell_records:

        cell_id = normalize_player_id(
            record.get("Cell_ID", "")
        )

        if cell_id:
            cell_tasks[cell_id] = str(
                record.get("Задание", "")
            ).strip()

    # Создаём словарь записей заданий игрока

    player_tasks = {}

    for record in task_records:

        task_player_id = normalize_player_id(
            record.get("Player_ID", "")
        )

        if task_player_id != player_id:
            continue

        cell_id = normalize_player_id(
            record.get("Cell_ID", "")
        )

        if cell_id:
            player_tasks[cell_id] = record

    # Формируем список строго по маршруту из листа «Пути»

    tasks = []

    for cell_id in route_cell_ids:

        record = player_tasks.get(cell_id)

        if record is None:
            continue

        task_url = str(
            record.get("Ссылка на задание", "")
        ).strip()

        accepted_date = str(
            record.get("Дата принятия", "")
        ).strip()

        submitted_date = str(
            record.get("Дата сдачи", "")
        ).strip()

        is_submitted = is_true_flag(
            record.get("Сдано", False)
        )

        is_accepted = is_true_flag(
            record.get("Принято", False)
        )

        is_rejected = is_true_flag(record.get("Отклонено", False))

        if is_rejected:
           status = "Отклонено"

        elif is_submitted and is_accepted:
            status = "Выполнено"
        
        elif is_submitted:
            status = "Ожидает проверки"
            
        else:
            status = "В работе"

        tasks.append({
            "cell_id": cell_id,
            "task_text": cell_tasks.get(cell_id, ""),
            "task_url": task_url,
            "accepted_date": accepted_date,
            "submitted_date": submitted_date,
            "submitted": is_submitted,
            "accepted": is_accepted,
            "rejected": is_rejected,
            "status": status
        })

    return tasks




# --------------------------------
# ПОИСК ИГРОКА ПО ЛОГИНУ И ПАРОЛЮ
# --------------------------------

def find_player_by_credentials(login, password):

    worksheets = get_worksheets()
    records = worksheets["players"].get_all_records()

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
            and not is_master_flag(record.get("Мастер", False))
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
# ПАЛИТРА ЦВЕТОВ ИГРОКА
# --------------------------------

PLAYER_COLORS = [
    "#F44336", "#E91E63", "#9C27B0", "#673AB7",
    "#3F51B5", "#2196F3", "#03A9F4", "#00BCD4",
    "#009688", "#4CAF50", "#8BC34A", "#CDDC39",
    "#FFEB3B", "#FFC107", "#FF9800", "#FF5722",
    "#795548", "#9E9E9E", "#607D8B", "#263238",
    "#B71C1C", "#880E4F", "#4A148C", "#311B92",
    "#1A237E", "#0D47A1", "#01579B", "#006064",
    "#004D40", "#1B5E20", "#33691E", "#827717",
    "#F9A825", "#E65100", "#BF360C", "#455A64"
]


# --------------------------------
# ПОЛУЧЕНИЕ ЦВЕТА ИГРОКА
# --------------------------------


def load_player_color(player_id):

    worksheet = get_worksheets()["players"]

    normalized_id = normalize_player_id(player_id)

    records = worksheet.get_all_records()

    for record in records:

        record_player_id = normalize_player_id(
            record.get("Player_ID", "")
        )

        if record_player_id == normalized_id:

            return str(
                record.get("Цвет игрока", "") or ""
            ).strip()

    raise ValueError(
        f"Игрок с Player_ID {normalized_id} не найден."
    )



# --------------------------------
# СОХРАНЕНИЕ ЦВЕТА ИГРОКА
# --------------------------------

def save_player_color(player_id, color):

    color = str(color).strip().upper()

    if color not in PLAYER_COLORS:
        raise ValueError("Недопустимый цвет.")

    worksheet = get_worksheets()["players"]

    headers = worksheet.row_values(1)

    try:
        player_id_column = headers.index("Player_ID") + 1
        color_column = headers.index("Цвет игрока") + 1
    except ValueError:
        raise ValueError(
            "В листе «Игроки» отсутствует столбец Player_ID "
            "или Цвет игрока."
        )

    player_ids = worksheet.col_values(player_id_column)

    normalized_id = normalize_player_id(player_id)

    for row_number, value in enumerate(player_ids[1:], start=2):

        if normalize_player_id(value) == normalized_id:

            worksheet.update_cell(
                row_number,
                color_column,
                color
            )

            return color

    raise ValueError(
        f"Игрок с Player_ID {normalized_id} не найден."
    )


# --------------------------------
# ЗАГРУЗКА МАРШРУТА ИГРОКА
# --------------------------------

def load_player_path(player_id):

    worksheet = get_worksheets()["paths"]

    records = worksheet.get_all_records()

    player_id = normalize_player_id(player_id)

    path = []

    for record in records:

        record_player_id = normalize_player_id(
            record.get("Player_ID", "")
        )

        if record_player_id != player_id:
            continue

        path.append({
            "order": int(record.get("Порядок", 0)),
            "cell_id": str(record.get("Cell_ID", "")).strip(),
            "date": str(record.get("Дата перехода", "")).strip()
        })

    path.sort(key=lambda item: item["order"])

    current_cell_id = (
        path[-1]["cell_id"] if path else None
    )

    return {
        "path": path,
        "current_cell_id": current_cell_id,
        "visited_cells": [
            item["cell_id"] for item in path
        ]
    }


# --------------------------------
# ПРОВЕРКА СОСЕДСТВА КЛЕТОК
# --------------------------------

def are_cells_neighbors(current_cell, target_cell):

    current_column = int(current_cell["column"])
    current_row = int(current_cell["row"])

    target_column = int(target_cell["column"])
    target_row = int(target_cell["row"])

    row_difference = target_row - current_row
    column_difference = target_column - current_column

    # Соседство в пределах одной строки

    if row_difference == 0:
        return abs(column_difference) == 1

    # Соседство по диагонали

    if abs(row_difference) != 1:
        return False

    # Нечётная строка (нумерация с 1):
    # соседние строки имеют клетки с колонками c и c-1.

    if current_row % 2 == 1:
        return column_difference in (0, -1)

    # Чётная строка:
    # соседние строки имеют клетки с колонками c и c+1.

    return column_difference in (0, 1)


# --------------------------------
# ПЕРЕХОД ИГРОКА НА НОВУЮ КЛЕТКУ
# --------------------------------


# --------------------------------
# ЗАПИСЬ ТОЧКИ В МАРШРУТ ИГРОКА
# --------------------------------

def append_player_path_point(player_id, cell_id):

    worksheet = get_worksheets()["paths"]
    headers = worksheet.row_values(1)

    required_headers = [
        "Player_ID",
        "Порядок",
        "Cell_ID",
        "Дата перехода"
    ]

    for header in required_headers:
        if header not in headers:
            raise ValueError(
                f"В листе «Пути» отсутствует столбец «{header}»."
            )

    player_path = load_player_path(player_id)
    next_order = len(player_path["path"]) + 1

    transition_date = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    row_data = {
        "Player_ID": player_id,
        "Порядок": next_order,
        "Cell_ID": cell_id,
        "Дата перехода": transition_date
    }

    row = [
        row_data.get(header, "")
        for header in headers
    ]

    # Находим первую свободную строку по ключевым полям.
    target_row = find_first_free_row(
        worksheet,
        ["Player_ID", "Cell_ID"]
    )

    # Записываем данные непосредственно в найденную строку.
    worksheet.update(
        f"A{target_row}",
        [row],
        value_input_option="USER_ENTERED"
    )

    return {
        "order": next_order,
        "date": transition_date
    }


# --------------------------------
# ВЫБОР ПЕРВОЙ КЛЕТКИ ИГРОКОМ
# --------------------------------

def select_player_start_cell(player_id, cell_id):

    player_id = normalize_player_id(player_id)
    cell_id = str(cell_id).strip()

    if not player_id:
        raise ValueError("Не указан Player_ID.")

    if not cell_id:
        raise ValueError("Не указана клетка.")

    player_path = load_player_path(player_id)

    if player_path["current_cell_id"] is not None:
        raise ValueError(
            "Стартовая клетка уже выбрана."
        )

    cells = load_cells()

    target_cell = next(
        (
            cell for cell in cells
            if str(cell["cell_id"]).strip() == cell_id
        ),
        None
    )

    if target_cell is None:
        raise ValueError("Выбранная клетка не найдена.")

    # Создаём задание для стартовой клетки

    task = create_player_task(player_id, cell_id)

    # Записываем стартовую точку в маршрут

    path_point = append_player_path_point(
        player_id,
        cell_id
    )

    return {
        "success": True,
        "cell_id": cell_id,
        "task": task["task"],
        "path_order": path_point["order"],
        "path_date": path_point["date"]
    }


# --------------------------------
# ПЕРЕХОД ИГРОКА НА НОВУЮ КЛЕТКУ
# --------------------------------

def move_player_to_cell(player_id, target_cell_id):

    player_id = normalize_player_id(player_id)
    target_cell_id = str(target_cell_id).strip()

    if not player_id:
        raise ValueError("Не указан Player_ID.")

    if not target_cell_id:
        raise ValueError("Не указана клетка.")

    # Получаем текущий маршрут

    player_path = load_player_path(player_id)

    current_cell_id = player_path["current_cell_id"]

    if current_cell_id is None:
        raise ValueError(
            "Сначала выберите стартовую клетку."
        )

    # Проверяем, отправлено ли задание текущей клетки

    task_records = get_worksheets()["tasks"].get_all_records()

    current_task = None

    for record in task_records:

        record_player_id = normalize_player_id(
            record.get("Player_ID", "")
        )

        record_cell_id = str(
            record.get("Cell_ID", "")
        ).strip()

        if (
            record_player_id == player_id
            and record_cell_id == current_cell_id
        ):
            current_task = record
            break

    if current_task is None:
        raise ValueError(
            "Для текущей клетки не найдено задание."
        )

    if not is_true_flag(current_task.get("Сдано", False)):
        raise ValueError(
            "Сначала отправьте задание текущей клетки."
        )

    # Запрещаем повторное посещение

    if target_cell_id in player_path["visited_cells"]:
        raise ValueError(
            "Эта клетка уже была посещена."
        )

    # Находим текущую и выбранную клетки

    cells = load_cells()

    current_cell = None
    target_cell = None

    for cell in cells:

        cell_id = str(cell["cell_id"]).strip()

        if cell_id == current_cell_id:
            current_cell = cell

        if cell_id == target_cell_id:
            target_cell = cell

    if current_cell is None:
        raise ValueError(
            "Текущая клетка игрока не найдена."
        )

    if target_cell is None:
        raise ValueError(
            "Выбранная клетка не найдена."
        )

    # Проверяем соседство

    if not are_cells_neighbors(current_cell, target_cell):
        raise ValueError(
            "Можно переходить только на соседнюю клетку."
        )

    # Записываем переход в лист «Пути»

    path_point = append_player_path_point(
        player_id,
        target_cell_id
    )

    # Создаём новое задание для выбранной клетки

    task = create_player_task(
        player_id,
        target_cell_id
    )

    return {
        "success": True,
        "player_id": player_id,
        "cell_id": target_cell_id,
        "order": path_point["order"],
        "date": path_point["date"],
        "task": task["task"]
    }


# --------------------------------
# ПОЛУЧЕНИЕ ЗАДАНИЯ ПО CELL_ID
# --------------------------------

def load_cell_task(cell_id):

    worksheet = get_worksheets()["cells"]
    records = worksheet.get_all_records()

    target_cell_id = str(cell_id).strip()

    for record in records:

        record_cell_id = str(
            record.get("Cell_ID", "")
        ).strip()

        if record_cell_id == target_cell_id:

            task_text = str(
                record.get("Задание", "")
            ).strip()

            if not task_text:
                raise ValueError(
                    f"Для клетки {target_cell_id} не задан текст задания."
                )

            return task_text

    raise ValueError(
        f"Клетка {target_cell_id} не найдена."
    )


# --------------------------------
# СОЗДАНИЕ ЗАДАНИЯ ИГРОКУ ПРИ ВЫБОРЕ КЛЕТКИ
# --------------------------------

def create_player_task(player_id, cell_id):

    player_id = normalize_player_id(player_id)
    cell_id = str(cell_id).strip()

    if not player_id:
        raise ValueError("Не указан Player_ID.")

    if not cell_id:
        raise ValueError("Не указан Cell_ID.")

    # Получаем текст задания из листа «Клетки»

    task_text = load_cell_task(cell_id)

    worksheet = get_worksheets()["tasks"]

    headers = worksheet.row_values(1)

    required_headers = [
        "Player_ID",
        "Cell_ID",
        "Ссылка на задание",
        "Дата принятия",
        "Дата сдачи",
        "Сдано",
        "Принято"
    ]

    for header in required_headers:

        if header not in headers:
            raise ValueError(
                f"В листе «Задания» отсутствует столбец «{header}»."
            )

    records = worksheet.get_all_records()

    # Проверяем, не создавалось ли уже такое задание

    for row_number, record in enumerate(records, start=2):

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

            is_submitted = is_true_flag(
                record.get("Сдано", False)
            )

            if is_submitted:
                raise ValueError(
                    "Задание по этой клетке уже отправлено."
                )

            return {
                "success": True,
                "player_id": player_id,
                "cell_id": cell_id,
                "task": task_text,
                "row": row_number
            }

    # Создаём новую запись

    row_data = {
        "Player_ID": player_id,
        "Cell_ID": cell_id,
        "Ссылка на задание": "",
        "Дата принятия": "",
        "Дата сдачи": "",
        "Сдано": "FALSE",
        "Принято": "FALSE"
    }

    row = [
        row_data.get(header, "")
        for header in headers
    ]

    # Ищем свободную строку по Player_ID и Cell_ID.
    # FALSE в служебных столбцах не мешают поиску.

    target_row = find_first_free_row(
        worksheet,
        ["Player_ID", "Cell_ID"]
    )

    worksheet.update(
        f"A{target_row}",
        [row],
        value_input_option="USER_ENTERED"
    )

    return {
        "success": True,
        "player_id": player_id,
        "cell_id": cell_id,
        "task": task_text,
        "row": target_row
    }


# --------------------------------
# ОТПРАВКА ССЫЛКИ НА ЗАДАНИЕ
# --------------------------------


def submit_player_task(player_id, cell_id, task_url):

    player_id = normalize_player_id(player_id)
    cell_id = str(cell_id).strip()
    task_url = str(task_url).strip()

    if not player_id:
        raise ValueError("Не указан Player_ID.")

    if not cell_id:
        raise ValueError("Не указан Cell_ID.")

    if not task_url:
        raise ValueError("Не указана ссылка на задание.")

    worksheet = get_worksheets()["tasks"]
    headers = worksheet.row_values(1)

    required_headers = [
        "Player_ID",
        "Cell_ID",
        "Ссылка на задание",
        "Дата сдачи",
        "Сдано",
        "Отклонено"
        ]

    for header in required_headers:
        if header not in headers:
            raise ValueError(
                f"В листе «Задания» отсутствует столбец «{header}»."
            )

    records = worksheet.get_all_records()

    for row_number, record in enumerate(records, start=2):

        record_player_id = normalize_player_id(
            record.get("Player_ID", "")
        )

        record_cell_id = str(
            record.get("Cell_ID", "")
        ).strip()

        if (
            record_player_id == player_id
            and record_cell_id == cell_id
        ):

            if is_true_flag(record.get("Сдано", False)):
                raise ValueError(
                    "Это задание уже отправлено на проверку."
                )

            submitted_date = datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            )

            url_column = headers.index("Ссылка на задание") + 1
            date_column = headers.index("Дата сдачи") + 1
            submitted_column = headers.index("Сдано") + 1
            rejected_column = headers.index("Отклонено") + 1

            worksheet.batch_update(
                [
                    {
                        "range": gspread.utils.rowcol_to_a1(
                            row_number, url_column
                        ),
                        "values": [[task_url]]
                    },
                    {
                        "range": gspread.utils.rowcol_to_a1(
                            row_number, date_column
                        ),
                        "values": [[submitted_date]]
                    },
                    {
                        "range": gspread.utils.rowcol_to_a1(
                            row_number, submitted_column
                        ),
                        "values": [["TRUE"]]
                    },
                    {
                        "range": gspread.utils.rowcol_to_a1(
                            row_number, rejected_column
                            ),
                        "values": [["FALSE"]]
                    }
                ],
                value_input_option="USER_ENTERED"
            )

            return {
                "success": True,
                "player_id": player_id,
                "cell_id": cell_id,
                "task_url": task_url,
                "submitted_date": submitted_date,
                "status": "Ожидает проверки"
            }

    raise ValueError(
        "Задание для этой клетки не найдено. Сначала выберите клетку."
    )

