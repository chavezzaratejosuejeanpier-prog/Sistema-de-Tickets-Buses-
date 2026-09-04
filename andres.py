def aplicar_operacion(numero, funcion):
    return funcion(numero)


def duplicar(x):
    return x * 2


resultado_1 = aplicar_operacion(10, duplicar)
resultado_2 = aplicar_operacion(10, lambda x: x ** 2)

print("Duplicar 10:", resultado_1)
print("Elevar 10 al cuadrado:", resultado_2)