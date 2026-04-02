from flask import Blueprint, render_template

main = Blueprint("main", __name__)

@main.route("/")
def inicio():
    return render_template("inicio.html", active_page="inicio")

@main.route("/analisis")
def analisis():
    return render_template("analisis.html", active_page="analisis")

@main.route("/interpretacion")
def interpretacion():
    return render_template("interpretacion.html", active_page="interpretacion")

@main.route("/acerca")
def acerca():
    return render_template("acerca.html", active_page="acerca")