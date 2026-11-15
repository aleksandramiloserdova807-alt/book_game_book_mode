
import os

from datetime import timedelta

from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    session
)

from google_sheets import (
    find_master_by_credentials,
    find_player_by_credentials
)

from master import master_bp
from player import player_bp


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
# ПОДКЛЮЧЕНИЕ ПРОФИЛЕЙ
# --------------------------------

app.register_blueprint(master_bp)
app.register_blueprint(player_bp)


# --------------------------------
# ПРОВЕРКА АВТОРИЗАЦИИ
# --------------------------------

def is_logged_in():

    return session.get("player_id") is not None


def get_profile_url():

    if session.get("is_master") is True:
        return url_for("master.master")

    return url_for("player.player_page")


# --------------------------------
# ГЛАВНАЯ СТРАНИЦА — ВХОД
# --------------------------------

@app.route("/")
def index():

    if is_logged_in():
        return redirect(get_profile_url())

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

        is_master = player is not None

        if player is None:

            player = find_player_by_credentials(
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

    if not player["player_id"]:

        return render_template(
            "index.html",
            error="У аккаунта не указан Player_ID."
        )

    session.clear()

    session["player_id"] = player["player_id"]
    session["player_name"] = player["name"]
    session["is_master"] = is_master
    session.permanent = True

    return redirect(get_profile_url())


# --------------------------------
# ВЫХОД ИЗ АККАУНТА
# --------------------------------

@app.route("/logout")
def logout():

    session.clear()

    return redirect(url_for("index"))


# --------------------------------
# ЗАПУСК ПРИЛОЖЕНИЯ
# --------------------------------

if __name__ == "__main__":

    app.run(
        debug=True,
        use_reloader=False
    )
