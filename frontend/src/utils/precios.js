// Factor de IGV. Debe coincidir con backend/app/services/ticket_service.py (IGV = 0.18)
export const IGV = 1.18

export const totalConIGV = (precio, cantidad) => cantidad * Number(precio ?? 0) * IGV
