
"use strict";

/*
 * MIS RAÍCES - SISTEMA PQRS
 * Prototipo académico con almacenamiento local.
 *
 * IMPORTANTE:
 * localStorage permite conservar registros en este navegador.
 * No reemplaza una base de datos ni un sistema de autenticación
 * seguro para producción.
 *
 * NUEVA FUNCIONALIDAD:
 * Las solicitudes que llegan al estado "Resuelta" quedan
 * bloqueadas permanentemente y disponibles solo para consulta.
 */

const CLAVES = {
    usuarios: "misRaices_usuarios",
    solicitudes: "misRaices_pqrs",
    sesion: "misRaices_sesion"
};

const CREDENCIALES_PERSONAL = {
    correo: "admin@supermercado.com",
    clave: "Demo123!"
};

let usuarioActual = null;
let tipoSesion = null;

/* LECTURA Y ALMACENAMIENTO */

function leerDatos(clave) {
    try {
        const datos = JSON.parse(localStorage.getItem(clave));
        return Array.isArray(datos) ? datos : [];
    } catch (error) {
        console.error("No fue posible leer los datos:", error);
        return [];
    }
}

function guardarDatos(clave, datos) {
    localStorage.setItem(clave, JSON.stringify(datos));
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caracter]);
}

function fechaActual() {
    return new Date().toLocaleString("es-CO", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function generarRadicado() {
    const fecha = new Date();
    const marcaTiempo = fecha.getTime().toString().slice(-7);
    const aleatorio = Math.floor(100 + Math.random() * 900);
    return `MR-${marcaTiempo}-${aleatorio}`;
}

/* CONTROL DE SOLICITUDES RESUELTAS */

function solicitudEstaBloqueada(solicitud) {
    return Boolean(
        solicitud &&
        (solicitud.bloqueada === true || solicitud.estado === "Resuelta")
    );
}

function puedeModificarSolicitud(solicitud) {
    return Boolean(solicitud && !solicitudEstaBloqueada(solicitud));
}

function mensajeSolicitudBloqueada() {
    return "Esta solicitud ya fue resuelta y está bloqueada. Solo puedes consultar su información e historial.";
}

/* PANTALLAS */

function mostrarPantalla(id) {
    document.querySelectorAll(".pantalla").forEach(pantalla => {
        pantalla.classList.remove("activa");
    });

    const destino = document.getElementById(id);

    if (destino) {
        destino.classList.add("activa");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

function irInicio() {
    mostrarPantalla("inicio");
}

function mostrarMensaje(id, texto, tipo = "") {
    const elemento = document.getElementById(id);

    if (!elemento) return;

    elemento.textContent = texto;
    elemento.className = `mensaje ${tipo}`;
}

function cambiarTabCliente(tab) {
    const login = document.getElementById("form-login-cliente");
    const registro = document.getElementById("form-registro-cliente");

    login.classList.toggle("oculto", tab !== "login");
    registro.classList.toggle("oculto", tab !== "registro");

    document.getElementById("tab-login").classList.toggle("active", tab === "login");
    document.getElementById("tab-registro").classList.toggle("active", tab === "registro");

    mostrarMensaje("mensaje-login-cliente", "");
    mostrarMensaje("mensaje-registro-cliente", "");
}

/* NORMALIZACIÓN Y CONSERVACIÓN DE REGISTROS */

function normalizarSolicitudes() {
    const solicitudes = leerDatos(CLAVES.solicitudes);
    let huboCambios = false;

    const normalizadas = solicitudes.map(solicitud => {
        const registro = { ...solicitud };

        if (!Array.isArray(registro.mensajes)) {
            registro.mensajes = [];
            huboCambios = true;
        }

        if (!Array.isArray(registro.historial)) {
            registro.historial = [];
            huboCambios = true;
        }

        if (typeof registro.solucion !== "string") {
            registro.solucion = "";
            huboCambios = true;
        }

        if (typeof registro.observacionesPrivadas !== "string") {
            registro.observacionesPrivadas = "";
            huboCambios = true;
        }

        if (!registro.estado) {
            registro.estado = "Recibida";
            huboCambios = true;
        }

        if (!registro.responsable) {
            registro.responsable = "Pendiente de asignación";
            huboCambios = true;
        }

        if (!registro.descripcion) {
            registro.descripcion = "";
            huboCambios = true;
        }

        /*
         * Las solicitudes que ya estaban resueltas antes
         * de esta actualización también quedan bloqueadas.
         */
        if (registro.estado === "Resuelta" && registro.bloqueada !== true) {
            registro.bloqueada = true;
            huboCambios = true;
        }

        /*
         * Una solicitud bloqueada nunca puede volver
         * a un estado anterior.
         */
        if (registro.bloqueada === true && registro.estado !== "Resuelta") {
            registro.estado = "Resuelta";
            huboCambios = true;
        }

        /*
         * Conserva la descripción original y evita
         * duplicar el mensaje inicial.
         */
        const tieneMensajeInicial = registro.mensajes.some(mensaje =>
            mensaje &&
            mensaje.autor === "Cliente" &&
            mensaje.texto === registro.descripcion
        );

        if (registro.descripcion && !tieneMensajeInicial) {
            registro.mensajes.unshift({
                autor: "Cliente",
                texto: registro.descripcion,
                fecha: registro.fecha || "Registro anterior"
            });

            huboCambios = true;
        }

        return registro;
    });

    if (huboCambios) {
        guardarDatos(CLAVES.solicitudes, normalizadas);
    }

    return normalizadas;
}

/* HISTORIAL */

function agregarHistorial(solicitud, accion, detalle, autor) {
    if (!Array.isArray(solicitud.historial)) {
        solicitud.historial = [];
    }

    solicitud.historial.push({
        accion,
        detalle,
        autor,
        fecha: fechaActual()
    });
}

/* SOLICITUDES DEL CLIENTE */

function obtenerSolicitudesCliente() {
    const solicitudes = normalizarSolicitudes();

    return solicitudes.filter(solicitud =>
        solicitud.usuarioId === usuarioActual.id ||
        String(solicitud.correo || "").toLowerCase() === usuarioActual.correo
    );
}

/* SESIONES */

function guardarSesion() {
    sessionStorage.setItem(CLAVES.sesion, JSON.stringify({
        tipo: tipoSesion,
        usuarioId: usuarioActual?.id || null
    }));
}

function iniciarSesionCliente(usuario) {
    usuarioActual = usuario;
    tipoSesion = "cliente";

    guardarSesion();

    document.getElementById("nombre-cliente-panel").textContent = usuario.nombre;

    renderCliente();
    mostrarPantalla("panel-cliente");
}

function iniciarSesionPersonal() {
    usuarioActual = {
        nombre: "Personal interno",
        correo: CREDENCIALES_PERSONAL.correo
    };

    tipoSesion = "admin";

    guardarSesion();

    renderAdmin();
    mostrarPantalla("panel-admin");
}

function cerrarSesion() {
    sessionStorage.removeItem(CLAVES.sesion);

    usuarioActual = null;
    tipoSesion = null;

    limpiarCamposAcceso();
    mostrarPantalla("inicio");
}

function limpiarCamposAcceso() {
    [
        "login-email",
        "login-password",
        "admin-email",
        "admin-password"
    ].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
}

/* REGISTRO DE CLIENTES */

document.getElementById("form-registro-cliente").addEventListener("submit", function (event) {
    event.preventDefault();

    const nombre = document.getElementById("registro-nombre").value.trim();
    const correo = document.getElementById("registro-email").value.trim().toLowerCase();
    const telefono = document.getElementById("registro-telefono").value.trim();
    const clave = document.getElementById("registro-password").value;

    if (!nombre || !correo || !telefono || clave.length < 6) {
        mostrarMensaje(
            "mensaje-registro-cliente",
            "Completa todos los campos correctamente.",
            "error"
        );
        return;
    }

    const usuarios = leerDatos(CLAVES.usuarios);

    if (usuarios.some(usuario => usuario.correo === correo)) {
        mostrarMensaje(
            "mensaje-registro-cliente",
            "Este correo ya tiene una cuenta registrada.",
            "error"
        );
        return;
    }

    const nuevoUsuario = {
        id: "USR-" + Date.now(),
        nombre,
        correo,
        telefono,
        clave,
        fechaRegistro: fechaActual()
    };

    usuarios.push(nuevoUsuario);
    guardarDatos(CLAVES.usuarios, usuarios);

    this.reset();
    cambiarTabCliente("login");

    document.getElementById("login-email").value = correo;

    mostrarMensaje(
        "mensaje-login-cliente",
        "Cuenta creada correctamente. Ya puedes ingresar.",
        "exito"
    );
});

/* INICIO DE SESIÓN CLIENTE */

document.getElementById("form-login-cliente").addEventListener("submit", function (event) {
    event.preventDefault();

    const correo = document.getElementById("login-email").value.trim().toLowerCase();
    const clave = document.getElementById("login-password").value;

    const usuarios = leerDatos(CLAVES.usuarios);

    const usuario = usuarios.find(item =>
        item.correo === correo && item.clave === clave
    );

    if (!usuario) {
        mostrarMensaje(
            "mensaje-login-cliente",
            "Correo o contraseña incorrectos.",
            "error"
        );
        return;
    }

    this.reset();
    iniciarSesionCliente(usuario);
});

/* INICIO DE SESIÓN PERSONAL */

document.getElementById("form-login-admin").addEventListener("submit", function (event) {
    event.preventDefault();

    const correo = document.getElementById("admin-email").value.trim().toLowerCase();
    const clave = document.getElementById("admin-password").value;

    if (
        correo !== CREDENCIALES_PERSONAL.correo ||
        clave !== CREDENCIALES_PERSONAL.clave
    ) {
        mostrarMensaje(
            "mensaje-login-admin",
            "Credenciales incorrectas.",
            "error"
        );
        return;
    }

    this.reset();
    iniciarSesionPersonal();
});

/* CREACIÓN DE SOLICITUDES */

document.getElementById("form-nueva-pqrs").addEventListener("submit", function (event) {
    event.preventDefault();

    if (tipoSesion !== "cliente" || !usuarioActual) {
        cerrarSesion();
        return;
    }

    const tipo = document.getElementById("pqrs-tipo").value;
    const producto = document.getElementById("pqrs-producto").value;
    const presentacion = document.getElementById("pqrs-presentacion").value;
    const asunto = document.getElementById("pqrs-asunto").value.trim();
    const descripcion = document.getElementById("pqrs-descripcion").value.trim();

    if (!tipo || !producto || !presentacion || !asunto || !descripcion) {
        mostrarMensaje(
            "mensaje-nueva-pqrs",
            "Completa todos los campos.",
            "error"
        );
        return;
    }

    const solicitudes = normalizarSolicitudes();
    const fecha = fechaActual();

    const nuevaSolicitud = {
        id: generarRadicado(),
        usuarioId: usuarioActual.id,
        cliente: usuarioActual.nombre,
        correo: usuarioActual.correo,
        telefono: usuarioActual.telefono || "",
        tipo,
        producto,
        presentacion,
        asunto,
        descripcion,
        estado: "Recibida",
        responsable: "Pendiente de asignación",
        solucion: "",
        observacionesPrivadas: "",
        bloqueada: false,
        fecha,
        fechaActualizacion: fecha,

        mensajes: [{
            autor: "Cliente",
            texto: descripcion,
            fecha
        }],

        historial: [{
            accion: "Solicitud creada",
            detalle: "El cliente registró una nueva solicitud PQRS.",
            autor: usuarioActual.nombre,
            fecha
        }]
    };

    solicitudes.unshift(nuevaSolicitud);

    guardarDatos(CLAVES.solicitudes, solicitudes);

    this.reset();

    mostrarMensaje(
        "mensaje-nueva-pqrs",
        `Solicitud enviada correctamente. Radicado: ${nuevaSolicitud.id}`,
        "exito"
    );

    renderCliente();
});

/* ESTADÍSTICAS */

function actualizarEstadisticas(solicitudes, prefijo) {
    const total = solicitudes.length;

    const resueltas = solicitudes.filter(s =>
        solicitudEstaBloqueada(s)
    ).length;

    const pendientes = total - resueltas;

    document.getElementById(`total-${prefijo}`).textContent = total;
    document.getElementById(`pendientes-${prefijo}`).textContent = pendientes;
    document.getElementById(`resueltas-${prefijo}`).textContent = resueltas;
}

function claseEstado(estado) {
    if (estado === "Resuelta") return "resuelta";
    if (estado === "En revisión") return "revision";
    if (estado === "En proceso") return "proceso";
    if (estado === "Respondida") return "respondida";

    return "";
}

/* CONVERSACIONES */

function renderMensajes(solicitud) {
    if (!Array.isArray(solicitud.mensajes) || !solicitud.mensajes.length) {
        return '<p class="empty-state">Todavía no hay mensajes en esta conversación.</p>';
    }

    return solicitud.mensajes.map(mensaje => {
        const esPersonal = mensaje.autor !== "Cliente";

        return `
            <div class="chat-message ${esPersonal ? "personal" : ""}">
                <small>
                    ${escaparHTML(mensaje.autor)}
                    ·
                    ${escaparHTML(mensaje.fecha)}
                </small>
                <p>${escaparHTML(mensaje.texto)}</p>
            </div>
        `;
    }).join("");
}

function renderHistorial(solicitud) {
    if (!Array.isArray(solicitud.historial) || !solicitud.historial.length) {
        return "<p>No hay movimientos registrados.</p>";
    }

    return solicitud.historial.map(item => `
        <div class="history-item">
            <strong>${escaparHTML(item.accion)}</strong>
            <div>${escaparHTML(item.detalle)}</div>
            <small>
                ${escaparHTML(item.autor)}
                ·
                ${escaparHTML(item.fecha)}
            </small>
        </div>
    `).join("");
}

/* TARJETAS COMPLETAS DE SOLICITUDES */

function renderTarjeta(solicitud, esAdmin) {
    const idSeguro = escaparHTML(solicitud.id);
    const bloqueada = solicitudEstaBloqueada(solicitud);

    return `
        <article class="record-card ${bloqueada ? "solicitud-bloqueada" : ""}">

            <div class="record-top">
                <div>
                    <div class="record-id">RADICADO ${idSeguro}</div>
                    <h4>${escaparHTML(solicitud.asunto)}</h4>
                </div>

                <span class="status ${claseEstado(solicitud.estado)}">
                    ${escaparHTML(solicitud.estado)}
                </span>
            </div>

            ${bloqueada ? `
                <div class="record-section">
                    <p class="mensaje exito">
                        🔒 Solicitud resuelta y bloqueada. Este registro es de solo consulta.
                    </p>
                </div>
            ` : ""}

            <div class="record-grid">

                <div class="record-field">
                    <small>Cliente</small>
                    <p>${escaparHTML(solicitud.cliente)}</p>
                </div>

                <div class="record-field">
                    <small>Correo electrónico</small>
                    <p>${escaparHTML(solicitud.correo)}</p>
                </div>

                <div class="record-field">
                    <small>Tipo de solicitud</small>
                    <p>${escaparHTML(solicitud.tipo)}</p>
                </div>

                <div class="record-field">
                    <small>Producto o servicio</small>
                    <p>${escaparHTML(solicitud.producto)}</p>
                </div>

                <div class="record-field">
                    <small>Presentación</small>
                    <p>${escaparHTML(solicitud.presentacion || "No especificada")}</p>
                </div>

                <div class="record-field">
                    <small>Responsable</small>
                    <p>${escaparHTML(solicitud.responsable)}</p>
                </div>

                <div class="record-field">
                    <small>Fecha de creación</small>
                    <p>${escaparHTML(solicitud.fecha)}</p>
                </div>

                <div class="record-field">
                    <small>Última actualización</small>
                    <p>${escaparHTML(solicitud.fechaActualizacion || solicitud.fecha)}</p>
                </div>

                <div class="record-field full">
                    <small>Descripción original del cliente</small>
                    <p>${escaparHTML(solicitud.descripcion)}</p>
                </div>

                <div class="record-field full">
                    <small>Solución registrada</small>
                    <p>${escaparHTML(solicitud.solucion || "Aún no se ha registrado una solución.")}</p>
                </div>

            </div>

            <div class="record-section">
                <h5>💬 Conversación y respuestas</h5>
                ${renderMensajes(solicitud)}
            </div>

            ${!esAdmin && !bloqueada ? `
                <form class="reply-form" onsubmit="responderCliente(event, '${idSeguro}')">
                    <textarea
                        name="respuesta"
                        placeholder="Escribe un mensaje o respuesta..."
                        required
                    ></textarea>

                    <button class="btn btn-primary" type="submit">
                        Enviar
                    </button>
                </form>
            ` : ""}

            ${!esAdmin && bloqueada ? `
                <div class="record-section">
                    <p class="mensaje">
                        Esta solicitud ya fue resuelta. La conversación permanece disponible para consulta, pero no admite nuevos mensajes.
                    </p>
                </div>
            ` : ""}

            <div class="record-section">
                <h5>🕘 Historial de movimientos</h5>
                ${renderHistorial(solicitud)}
            </div>

            ${esAdmin ? `

                <div class="record-section">
                    <h5>🔒 Observaciones privadas del personal</h5>

                    <div class="private-note">
                        ${escaparHTML(solicitud.observacionesPrivadas || "No hay observaciones privadas registradas.")}
                    </div>
                </div>

                <div class="admin-editor">

                    <h5>⚙️ Gestionar solicitud</h5>

                    ${bloqueada ? `
                        <p class="mensaje exito">
                            🔒 Esta solicitud está cerrada definitivamente. Los campos de gestión están deshabilitados.
                        </p>
                    ` : ""}

                    <label for="estado-${idSeguro}">Estado</label>

                    <select
                        id="estado-${idSeguro}"
                        ${bloqueada ? "disabled" : ""}
                    >
                        ${["Recibida", "En revisión", "En proceso", "Respondida", "Resuelta"].map(estado => `
                            <option
                                value="${estado}"
                                ${solicitud.estado === estado ? "selected" : ""}
                            >
                                ${estado}
                            </option>
                        `).join("")}
                    </select>

                    <label for="responsable-${idSeguro}">Responsable</label>

                    <input
                        id="responsable-${idSeguro}"
                        value="${escaparHTML(solicitud.responsable)}"
                        placeholder="Nombre del responsable"
                        ${bloqueada ? "disabled" : ""}
                    >

                    <label for="respuesta-${idSeguro}">
                        Respuesta pública para el cliente
                    </label>

                    <textarea
                        id="respuesta-${idSeguro}"
                        rows="3"
                        placeholder="Escribe aquí la respuesta que podrá consultar el cliente..."
                        ${bloqueada ? "disabled" : ""}
                    ></textarea>

                    <label for="solucion-${idSeguro}">
                        Solución o gestión realizada
                    </label>

                    <textarea
                        id="solucion-${idSeguro}"
                        rows="3"
                        placeholder="Describe la solución aplicada..."
                        ${bloqueada ? "disabled" : ""}
                    >${escaparHTML(solicitud.solucion)}</textarea>

                    <label for="nota-${idSeguro}">
                        Observación privada (solo personal)
                    </label>

                    <textarea
                        id="nota-${idSeguro}"
                        rows="2"
                        placeholder="Esta nota no será visible para el cliente..."
                        ${bloqueada ? "disabled" : ""}
                    >${escaparHTML(solicitud.observacionesPrivadas)}</textarea>

                    <button
                        class="btn btn-secondary"
                        type="button"
                        onclick="guardarGestion('${idSeguro}')"
                        ${bloqueada ? "disabled" : ""}
                    >
                        ${bloqueada ? "Solicitud bloqueada" : "Guardar cambios"}
                    </button>

                    <p id="gestion-mensaje-${idSeguro}" class="mensaje"></p>

                </div>

            ` : ""}

        </article>
    `;
}

/* PANEL CLIENTE Y FILTROS */

function renderCliente() {
    if (!usuarioActual || tipoSesion !== "cliente") return;

    const solicitudes = obtenerSolicitudesCliente();

    actualizarEstadisticas(solicitudes, "cliente");

    const texto = (
        document.getElementById("filtro-cliente-texto")?.value || ""
    ).toLowerCase().trim();

    const estado = document.getElementById("filtro-cliente-estado")?.value || "";

    const filtradas = solicitudes.filter(solicitud => {

        const coincideTexto =
            String(solicitud.id).toLowerCase().includes(texto) ||
            String(solicitud.asunto).toLowerCase().includes(texto);

        const coincideEstado =
            !estado || solicitud.estado === estado;

        return coincideTexto && coincideEstado;
    });

    const contenedor = document.getElementById("lista-pqrs-cliente");

    if (!filtradas.length) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <strong>
                    ${solicitudes.length
                ? "No hay coincidencias"
                : "Todavía no tienes solicitudes"}
                </strong>

                ${solicitudes.length
                ? "Prueba con otros filtros o límpialos para ver todos tus registros."
                : "Cuando envíes una PQRS, aparecerá aquí con su información y seguimiento."}
            </div>
        `;

        return;
    }

    contenedor.innerHTML = filtradas
        .map(solicitud => renderTarjeta(solicitud, false))
        .join("");
}

function limpiarFiltrosCliente() {
    document.getElementById("filtro-cliente-texto").value = "";
    document.getElementById("filtro-cliente-estado").value = "";

    renderCliente();
}

document.getElementById("filtro-cliente-texto").addEventListener("input", renderCliente);
document.getElementById("filtro-cliente-estado").addEventListener("change", renderCliente);

/* RESPUESTA DEL CLIENTE */

function responderCliente(event, id) {
    event.preventDefault();

    if (tipoSesion !== "cliente" || !usuarioActual) {
        return;
    }

    const solicitudes = normalizarSolicitudes();

    const solicitud = solicitudes.find(item => item.id === id);

    if (!solicitud) return;

    const perteneceAlCliente =
        solicitud.usuarioId === usuarioActual.id ||
        solicitud.correo === usuarioActual.correo;

    if (!perteneceAlCliente) return;

    /*
     * SEGURIDAD:
     * No se permite escribir en solicitudes resueltas.
     */
    if (!puedeModificarSolicitud(solicitud)) {
        alert(mensajeSolicitudBloqueada());
        renderCliente();
        return;
    }

    const texto = event.target.elements.respuesta.value.trim();

    if (!texto) return;

    const fecha = fechaActual();

    solicitud.mensajes.push({
        autor: usuarioActual.nombre,
        texto,
        fecha
    });

    solicitud.fechaActualizacion = fecha;

    agregarHistorial(
        solicitud,
        "Nuevo mensaje del cliente",
        "El cliente agregó un mensaje a la conversación.",
        usuarioActual.nombre
    );

    guardarDatos(CLAVES.solicitudes, solicitudes);

    renderCliente();
}

/* PANEL ADMINISTRATIVO Y FILTROS */

function renderAdmin() {
    if (tipoSesion !== "admin") return;

    const solicitudes = normalizarSolicitudes();

    actualizarEstadisticas(solicitudes, "admin");

    const texto = (
        document.getElementById("filtro-admin-texto")?.value || ""
    ).toLowerCase().trim();

    const tipo = document.getElementById("filtro-admin-tipo")?.value || "";
    const estado = document.getElementById("filtro-admin-estado")?.value || "";

    const filtradas = solicitudes.filter(solicitud => {

        const coincideTexto =
            String(solicitud.id).toLowerCase().includes(texto) ||
            String(solicitud.cliente).toLowerCase().includes(texto) ||
            String(solicitud.correo).toLowerCase().includes(texto) ||
            String(solicitud.asunto).toLowerCase().includes(texto);

        return coincideTexto &&
            (!tipo || solicitud.tipo === tipo) &&
            (!estado || solicitud.estado === estado);
    });

    const contenedor = document.getElementById("lista-pqrs-admin");

    if (!filtradas.length) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <strong>
                    ${solicitudes.length
                ? "No se encontraron coincidencias"
                : "No hay solicitudes registradas"}
                </strong>

                ${solicitudes.length
                ? "Modifica los filtros o límpialos para visualizar todos los registros."
                : "Cuando los clientes registren solicitudes, aparecerán aquí."}
            </div>
        `;

        return;
    }

    contenedor.innerHTML = filtradas
        .map(solicitud => renderTarjeta(solicitud, true))
        .join("");
}

function limpiarFiltrosAdmin() {
    document.getElementById("filtro-admin-texto").value = "";
    document.getElementById("filtro-admin-tipo").value = "";
    document.getElementById("filtro-admin-estado").value = "";

    renderAdmin();
}

document.getElementById("filtro-admin-texto").addEventListener("input", renderAdmin);
document.getElementById("filtro-admin-tipo").addEventListener("change", renderAdmin);
document.getElementById("filtro-admin-estado").addEventListener("change", renderAdmin);

/* GESTIÓN DE SOLICITUDES POR PERSONAL */

function guardarGestion(id) {

    if (tipoSesion !== "admin") return;

    const solicitudes = normalizarSolicitudes();

    const solicitud = solicitudes.find(item => item.id === id);

    if (!solicitud) return;

    /*
     * BLOQUEO DEFINITIVO:
     * Se comprueba nuevamente antes de guardar.
     * Aunque alguien intente ejecutar la función directamente,
     * no podrá modificar una solicitud resuelta.
     */
    if (!puedeModificarSolicitud(solicitud)) {
        alert(mensajeSolicitudBloqueada());
        renderAdmin();
        return;
    }

    const campoEstado = document.getElementById(`estado-${id}`);
    const campoResponsable = document.getElementById(`responsable-${id}`);
    const campoRespuesta = document.getElementById(`respuesta-${id}`);
    const campoSolucion = document.getElementById(`solucion-${id}`);
    const campoNota = document.getElementById(`nota-${id}`);

    if (
        !campoEstado ||
        !campoResponsable ||
        !campoRespuesta ||
        !campoSolucion ||
        !campoNota
    ) {
        return;
    }

    const nuevoEstado = campoEstado.value;
    const nuevoResponsable = campoResponsable.value.trim();
    const nuevaRespuesta = campoRespuesta.value.trim();
    const nuevaSolucion = campoSolucion.value.trim();
    const nuevaNota = campoNota.value.trim();

    const fecha = fechaActual();

    /* ACTUALIZACIÓN DEL ESTADO */

    if (solicitud.estado !== nuevoEstado) {

        const estadoAnterior = solicitud.estado;

        solicitud.estado = nuevoEstado;

        agregarHistorial(
            solicitud,
            "Cambio de estado",
            `La solicitud cambió de ${estadoAnterior} a ${nuevoEstado}.`,
            "Personal interno"
        );
    }

    /* ACTUALIZACIÓN DEL RESPONSABLE */

    const responsableFinal =
        nuevoResponsable || "Pendiente de asignación";

    if (solicitud.responsable !== responsableFinal) {

        solicitud.responsable = responsableFinal;

        agregarHistorial(
            solicitud,
            "Actualización del responsable",
            `Responsable asignado: ${solicitud.responsable}.`,
            "Personal interno"
        );

        solicitud.mensajes.push({
            autor: "Mis Raíces - Atención al cliente",
            texto: `Tu solicitud ha sido asignada a: ${solicitud.responsable}.`,
            fecha
        });
    }

    /* RESPUESTA PÚBLICA */

    if (nuevaRespuesta) {

        solicitud.mensajes.push({
            autor: "Mis Raíces - Atención al cliente",
            texto: nuevaRespuesta,
            fecha
        });

        agregarHistorial(
            solicitud,
            "Respuesta enviada al cliente",
            "El personal registró una respuesta pública en la conversación.",
            "Personal interno"
        );

        campoRespuesta.value = "";

        if (
            solicitud.estado === "En proceso" ||
            solicitud.estado === "En revisión"
        ) {
            solicitud.estado = "Respondida";

            agregarHistorial(
                solicitud,
                "Estado actualizado",
                "La solicitud pasó a estado Respondida.",
                "Personal interno"
            );
        }
    }

    /* ACTUALIZACIÓN DE SOLUCIÓN */

    if (solicitud.solucion !== nuevaSolucion) {

        solicitud.solucion = nuevaSolucion;

        agregarHistorial(
            solicitud,
            "Solución actualizada",
            nuevaSolucion
                ? `Solución registrada: ${nuevaSolucion}`
                : "Se modificó el campo de solución.",
            "Personal interno"
        );

        if (nuevaSolucion) {
            solicitud.mensajes.push({
                autor: "Mis Raíces - Atención al cliente",
                texto: `Actualización de solución: ${nuevaSolucion}`,
                fecha
            });
        }
    }

    /* OBSERVACIONES PRIVADAS */

    if (solicitud.observacionesPrivadas !== nuevaNota) {

        solicitud.observacionesPrivadas = nuevaNota;

        agregarHistorial(
            solicitud,
            "Observación interna actualizada",
            "El personal modificó una observación privada.",
            "Personal interno"
        );
    }

    /*
     * CIERRE DEFINITIVO:
     * Al seleccionar Resuelta, se bloquea el registro.
     * Se conserva toda la información y se registra el cierre.
     */
    if (nuevoEstado === "Resuelta") {

        solicitud.estado = "Resuelta";
        solicitud.bloqueada = true;

        solicitud.mensajes.push({
            autor: "Mis Raíces - Atención al cliente",
            texto: solicitud.solucion
                ? `Tu solicitud ha sido resuelta. Solución final: ${solicitud.solucion}. El registro queda cerrado y disponible para consulta.`
                : "Tu solicitud ha sido marcada como resuelta. El registro queda cerrado y disponible para consulta.",
            fecha
        });

        agregarHistorial(
            solicitud,
            "Solicitud resuelta y bloqueada",
            "El personal finalizó la atención. La solicitud queda cerrada definitivamente y no admite nuevas modificaciones.",
            "Personal interno"
        );
    }

    solicitud.fechaActualizacion = fecha;

    guardarDatos(CLAVES.solicitudes, solicitudes);

    /*
     * Se vuelve a dibujar el panel.
     * Si quedó resuelta, todos sus campos aparecerán deshabilitados.
     */
    renderAdmin();
}

/* RECUPERACIÓN Y CIERRE DE SESIÓN */

function verificarSesion() {

    /*
     * La sesión es temporal:
     * no se restaura automáticamente después de recargar.
     *
     * Los usuarios, solicitudes, mensajes y el historial
     * permanecen almacenados en localStorage.
     */

    sessionStorage.removeItem(CLAVES.sesion);

    usuarioActual = null;
    tipoSesion = null;

    limpiarCamposAcceso();

    mostrarPantalla("inicio");
}

window.addEventListener("pageshow", function () {
    verificarSesion();
});

/*
 * Cerrar la sesión al abandonar o recargar la página.
 * No se eliminan los registros PQRS.
 */

window.addEventListener("pagehide", function () {

    sessionStorage.removeItem(CLAVES.sesion);

    usuarioActual = null;
    tipoSesion = null;
});

/* INICIALIZACIÓN */

document.addEventListener("DOMContentLoaded", function () {

    normalizarSolicitudes();

    verificarSesion();
});
