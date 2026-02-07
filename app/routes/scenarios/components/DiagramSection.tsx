import { useState, useRef, useEffect } from 'react';
import { SankeyDiagram } from '../../../components/sankey';

export function DiagramSection({ resolvedConnections }: {
    resolvedConnections: Array<{
        source: string;
        target: string;
        value: number;
        color?: string;
        sourceDisplayName?: string;
        targetDisplayName?: string;
        sourceNodeColor?: string;
        targetNodeColor?: string;
    }>;
}) {
    const [ isExpanded, setIsExpanded ] = useState(true);
    const [ height, setHeight ] = useState(500);
    const [ isResizing, setIsResizing ] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        if (!isResizing) {
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) {
                return;
            }
            const rect = containerRef.current.getBoundingClientRect();
            const newHeight = Math.max(200, Math.min(1200, e.clientY - rect.top));
            setHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [ isResizing ]);

    if (resolvedConnections.length === 0) {
        return (
            <section className='bg-white rounded-lg shadow p-6 mb-8'>
                <div className='bg-gray-100 rounded-lg h-64 flex items-center justify-center'>
                    <p className='text-gray-500'>No connections yet. Add connections below.</p>
                </div>
            </section>
        );
    }

    // When expanded, break out of the max-w-7xl container to use full viewport width
    const wrapperClasses = isExpanded ? 'relative -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-8' : 'mb-8';

    return (
        <div
            className={wrapperClasses}
            style={isExpanded ? { width: 'calc(100vw - 2rem)', marginLeft: 'calc(-50vw + 50% + 1rem)' } : undefined}
        >
            <section className='bg-white rounded-lg shadow p-6 relative'>
                <div className='flex justify-end mb-2'>
                    <button
                        type='button'
                        onClick={() => setIsExpanded(!isExpanded)}
                        className='p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors'
                        title={isExpanded ? 'Collapse to normal width' : 'Expand to full width'}
                    >
                        {isExpanded
                            ? (
                                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        strokeWidth={2}
                                        d='M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25'
                                    />
                                </svg>
                            )
                            : (
                                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        strokeWidth={2}
                                        d='M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15'
                                    />
                                </svg>
                            )}
                    </button>
                </div>
                <div ref={containerRef} style={{ height }} className='relative'>
                    <SankeyDiagram
                        flows={resolvedConnections.map(conn => ({
                            source: conn.source,
                            target: conn.target,
                            value: conn.value,
                            color: conn.color,
                            sourceDisplayName: conn.sourceDisplayName,
                            targetDisplayName: conn.targetDisplayName,
                            sourceNodeColor: conn.sourceNodeColor,
                            targetNodeColor: conn.targetNodeColor
                        }))}
                        config={{
                            height,
                            nodeWidth: 10,
                            nodeHeightFactor: 50,
                            nodeSpacingFactor: 85,
                            flowCurvature: 0.5,
                            nodeOpacity: 0.9,
                            flowOpacity: 0.45,
                            flowColorMode: 'source',
                            layoutOrder: 'exact',
                            margin: { top: 20, right: 150, bottom: 20, left: 150 },
                            labels: {
                                show: true,
                                showValues: true,
                                fontSize: 12,
                                highlightOpacity: 0.75
                            }
                        }}
                        className='w-full h-full'
                    />
                </div>
                {/* Resize handle */}
                <div
                    onMouseDown={handleMouseDown}
                    className={`absolute left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center ${
                        isResizing ? 'bg-blue-100' : 'hover:bg-gray-100'
                    }`}
                    style={{ bottom: 0 }}
                >
                    <div className='w-12 h-1 bg-gray-300 rounded-full' />
                </div>
            </section>
        </div>
    );
}
