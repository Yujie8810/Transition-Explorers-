// Shared design values keep all teammates’ screens visually consistent.
// Aalvee maintains these values; coordinate changes before editing them.
export const theme = {
  colors: {
    background: '#F7F4EB', surface: '#FFFFFF', ink: '#192E2B',
    muted: '#63736C', green: '#234F43', lime: '#DEED9D',
    orange: '#FA6935', danger: '#B42318', border: '#DEDCD3',
  },
  spacing: { sm: 8, md: 16, lg: 24, xl: 32 },
} as const;
