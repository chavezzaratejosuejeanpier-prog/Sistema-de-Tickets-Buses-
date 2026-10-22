import unicodedata

CATALOGO = [
    ("Lima", 0, "costa"), ("Callao", 15, "costa"), ("Arequipa", 780, "sierra"),
    ("Cusco", 1150, "sierra"), ("Trujillo", 560, "costa"), ("Chiclayo", 1010, "costa"),
    ("Piura", 1780, "costa"), ("Huancayo", 350, "sierra"), ("Iquitos", 1000, "selva"),
    ("Puno", 1300, "sierra"), ("Tacna", 980, "costa"), ("Ayacucho", 570, "sierra"),
    ("Cajamarca", 800, "sierra"), ("Huaraz", 380, "sierra"), ("Ica", 340, "costa"),
    ("Chimbote", 610, "costa"), ("Tarapoto", 1300, "selva"), ("Pucallpa", 850, "selva"),
    ("Tumbes", 1030, "costa"), ("Moquegua", 900, "costa"), ("Abancay", 900, "sierra"),
    ("Juliaca", 1000, "sierra"), ("Puerto Maldonado", 1600, "selva"), ("Huánuco", 400, "sierra"),
    ("Cerro de Pasco", 300, "sierra"), ("Huancavelica", 400, "sierra"), ("Chachapoyas", 900, "selva"),
    ("Jaén", 800, "selva"), ("Yurimaguas", 900, "selva"), ("Ilo", 950, "costa"),
    ("Sullana", 1000, "costa"), ("Talara", 1100, "costa"), ("Lambayeque", 1010, "costa"),
    ("Pacasmayo", 850, "costa"), ("Chepén", 870, "costa"), ("Barranca", 180, "costa"),
    ("Huacho", 130, "costa"), ("Cañete", 120, "costa"), ("Nazca", 570, "costa"),
    ("Camaná", 560, "costa"), ("Mollendo", 530, "costa"), ("Oxapampa", 350, "sierra"),
    ("Quillabamba", 570, "sierra"), ("Andahuaylas", 450, "sierra"), ("Pisco", 570, "costa"),
    ("Chincha", 130, "costa"), ("Satipo", 600, "selva"), ("La Merced", 400, "selva"),
    ("Tingo María", 600, "selva"), ("Moyobamba", 900, "selva"), ("Zarumilla", 950, "costa"),
    ("Aguas Verdes", 1050, "costa"), ("Zorritos", 1030, "costa"), ("Máncora", 1020, "costa"),
    ("Paita", 1000, "costa"), ("Sechura", 1000, "costa"), ("Chulucanas", 900, "costa"),
    ("Eten", 1020, "costa"), ("Salaverry", 570, "costa"), ("Virú", 590, "costa"),
    ("Huarmey", 350, "costa"), ("Casma", 330, "costa"), ("Nepeña", 300, "costa"),
    ("Chilca", 45, "costa"), ("Quilca", 70, "costa"), ("Islay", 520, "costa"),
    ("Punta de Bombón", 530, "costa"),
]

RUTAS = [
    ("Lima", "Trujillo", 9, 50.0, 90.0),
    ("Lima", "Chiclayo", 13, 90.0, 130.0),
    ("Lima", "Piura", 17, 100.0, 150.0),
    ("Lima", "Arequipa", 17, 90.0, 140.0),
    ("Lima", "Cusco", 22, 120.0, 180.0),
    ("Lima", "Huaraz", 8, 80.0, 120.0),
    ("Lima", "Ica", 4, 40.0, 70.0),
    ("Arequipa", "Cusco", 10, 85.0, 130.0),
    ("Cusco", "Puno", 7, 60.0, 90.0),
    ("Arequipa", "Moquegua", 3, 45.0, None),
]

HUBS = ["Arequipa", "Cusco", "Trujillo", "Chiclayo", "Piura", "Huaraz", "Ica", "Puno"]

BUSES = [
    {"placa": "ABC-123", "modelo": "Volvo 9800", "tipo": "PREMIUM", "capacidad_piso1": 20, "capacidad_piso2": 40, "total_asientos": 60},
    {"placa": "DEF-456", "modelo": "Mercedes-Benz O500", "tipo": "EJECUTIVO", "capacidad_piso1": 18, "capacidad_piso2": 42, "total_asientos": 60},
    {"placa": "GHI-789", "modelo": "Scania K124", "tipo": "ECONOMICO", "capacidad_piso1": 22, "capacidad_piso2": 38, "total_asientos": 60},
]

DIAS_SALIDA = 14

CIUDADES = sorted({ciudad for ciudad, _, _ in CATALOGO})
_KM = {ciudad: km for ciudad, km, _ in CATALOGO}
_REGION = {ciudad: region for ciudad, _, region in CATALOGO}


def normalizar(texto: str) -> str:
    if not texto:
        return ""
    sin_acentos = unicodedata.normalize("NFKD", texto.strip().lower())
    return "".join(c for c in sin_acentos if not unicodedata.combining(c))


def coincidencias(texto: str) -> list:
    t = normalizar(texto)
    if not t:
        return []
    exactas = [c for c in CIUDADES if normalizar(c) == t]
    if exactas:
        return exactas
    return [c for c in CIUDADES if normalizar(c).startswith(t)]


def pares_base() -> list:
    pares = set()
    for ciudad in CIUDADES:
        if ciudad != "Lima":
            pares.add(("Lima", ciudad))
    hubs = ["Lima"] + HUBS
    for i, a in enumerate(hubs):
        for b in hubs[i + 1:]:
            pares.add((a, b))
    for o, d, *_ in RUTAS:
        pares.add((o, d))
    return sorted(pares)


def _distancia(o: str, d: str) -> float:
    km_o, km_d = _KM[o], _KM[d]
    return abs(km_o - km_d) if _REGION[o] == _REGION[d] else km_o + km_d


def montos(o: str, d: str):
    for oo, dd, dur, precio, vip in RUTAS:
        if {oo, dd} == {o, d}:
            return dur, precio, vip
    km = _distancia(o, d)
    dur = round(km / 70 + 0.5, 1)
    precio = float(max(25, round(km * 0.09 / 5) * 5))
    vip = float(round(precio * 1.5 / 5) * 5)
    return dur, precio, vip
