import { Download, Check, PawPrint } from 'lucide-react'
import '../styles/petfriendly.css'

const PetFriendly = () => {
  return (
    <div className="pf-page">
      <section className="relative overflow-hidden bg-white px-4 py-20">
        <div className="relative mx-auto max-w-5xl">
          <PawPrint className="absolute -left-4 -top-6 h-20 w-20 rotate-[-25deg] !text-amber-400 opacity-20" aria-hidden="true" />
          <PawPrint className="absolute right-2 top-0 h-16 w-16 rotate-[15deg] !text-amber-400 opacity-20" aria-hidden="true" />
          <PawPrint className="absolute -left-8 top-1/3 h-14 w-14 rotate-[35deg] !text-amber-400 opacity-20" aria-hidden="true" />
          <PawPrint className="absolute -right-6 top-1/2 h-20 w-20 rotate-[-15deg] !text-amber-400 opacity-20" aria-hidden="true" />

          <div className="pf-hero-texto relative z-20 lg:pl-32">
            <p className="pf-hero-label mb-1 text-center pf-naranja">
              Servicio Especial
            </p>
            <h1 className="pf-hero-title mb-2 text-center pf-titulo">
              PetFriendly
            </h1>
            <p className="pf-hero-subtitle mb-4 text-center pf-naranja">
              ¡Tus viajes ahora dejarán huella!
            </p>
            <p className="pf-hero-desc mx-auto max-w-lg text-left pf-texto sm:text-center">
              En LUX sabemos que tu mascota no es solo una mascota, es parte de tu familia. Por eso creamos
              nuestro servicio PetFriendly, para que puedan viajar juntos, con la tranquilidad, seguridad y
              comodidad que ambos merecen.
            </p>
          </div>

          <div className="relative mx-auto mt-8 flex h-36 w-full max-w-4xl items-center justify-center rounded-[100%] border-b-8 border-amber-500 bg-amber-400 px-8 shadow-xl sm:h-44">
            <img
              src="/petfriendly/beagle.png"
              alt="Perro beagle con su arnés sentado sobre la plataforma amarilla"
              className="pf-hero-perro absolute bottom-4 left-6 z-20 w-44 drop-shadow-2xl sm:left-16 sm:w-60"
              fetchPriority="high"
            />
            <p className="pf-hero-quote relative z-10 pl-24 text-center !text-white drop-shadow-sm sm:pl-36">
              Porque los mejores momentos comienzan
              <br />
              cuando nadie se queda en casa. <span aria-hidden="true">♡</span>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-8">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] md:gap-12">
            <div>
              <h2 className="pf-titulo !text-left">
                ¿En qué consiste el servicio?
              </h2>
              <p className="pf-descripcion mt-4 max-w-xl !text-left pf-texto">
                El servicio PetFriendly permite que{' '}
                <strong className="font-bold pf-titulo">
                  tu mascota viaje a tu lado en su respectivo asiento
                </strong>
                , dentro de su kennel, cumpliendo con protocolos establecidos y bajo condiciones que
                garantizan su bienestar, tu comodidad y la seguridad de todos a bordo.
              </p>
            </div>

            <div className="flex justify-center">
              <img
                src="/petfriendly/emblema-petfriendly.png"
                alt="Emblema circular Servicio Pet Friendly con una huella blanca"
                className="w-56 object-contain sm:w-64 md:w-full md:max-w-sm"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto w-full max-w-[1150px] px-4 sm:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-10">
            <div className="w-full md:w-[65%]">
              <h2 className="pf-titulo">
                ¿A dónde puedo viajar con mi mascota?
              </h2>
              <p className="pf-descripcion mt-3 max-w-2xl pf-texto">
                Este servicio está pensado para los pasajeros que viajan con sus mascotas, permitiéndoles
                trasladarlas de forma segura y cómoda en las siguientes rutas.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                <ul className="space-y-0">
                  {[
                    'Lima - Trujillo - Lima',
                    'Lima - Chiclayo - Lima',
                    'Lima - Piura - Lima',
                    'Lima - Arequipa - Lima',
                    'Lima - Cusco - Lima',
                  ].map((ruta) => (
                    <li
                      key={ruta}
                      className="pf-ruta-item flex items-center gap-2 border-b border-gray-200 py-2 pf-texto"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />
                      <span className="leading-snug">{ruta}</span>
                    </li>
                  ))}
                </ul>
                <ul className="space-y-0">
                  {[
                    'Lima - Huaraz - Lima',
                    'Lima - Ica - Lima',
                    'Arequipa - Cusco - Arequipa',
                    'Cusco - Puno - Cusco',
                  ].map((ruta) => (
                    <li
                      key={ruta}
                      className="pf-ruta-item flex items-center gap-2 border-b border-gray-200 py-2 pf-texto"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />
                      <span className="leading-snug">{ruta}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="pf-nota mt-5 pf-secundario">
                *Consulta los horarios y disponibilidad en las agencias presenciales.
              </p>
            </div>

            <div className="flex w-full justify-center md:w-[35%] md:justify-end">
              <img
                src="/petfriendly/imagen-3.png"
                alt="Gato mirando al frente dentro de un círculo amarillo"
                className="w-56 object-contain sm:w-64 md:w-full md:max-w-sm"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="pf-terminos">
        <div className="container">
          <div className="pf-terminos__row">
            <div className="pf-terminos__img">
              <img src="/petfriendly/imagen-4.png" alt="Perrito poodle con arnés colorido" loading="lazy" />
            </div>
            <div className="pf-terminos__content">
              <h2 className="pf-terminos__title">
                ¡Revisa nuestros
                <br />
                términos y condiciones!
              </h2>
              <div className="terminos-btn">
                <a
                  href="/petfriendly/pdf/TyC-Petfriendly-A4.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-btn"
                  aria-label="Abrir términos y condiciones en una pestaña nueva"
                  title="Abrir en pestaña nueva"
                >
                  <Download size={16} aria-hidden="true" /> Términos y Condiciones
                </a>
              </div>
              <div>
                <a
                  href="/petfriendly/pdf/DECLARACION%20JURADA%20PETFRIENDLY%2016.03.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pf-btn"
                  aria-label="Abrir declaración jurada en una pestaña nueva"
                  title="Abrir en pestaña nueva"
                >
                  <Download size={16} aria-hidden="true" /> Declaración Jurada
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pf-kennel-seccion bg-white py-12 sm:py-16">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-8">
          <h2 className="pf-kennel-titulo !text-left pf-titulo">Medidas del kennel:</h2>
          <div className="mt-6 grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,60fr)_minmax(0,40fr)] md:gap-10">
            <div className="pf-kennel-texto">
              <p className="pf-kennel-desc pf-texto">
                El kennel de la mascota, no debe interferir ni impedir la reclinación del asiento delantero.
              </p>
              <p className="pf-kennel-medidas pf-titulo">
                <strong>30cm de ancho x 48cm de largo x 32cm de altura</strong>
              </p>
            </div>
            <div className="pf-kennel-imagen-wrap flex justify-center">
              <img
                src="/petfriendly/imagen-5.png"
                alt="Kennel con medidas: ancho, altura y profundidad"
                className="pf-kennel-imagen object-contain"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="pf-posicion">
        <div className="container">
          <h2 className="pf-posicion__title">Las mascotas deben estar en una posición cómoda.</h2>
          <div className="pf-posicion__img">
            <img
              src="/petfriendly/imagen-6.png"
              alt="Ilustraciones de perros mostrando posiciones cómodas dentro del kennel"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section className="pf-solicitar">
        <div className="container">
          <div className="pf-solicitar__row">
            <div className="pf-solicitar__text">
              <h2 className="pf-solicitar__title">¿Donde solicito el servicio PetFriendly?</h2>
              <div className="pf-solicitar__check">
                <Check size={18} className="pf-naranja shrink-0" aria-hidden="true" /> En nuestros counter de atención al cliente en nuestras agencias.
              </div>
              <p className="pf-solicitar__desc">
                Para poder acceder al servicio Petfriendly, es indispensable y obligatorio, cumplir con todos nuestros terminos y condiciones, así como llenar y firmar la declaración Jurada.
              </p>
            </div>

            <div className="pf-final__img">
              <img
                src="/petfriendly/imagen-7.png"
                alt="Perrito blanco con chaqueta morada sobre fondo amarillo"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="pf-final">
        <div className="container">
          <p className="pf-final__text">
            Con <strong>LUX PetFriendly</strong>, tu mascota viaja con el cuidado,
            <br />
            orden y respeto que se merece.
          </p>
        </div>
      </section>
    </div>
  )
}

export default PetFriendly
