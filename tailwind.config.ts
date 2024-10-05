import { fontFamily as _fontFamily } from 'tailwindcss/defaultTheme';

export const content = ['./apps/data-grid/**/*.{html,ts}', './packages/**/*.{html,ts}'];
export const theme = {
    container: {
        center: true,
        padding: '2rem',
        screens: {
            '2xl': '1400px'
        }
    },
    screens: {
        xs: '0px',
        sm: '576px',
        md: '768px',
        lg: '992px',
        xl: '1200px',
        '2xl': '1400px',
        '3xl': '1600px',
        '4xl': '2000px',
        '5xl': '2400px',
        '6xl': '3000px'
    },
    extend: {},
    fontFamily: {
        ..._fontFamily
    }
};
export const plugins = [];
