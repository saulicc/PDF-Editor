# Sello y Foliador Vectorial PDF

Herramienta profesional de procesamiento de documentos PDF: estampado vectorial de sellos oficiales y foliado secuencial en una única pasada, fusión, reorganización, eliminación de hojas y división por rangos.

## 🚀 Despliegue en Vercel (con GitHub)

Este proyecto está 100% optimizado y listo para desplegar en **Vercel** sincronizado con tu repositorio de **GitHub**.

### Pasos para desplegar:

1. **Subir el código a GitHub:**
   - Creá un repositorio en GitHub (público o privado).
   - Hacé `git push` de tu proyecto a la rama `main` o `master`.

2. **Conectar en Vercel:**
   - Entrá a [vercel.com](https://vercel.com) e iniciá sesión con tu cuenta de GitHub.
   - Hacé clic en **"Add New..."** → **"Project"**.
   - Seleccioná tu repositorio de GitHub y hacé clic en **"Import"**.

3. **Configuración del proyecto en Vercel (automática):**
   Gracias al archivo `vercel.json` incluido en el proyecto, Vercel detecta automáticamente la configuración:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

4. **Hacé clic en "Deploy"**:
   - Vercel compilará la aplicación en segundos.
   - Cada vez que hagas `git push` a tu rama de GitHub, Vercel desplegará automáticamente la nueva versión.

---

## 💻 Ejecución en local

**Requisitos:** Node.js (v18 o superior) y npm.

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

3. Compilar para producción localmente:
   ```bash
   npm run build
   npm run preview
   ```
