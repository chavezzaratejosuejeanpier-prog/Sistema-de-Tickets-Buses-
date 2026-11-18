export const IGV = 1.18

// Equivale a round(valor, 2) de Python: toFixed(2) redondea según el valor binario exacto
// y solo difiere en empates exactos (múltiplos impares de 1/8), donde Python elige el centavo par.
const redondear2 = (valor) => {
  const octavos = valor * 8
  if (Number.isInteger(octavos) && octavos % 2 !== 0) {
    const centavos = Math.floor(valor * 100)
    return (centavos % 2 === 0 ? centavos : centavos + 1) / 100
  }
  return Number(valor.toFixed(2))
}

// Igual que backend/app/services/ticket_service.py (calcularMontos):
// unitario = round(precio_base * 1.18, 2); total = round(unitario * cantidad, 2)
const precioUnitarioConIGV = (precio) => redondear2(Number(precio ?? 0) * IGV)

export const totalConIGV = (precio, cantidad) => redondear2(precioUnitarioConIGV(precio) * cantidad)
