import { Link } from 'react-router';

export interface BreadcrumbItem {
    label: string;
    to?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
    return (
        <nav aria-label='Breadcrumb' className='text-sm text-gray-500'>
            <ol className='flex items-center gap-1.5 flex-wrap'>
                {items.map((item, index) => (
                    <li key={index} className='flex items-center gap-1.5'>
                        {index > 0 && <span className='text-gray-400'>/</span>}
                        {item.to
                            ? (
                                <Link to={item.to} className='hover:text-gray-700 transition-colors'>
                                    {item.label}
                                </Link>
                            )
                            : <span className='text-gray-900 font-medium'>{item.label}</span>}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
