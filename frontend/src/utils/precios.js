export const IGV = 1.18

export const totalConIGV = (precio, cantidad) => cantidad * Number(precio ?? 0) * IGV
