import { eq } from 'drizzle-orm';
import { Form, Link } from 'react-router';
import type { Route } from './+types/settings';
import { requireMember } from '~/auth/auth.server';
import { database } from '~/database/context';
import * as schema from '~/database/schema';

export function meta() {
    return [ { title: 'Settings - Sankey Scenarios' } ];
}

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireMember(request);

    const db = database();
    const dbUser = await db.query.users.findFirst({
        where: eq(schema.users.id, user.id),
        columns: {
            displayLocale: true,
            regionalLocale: true
        }
    });

    return {
        displayLocale: dbUser?.displayLocale ?? '',
        regionalLocale: dbUser?.regionalLocale ?? ''
    };
}

export async function action({ request }: Route.ActionArgs) {
    const user = await requireMember(request);
    const formData = await request.formData();

    const displayLocale = formData.get('displayLocale')?.toString() || null;
    const regionalLocale = formData.get('regionalLocale')?.toString() || null;

    const db = database();
    await db.update(schema.users).set({
        displayLocale,
        regionalLocale
    }).where(eq(schema.users.id, user.id));

    return { success: true };
}

const COMMON_LOCALES = [
    { value: '', label: 'Browser default' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'de-DE', label: 'German (Germany)' },
    { value: 'de-AT', label: 'German (Austria)' },
    { value: 'de-CH', label: 'German (Switzerland)' },
    { value: 'fr-FR', label: 'French (France)' },
    { value: 'fr-CH', label: 'French (Switzerland)' },
    { value: 'es-ES', label: 'Spanish (Spain)' },
    { value: 'it-IT', label: 'Italian (Italy)' },
    { value: 'nl-NL', label: 'Dutch (Netherlands)' },
    { value: 'pl-PL', label: 'Polish (Poland)' },
    { value: 'pt-PT', label: 'Portuguese (Portugal)' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)' },
];

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
    const { displayLocale, regionalLocale } = loaderData;

    // Get a sample number format for the current regional locale
    const getSampleNumber = (locale: string) => {
        try {
            return new Intl.NumberFormat(locale || undefined).format(1234567.89);
        } catch {
            return '1,234,567.89';
        }
    };

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8'>
                    <Link to='/' className='text-sm text-gray-500 hover:text-gray-700'>← Back</Link>
                    <h1 className='text-3xl font-bold text-gray-900 mt-2'>Settings</h1>
                </div>
            </header>

            <main className='max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                <div className='bg-white rounded-lg shadow p-6'>
                    <h2 className='text-lg font-semibold text-gray-900 mb-4'>Regional Settings</h2>

                    {actionData?.success && (
                        <div className='mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm'>
                            Settings saved successfully.
                        </div>
                    )}

                    <Form method='post' className='space-y-6'>
                        <div>
                            <label htmlFor='displayLocale' className='block text-sm font-medium text-gray-700 mb-1'>
                                Display Language
                            </label>
                            <p className='text-xs text-gray-500 mb-2'>Used for UI text (future feature).</p>
                            <select
                                id='displayLocale'
                                name='displayLocale'
                                defaultValue={displayLocale}
                                className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            >
                                {COMMON_LOCALES.map(locale => (
                                    <option key={locale.value} value={locale.value}>{locale.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor='regionalLocale' className='block text-sm font-medium text-gray-700 mb-1'>
                                Regional Format
                            </label>
                            <p className='text-xs text-gray-500 mb-2'>
                                Used for number formatting. Sample: {getSampleNumber(regionalLocale)}
                            </p>
                            <select
                                id='regionalLocale'
                                name='regionalLocale'
                                defaultValue={regionalLocale}
                                className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            >
                                {COMMON_LOCALES.map(locale => (
                                    <option key={locale.value} value={locale.value}>
                                        {locale.label}
                                        {locale.value && ` — ${getSampleNumber(locale.value)}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className='pt-4'>
                            <button
                                type='submit'
                                className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium'
                            >
                                Save Settings
                            </button>
                        </div>
                    </Form>
                </div>
            </main>
        </div>
    );
}
