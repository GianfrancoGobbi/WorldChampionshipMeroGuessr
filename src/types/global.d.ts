// Extiende la interfaz Window para incluir la variable global de Google
declare global {
  interface Window {
    google: typeof google;
  }
}

export {};
