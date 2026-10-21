"""Generacion del PDF de una reserva: una portada + un boleto por pasajero.

Contrato de `datos`:
{
  "codigo": "BC-A1B2C3D4",
  "email": "correo@dominio.com" | None,
  "total": 283.20,
  "tickets": [{
    "numero_boleto": "LUX-000042",
    "numero_asiento": 12, "piso": 1,
    "pasajero_nombre": "Juan Perez", "pasajero_dni": "76543210",
    "precio_pagado": 141.60,
    "origen": "Lima", "destino": "Cusco",
    "fecha_salida": datetime, "hora_salida": "22:00",
    "duracion_horas": 8.0,
    "bus_placa": "ABC-123", "bus_modelo": "Volvo 9800", "bus_tipo": "PREMIUM",
  }]
}
"""
import io
from datetime import datetime

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

MARCA = "LUX"
LEMA = "Lineas Unicas Xpress"
VIOLETA = HexColor("#7C3AED")
NARANJA = HexColor("#F97316")
GRIS = HexColor("#64748B")
TINTA = HexColor("#0F172A")
LINEA = HexColor("#E2E8F0")

ANCHO, ALTO = A4
M = 18 * mm


def _txt(c, x, y, texto, size=9, color=TINTA, font="Helvetica"):
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x, y, texto)


def _dato(c, x, y, etiqueta, valor, size=10):
    _txt(c, x, y + 5 * mm, etiqueta.upper(), 6.5, GRIS, "Helvetica-Bold")
    _txt(c, x, y, str(valor), size, TINTA, "Helvetica-Bold")


def _fecha(dt):
    if isinstance(dt, datetime):
        return dt.strftime("%d/%m/%Y")
    return str(dt or "-")


def _mascarar_dni(dni):
    digitos = "".join(c for c in str(dni or "") if c.isdigit())
    if not digitos:
        return "-"
    return f"****{digitos[-4:]}" if len(digitos) >= 4 else digitos


def _qr(c, valor, x, y, lado=26 * mm):
    renderPDF.draw(createBarcodeDrawing("QR", value=valor, size=lado), c, x, y)


def _cabecera(c, titulo, derecha=None):
    c.setFillColor(TINTA)
    c.rect(0, ALTO - 32 * mm, ANCHO, 32 * mm, stroke=0, fill=1)
    _txt(c, M, ALTO - 16 * mm, MARCA, 20, HexColor("#FFFFFF"), "Helvetica-Bold")
    _txt(c, M, ALTO - 23 * mm, LEMA, 7.5, HexColor("#94A3B8"))
    _txt(c, M, ALTO - 28 * mm, titulo, 8, NARANJA, "Helvetica-Bold")
    if derecha:
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(HexColor("#FFFFFF"))
        c.drawRightString(ANCHO - M, ALTO - 18 * mm, derecha)


def _pie(c, texto):
    c.setStrokeColor(LINEA)
    c.line(M, 14 * mm, ANCHO - M, 14 * mm)
    _txt(c, M, 9 * mm, texto, 6.5, GRIS)
    _txt(c, ANCHO - M, 9 * mm, "Generado por LUX", 6.5, GRIS)


def _portada(c, datos, tickets):
    codigo = datos.get("codigo") or "-"
    _cabecera(c, "COMPROBANTE DE RESERVA", f"Codigo {codigo}")

    y = ALTO - 48 * mm
    _dato(c, M, y, "Codigo de reserva", codigo, 14)
    if datos.get("email"):
        _dato(c, M + 80 * mm, y, "Comprador", datos["email"])
    y -= 16 * mm

    # Datos del viaje (se toman del primer ticket: todos comparten la ruta)
    t = tickets[0] if tickets else {}
    c.setFillColor(HexColor("#F8FAFC"))
    c.rect(M, y - 34 * mm, ANCHO - 2 * M, 40 * mm, stroke=0, fill=1)
    _txt(c, M + 5 * mm, y - 2 * mm, "VIAJE", 7, VIOLETA, "Helvetica-Bold")
    _txt(c, M + 5 * mm, y - 12 * mm, f"{t.get('origen')}  ->  {t.get('destino')}", 16, TINTA, "Helvetica-Bold")
    _dato(c, M + 5 * mm, y - 26 * mm, "Fecha", _fecha(t.get("fecha_salida")))
    _dato(c, M + 55 * mm, y - 26 * mm, "Hora de salida", t.get("hora_salida") or "-")
    _dato(c, M + 105 * mm, y - 26 * mm, "Duracion", f"{t.get('duracion_horas') or 0:g} h")
    y -= 48 * mm

    _txt(c, M, y, "PASAJES", 7, VIOLETA, "Helvetica-Bold")
    y -= 6 * mm
    for t in tickets:
        _txt(c, M, y, f"Asiento {t.get('numero_asiento')}  (Piso {t.get('piso')})", 10, TINTA, "Helvetica-Bold")
        _txt(c, M + 60 * mm, y, t.get("pasajero_nombre") or "Pasajero", 10, TINTA)
        _txt(c, ANCHO - M, y, f"S/ {float(t.get('precio_pagado') or 0):.2f}", 10, TINTA, "Helvetica-Bold")
        c.setStrokeColor(LINEA)
        c.line(M, y - 3 * mm, ANCHO - M, y - 3 * mm)
        y -= 9 * mm

    y -= 2 * mm
    _txt(c, ANCHO - M - 45 * mm, y, "TOTAL PAGADO", 8, GRIS, "Helvetica-Bold")
    _txt(c, ANCHO - M, y - 8 * mm, f"S/ {float(datos.get('total') or 0):.2f}", 18, VIOLETA, "Helvetica-Bold")
    _qr(c, codigo, M, 22 * mm, 26 * mm)
    _txt(c, M + 30 * mm, 30 * mm, "Presenta este codigo", 8, GRIS, "Helvetica-Bold")
    _txt(c, M + 30 * mm, 25 * mm, "en la boleteria al abordar.", 8, GRIS)
    _pie(c, "Documento informativo generado al momento de la compra.")


def _boleto(c, t):
    _cabecera(c, "BOLETO DE VIAJE", t.get("numero_boleto") or "-")

    y = ALTO - 46 * mm
    _txt(c, M, y, f"{t.get('origen')}  ->  {t.get('destino')}", 20, TINTA, "Helvetica-Bold")
    y -= 10 * mm
    _dato(c, M, y, "Fecha", _fecha(t.get("fecha_salida")))
    _dato(c, M + 55 * mm, y, "Hora de salida", t.get("hora_salida") or "-")
    _dato(c, M + 110 * mm, y, "Duracion", f"{t.get('duracion_horas') or 0:g} h")
    y -= 22 * mm

    c.setStrokeColor(LINEA)
    c.line(M, y + 8 * mm, ANCHO - M, y + 8 * mm)
    y -= 2 * mm

    _txt(c, M, y, "PISO", 7, GRIS, "Helvetica-Bold")
    _txt(c, M + 45 * mm, y, "ASIENTO", 7, GRIS, "Helvetica-Bold")
    _txt(c, M + 90 * mm, y, "PRECIO PAGADO", 7, GRIS, "Helvetica-Bold")
    y -= 14 * mm
    _txt(c, M, y, str(t.get("piso") or 1), 30, VIOLETA, "Helvetica-Bold")
    _txt(c, M + 45 * mm, y, str(t.get("numero_asiento")), 30, NARANJA, "Helvetica-Bold")
    _txt(c, M + 90 * mm, y, f"S/ {float(t.get('precio_pagado') or 0):.2f}", 22, TINTA, "Helvetica-Bold")
    y -= 16 * mm

    c.setStrokeColor(LINEA)
    c.line(M, y + 6 * mm, ANCHO - M, y + 6 * mm)
    y -= 2 * mm

    _dato(c, M, y, "Pasajero", t.get("pasajero_nombre") or "Pasajero")
    _dato(c, M + 80 * mm, y, "DNI", _mascarar_dni(t.get("pasajero_dni")))
    y -= 18 * mm

    _dato(c, M, y, "Bus", f"{t.get('bus_placa') or '-'}  ({t.get('bus_modelo') or '-'})")
    _dato(c, M + 80 * mm, y, "Tipo de servicio", t.get("bus_tipo") or "-")
    y -= 20 * mm

    valor_qr = f"{MARCA}|{t.get('id') or ''}|{t.get('codigo_reserva') or ''}"
    _qr(c, valor_qr, M, 22 * mm, 30 * mm)
    renderPDF.draw(
        createBarcodeDrawing("Code128", value=t.get("numero_boleto") or "-", barHeight=12 * mm, barWidth=0.7 * mm),
        c,
        M + 42 * mm,
        24 * mm,
    )
    _txt(c, M + 42 * mm, 20 * mm, t.get("numero_boleto") or "-", 7, GRIS, "Helvetica-Bold")
    _pie(c, "Presenta este boleto en la boleteria al abordar. No es transferible.")


def generar_pdf_boletos(datos: dict) -> bytes:
    """Arma el PDF (portada + un boleto por pasajero) y devuelve los bytes."""
    tickets = datos.get("tickets") or []
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    _portada(c, datos, tickets)
    c.showPage()
    for t in tickets:
        _boleto(c, t)
        c.showPage()

    c.save()
    return buf.getvalue()
