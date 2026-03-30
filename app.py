from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def inicio():
    return render_template("inicio.html", active_page="inicio")

@app.route("/analisis")
def analisis():
    return render_template("analisis.html", active_page="analisis")

@app.route("/interpretacion")
def interpretacion():
    return render_template("interpretacion.html", active_page="interpretacion")

@app.route("/acerca")
def acerca():
    return render_template("acerca.html", active_page="acerca")

if __name__ == "__main__":
    app.run(debug=True)