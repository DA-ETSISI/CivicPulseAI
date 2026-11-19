import { useEffect, useState } from 'react';

function initialTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* almacenamiento no disponible */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let animTimer;

/** Modo claro/oscuro. Se guarda en el navegador y anima el cambio de colores. */
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [theme]);

  const toggle = () => {
    const root = document.documentElement;
    root.classList.add('theme-anim');
    clearTimeout(animTimer);
    animTimer = setTimeout(() => root.classList.remove('theme-anim'), 600);
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  return [theme, toggle];
}
