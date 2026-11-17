import { Download, Check } from 'lucide-react'
import '../styles/petfriendly.css'

const rutas = [
  'Trujillo - Chiclayo - Trujillo',
  'Trujillo - Talara - Trujillo',
  'Chiclayo - Piura - Chiclayo',
  'Trujillo - Sullana - Trujillo',
  'Lima - Chimbote - Lima',
  'Trujillo - Tumbes - Trujillo',
  'Trujillo - Piura - Trujillo',
  'Trujillo - Paita - Trujillo',
  'Trujillo - Lima - Trujillo',
]

const PetFriendly = () => (
  <div className="pf-page">
    <section className="pf-hero">
      <div className="pf-hero__container">
        <img
          className="pf-hero__bg"
          src="/petfriendly/Imagen-1.png"
          alt="Perro beagle con pañuelo sentado sobre un fondo amarillo"
          fetchPriority="high"
        />

        <div className="pf-hero__content">
          <p className="pf-hero__badge">Servicio Especial</p>
          <h1 className="pf-hero__title">PetFriendly</h1>
          <p className="pf-hero__subtitle">¡Tus viajes ahora dejarán huella!</p>
          <p className="pf-hero__desc">
            En ITTSABUS sabemos que tu mascota no es solo una mascota, es parte de tu familia. Por eso creamos
            nuestro servicio PetFriendly, para que puedan viajar juntos, con la tranquilidad, seguridad y
            comodidad que ambos merecen.
          </p>
        </div>

        <div className="pf-hero__quote">
          Porque los mejores momentos comienzan
          <br />
          cuando nadie se queda en casa. <span className="heart-icon">♡</span>
        </div>
      </div>
    </section>

    <section className="pf-section">
      <div className="container">
        <div className="pf-consiste-row">
          <div className="pf-consiste-row__text">
            <h2 className="pf-section__title">¿En qué consiste el servicio?</h2>
            <p className="pf-section__text">
              El servicio PetFriendly permite que <strong>tu mascota viaje a tu lado en su respectivo asiento</strong>, dentro de su kennel, cumpliendo con protocolos establecidos y bajo condiciones que garantizan su bienestar, tu comodidad y la seguridad de todos a bordo.
            </p>
          </div>
          <div className="pf-consiste-row__img">
            <img src="/petfriendly/Imagen-2.png" alt="Bus ITTSABUS con sello Servicio PetFriendly" loading="lazy" />
          </div>
        </div>
      </div>
    </section>

    <section className="pf-rutas">
      <div className="container">
        <h2 className="pf-rutas__title">¿A dónde puedo viajar con mi mascota?</h2>
        <div className="pf-rutas__row">
          <div className="pf-rutas__info">
            <p className="pf-rutas__desc">
              Este servicio está pensado para los pasajeros que <strong>viajan con sus mascotas</strong>, permitiéndoles trasladarlas de forma segura y cómoda en las siguientes rutas.
            </p>
            <ul className="pf-rutas-grid">
              {rutas.map((ruta) => (
                <li key={ruta}>{ruta}</li>
              ))}
            </ul>
            <div>
              <p style={{ fontSize: '20px' }}>
                <strong>*Consulta los horarios y disponibilidad en las agencias presenciales.</strong>
              </p>
            </div>
          </div>
          <div className="pf-rutas__img" style={{ margin: '-50px auto 0' }}>
            <img src="/petfriendly/imagen-3.png" alt="Gato asomándose con fondo amarillo circular" loading="lazy" />
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
              <a href="/petfriendly/pdf/TyC-Petfriendly-A4.pdf" target="_blank" rel="noreferrer" className="pf-btn">
                <Download size={16} aria-hidden="true" /> Términos y Condiciones
              </a>
            </div>
            <div>
              <a href="/petfriendly/pdf/Declaracion-Jurada-Petfriendly.pdf" target="_blank" rel="noreferrer" className="pf-btn">
                <Download size={16} aria-hidden="true" /> Declaración Jurada
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="pf-kennel">
      <div className="container">
        <h2 className="pf-kennel__title">Medidas del kennel:</h2>
        <div className="pf-kennel__row">
          <div className="pf-kennel__info">
            <p>El kennel de la mascota, no debe interferir ni impedir la reclinación del asiento delantero.</p>
            <p className="medidas"><strong>30cm de ancho x 48cm de largo x 32cm de altura</strong></p>
          </div>
          <div className="pf-kennel__img">
            <img src="/petfriendly/imagen-5.png" alt="Kennel con medidas: ancho, altura y profundidad" loading="lazy" />
            <img
              src="/petfriendly/imagen-4.png"
              className="imagen-ocultar-desktop"
              alt="Perrito poodle con arnés colorido"
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
              <Check size={18} aria-hidden="true" /> En nuestros counter de atención al cliente en nuestras agencias.
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
          Con <strong>ITTSABUS PetFriendly</strong>, tu mascota viaja con el cuidado,
          <br />
          orden y respeto que se merece.
        </p>
      </div>
    </section>
  </div>
)

export default PetFriendly
