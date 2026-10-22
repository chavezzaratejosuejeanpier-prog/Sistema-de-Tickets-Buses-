import io
from datetime import date, datetime

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ANCHO, ALTO = A4

TINTA = HexColor("#0F172A")
ACENTO = HexColor("#F97316")
GRIS = HexColor("#64748B")
SUAVE = HexColor("#94A3B8")
LINEA = HexColor("#E2E8F0")
BLANCO = HexColor("#FFFFFF")

M = 18 * mm
ALTO_CABECERA = 100

TW = 200
TX = (ANCHO - TW) / 2
MONO = "Courier"
MONO_NEGRITA = "Courier-Bold"


def _txt(c, x, y, texto, size=9, color=TINTA, font="Helvetica", derecha=False):
    c.setFont(font, size)
    c.setFillColor(color)
    if derecha:
        c.drawRightString(x, y, texto)
    else:
        c.drawString(x, y, texto)


def _dato(c, x, y, etiqueta, valor, size=10):
    _txt(c, x, y + 5 * mm, etiqueta.upper(), 6.5, GRIS, "Helvetica-Bold")
    _txt(c, x, y, str(valor), size, TINTA, "Helvetica-Bold")


def _mono(c, x, y, texto, size=9, font=MONO, centrado=False):
    c.setFont(font, size)
    c.setFillColor(TINTA)
    if centrado:
        c.drawCentredString(x, y, texto)
    else:
        c.drawString(x, y, texto)


def _fecha(dt):
    if isinstance(dt, (datetime, date)):
        return dt.strftime("%d/%m/%Y")
    return str(dt or "-")


def _recorta(texto, maximo=24):
    texto = str(texto or "")
    return texto if len(texto) <= maximo else texto[: maximo - 3] + "..."


def _nombre(t):
    apellidos = " ".join(
        p for p in ((t.get("apellido_paterno") or "").strip(), (t.get("apellido_materno") or "").strip()) if p
    )
    nombres = (t.get("nombres") or "").strip()
    if apellidos and nombres:
        return f"{apellidos}, {nombres}"
    return nombres or apellidos or t.get("pasajero_nombre") or "Pasajero"


def _envuelve(texto, maximo):
    lineas, actual = [], ""
    for palabra in str(texto).split():
        if actual and len(actual) + 1 + len(palabra) > maximo:
            lineas.append(actual)
            actual = palabra
        else:
            actual = f"{actual} {palabra}".strip()
    if actual:
        lineas.append(actual)
    return lineas


def _portada(c, datos, tickets):
    codigo = datos.get("codigo") or "-"
    t0 = tickets[0] if tickets else {}

    c.setFillColor(TINTA)
    c.rect(0, ALTO - ALTO_CABECERA, ANCHO, ALTO_CABECERA, stroke=0, fill=1)
    _txt(c, M, ALTO - 46, "LUX", 34, BLANCO, "Helvetica-Bold")
    _txt(c, M, ALTO - 64, "Líneas Únicas Xpress", 9, SUAVE)
    _txt(c, M, ALTO - 82, "COMPROBANTE DE RESERVA", 10, ACENTO, "Helvetica-Bold")
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(BLANCO)
    c.drawRightString(ANCHO - M, ALTO - 52, f"Código: {codigo}")
    if datos.get("email"):
        _txt(c, ANCHO - M, ALTO - 70, f"Comprador: {datos['email']}", 8, SUAVE, derecha=True)

    y = ALTO - ALTO_CABECERA - 22 * mm
    _txt(c, M, y, "VIAJE", 9, ACENTO, "Helvetica-Bold")
    y -= 22
    _txt(c, M, y, f"{t0.get('origen')}  ->  {t0.get('destino')}", 22, TINTA, "Helvetica-Bold")
    y -= 32
    _dato(c, M, y, "Fecha", _fecha(t0.get("fecha_salida")))
    _dato(c, M + 60 * mm, y, "Hora de salida", t0.get("hora_salida") or "-")
    _dato(c, M + 110 * mm, y, "Duración", f"{t0.get('duracion_horas') or 0:g} h")
    y -= 20

    c.setStrokeColor(LINEA)
    c.line(M, y, ANCHO - M, y)
    y -= 18

    _txt(c, M, y, "PASAJES", 9, ACENTO, "Helvetica-Bold")
    y -= 16
    for t in tickets:
        _txt(c, M, y, f"Asiento {t.get('numero_asiento')} (Piso {t.get('piso')})", 10, TINTA, "Helvetica-Bold")
        _txt(c, M + 60 * mm, y, _nombre(t), 10, TINTA)
        _txt(c, ANCHO - M, y, f"S/ {float(t.get('precio_pagado') or 0):.2f}", 10, TINTA, "Helvetica-Bold", derecha=True)
        y -= 8
        c.setStrokeColor(LINEA)
        c.line(M, y, ANCHO - M, y)
        y -= 18

    _txt(c, ANCHO - M, y, "TOTAL PAGADO", 9, GRIS, "Helvetica-Bold", derecha=True)
    _txt(c, ANCHO - M, y - 22, f"S/ {float(datos.get('total') or 0):.2f}", 24, ACENTO, "Helvetica-Bold", derecha=True)


def _ticket(c, t, codigo):
    centro = TX + TW / 2
    numero = t.get("numero_boleto") or f"LUX-{int(t.get('id') or 0):06d}"

    y = ALTO - 40
    _mono(c, centro, y, "LUX E.I.R.L.", 13, MONO_NEGRITA, centrado=True)
    y -= 15
    _mono(c, centro, y, "RUC: 20000000000", 9, MONO, centrado=True)
    y -= 17
    _mono(c, centro, y, "BOLETA DE VIAJE", 11, MONO_NEGRITA, centrado=True)
    y -= 17
    _mono(c, centro, y, numero, 11, MONO_NEGRITA, centrado=True)
    y -= 24

    _mono(c, TX, y, "TIPO PAGO : CONTADO", 9)
    y -= 13
    _mono(c, TX, y, f"EMISION   : {_fecha(datetime.now())}", 9)
    y -= 13
    _mono(c, TX, y, f"PASAJERO  : {_recorta(_nombre(t))}", 9)
    y -= 13
    documento = " ".join(
        p for p in ((t.get("tipo_documento") or "").strip(), (t.get("documento") or "").strip()) if p
    )
    if documento:
        _mono(c, TX, y, f"DOCUMENTO : {_recorta(documento)}", 9)
        y -= 13
    if t.get("sexo"):
        _mono(c, TX, y, f"SEXO      : {_recorta(t.get('sexo'))}", 9)
        y -= 13
    if t.get("fecha_nacimiento"):
        _mono(c, TX, y, f"F. NACIM  : {_fecha(t.get('fecha_nacimiento'))}", 9)
        y -= 13
    if t.get("telefono"):
        _mono(c, TX, y, f"TELEFONO  : {_recorta(t.get('telefono'))}", 9)
        y -= 13
    y -= 8

    _mono(c, TX, y, "-" * 32, 9)
    y -= 13
    _mono(c, centro, y, "DETALLE", 9, MONO_NEGRITA, centrado=True)
    y -= 13
    _mono(c, TX, y, "-" * 32, 9)
    y -= 18

    filas = [
        ("ORIGEN", t.get("origen") or "-"),
        ("DESTINO", t.get("destino") or "-"),
        ("FECHA", _fecha(t.get("fecha_salida"))),
        ("HORA", t.get("hora_salida") or "-"),
        ("ASIENTO", f"{t.get('numero_asiento')} (Piso {t.get('piso')})"),
        ("IMPORTE", f"S/ {float(t.get('precio_pagado') or 0):.2f}"),
    ]
    for etiqueta, valor in filas:
        _mono(c, TX, y, f"{etiqueta:<10}: {valor}", 9)
        y -= 13
    y -= 6

    for linea in _envuelve("Cubierto por póliza de seguros RIMAC N° 0000123456", 34):
        _mono(c, TX, y, linea, 8)
        y -= 11
    y -= 14

    qr = createBarcodeDrawing("QR", value=f"https://lux.com/terminos?reserva={codigo}&ticket={t.get('id') or ''}")
    renderPDF.draw(qr, c, centro - qr.width / 2, y - qr.height)
    y -= qr.height + 12
    _mono(c, centro, y, "Escanea para términos y condiciones", 7, MONO, centrado=True)


def generar_pdf_boletos(datos: dict) -> bytes:
    tickets = datos.get("tickets") or []
    codigo = datos.get("codigo") or "-"
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    _portada(c, datos, tickets)
    c.showPage()
    for t in tickets:
        _ticket(c, t, codigo)
        c.showPage()

    c.save()
    return buf.getvalue()
