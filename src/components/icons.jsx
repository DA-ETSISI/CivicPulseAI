/** Iconos de la interfaz: mismo trazo (1.8) y misma caja (20×20) para que se vean de la misma familia. */
function Icon({ children, size = 18, ...rest }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconPlus = (p) => (
  <Icon {...p}>
    <path d="M10 4.5v11M4.5 10h11" />
  </Icon>
);

export const IconMinus = (p) => (
  <Icon {...p}>
    <path d="M4.5 10h11" />
  </Icon>
);

/** Volver a la vista completa: un marco con las esquinas abiertas. */
export const IconFit = (p) => (
  <Icon {...p}>
    <path d="M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4" />
  </Icon>
);

export const IconArrowLeft = (p) => (
  <Icon {...p}>
    <path d="M16 10H4.5M9 5.5 4.5 10 9 14.5" />
  </Icon>
);

export const IconChevron = (p) => (
  <Icon {...p}>
    <path d="m7.5 5 5 5-5 5" />
  </Icon>
);

export const IconSearch = (p) => (
  <Icon {...p}>
    <circle cx="8.75" cy="8.75" r="5.25" />
    <path d="m12.75 12.75 3.75 3.75" />
  </Icon>
);

/** Aviso: triángulo con exclamación. */
export const IconAlert = (p) => (
  <Icon {...p}>
    <path d="M10 3.2 17.4 16a.9.9 0 0 1-.8 1.3H3.4a.9.9 0 0 1-.8-1.3L10 3.2Z" />
    <path d="M10 8.2v3.6M10 14.4v.1" />
  </Icon>
);
