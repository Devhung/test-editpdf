import { addMessages, init, getLocaleFromNavigator, _ } from 'svelte-i18n';

// Import translations
import en from './en.json';
import vi from './vi.json';
import de from './de.json';
import fr from './fr.json';
import frCA from './fr-CA.json';
import es from './es.json';
import pt from './pt.json';

// Register translations
addMessages('en', en);
addMessages('vi', vi);
addMessages('de', de);
addMessages('fr', fr);
addMessages('fr-CA', frCA);
addMessages('es', es);
addMessages('pt', pt);

// Initialize i18n with default settings
init({
    fallbackLocale: 'en',
    initialLocale: 'en'
});

// Function to change language
export function changeLanguage(locale) {
    init({
        fallbackLocale: 'en',
        initialLocale: locale
    });
}

export { _ }; 