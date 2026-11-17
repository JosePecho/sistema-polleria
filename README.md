
# POLLERÍA PRO
### Sistema web de toma de pedidos en sala y gestión de comandas

## 1. Descripción del proyecto

POLLERÍA PRO es un sistema web desarrollado para gestionar los pedidos de una pollería, facilitando la administración de mesas, productos, comandas, preparación en cocina, seguimiento de pedidos y pagos.

El sistema permite mantener actualizada la información de los pedidos y mejorar la coordinación entre el personal del restaurante.

## 2. Objetivo

Facilitar la gestión de las operaciones de una pollería mediante una aplicación web que permita registrar pedidos, administrar mesas, controlar la preparación de comandas y gestionar los pagos.

## 3. Tecnologías utilizadas

- React
- TypeScript
- Vite
- Firebase Authentication
- Cloud Firestore
- CSS

## 4. Módulos del sistema

1. Inicio de sesión.
2. Gestión de mesas.
3. Gestión de productos.
4. Gestión de pedidos.
5. Cocina.
6. Seguimiento de pedidos.
7. Consumo por mesa.
8. Caja.
9. Reportes y estadísticas.

## 5. Roles de usuario

- **Administrador:** administra los módulos y supervisa el funcionamiento del sistema.
- **Mozo:** gestiona las mesas y registra pedidos.
- **Cocina:** recibe las comandas y actualiza sus estados de preparación.
- **Cajero:** consulta cuentas y registra pagos.

## 6. Requisitos previos

Para ejecutar el proyecto localmente se necesita:

- Node.js.
- npm.
- Un navegador web actualizado.
- Acceso a la configuración del proyecto de Firebase.

## 7. Instalación

Clonar el repositorio:

```bash
git clone https://github.com/JosePecho/sistema-polleria.git
```

Ingresar a la carpeta:

```bash
cd sistema-polleria
```

Instalar las dependencias:

```bash
npm install
```

## 8. Configuración de Firebase

El proyecto utiliza Firebase Authentication para la autenticación de usuarios y Cloud Firestore para almacenar la información del sistema.

Para ejecutar el proyecto, se debe configurar el archivo de conexión de Firebase con las credenciales del proyecto correspondiente.

No se deben publicar claves privadas ni contraseñas en el repositorio.

## 9. Ejecución en desarrollo

Iniciar el servidor local:

```bash
npm run dev
```

## 10. Compilación para producción

Generar la versión de producción:

```bash
npm run build
```

Los archivos compilados se generan en la carpeta `dist`.

## 11. Publicación

La aplicación está publicada mediante Firebase Hosting:

https://sistema-polleria-1487c.web.app

## 12. Base de datos

Se utiliza Cloud Firestore para almacenar información organizada en las siguientes colecciones:

- usuarios
- mesas
- productos
- pedidos
- pagos
- auditoria

## 13. Repositorio

Código fuente del proyecto:

https://github.com/JosePecho/sistema-polleria

## 14. Autoría

Proyecto académico desarrollado para la gestión de pedidos en sala y comandas de una pollería.
