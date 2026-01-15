import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TableProps {
    children: React.ReactNode;
    className?: string;
}

export function Table({ children, className }: TableProps) {
    return (
        <div className={cn('w-full overflow-auto', className)}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                {children}
            </table>
        </div>
    );
}

export interface TableHeaderProps {
    children: React.ReactNode;
    className?: string;
}

export function TableHeader({ children, className }: TableHeaderProps) {
    return (
        <thead className={cn('bg-gray-50 dark:bg-gray-900', className)}>
            <tr>
                {children}
            </tr>
        </thead>
    );
}

export interface TableBodyProps {
    children: React.ReactNode;
    className?: string;
}

export function TableBody({ children, className }: TableBodyProps) {
    return (
        <tbody className={cn('divide-y divide-gray-200 dark:divide-gray-700', className)}>
            {children}
        </tbody>
    );
}

export interface TableRowProps {
    children: React.ReactNode;
    className?: string;
}

export function TableRow({ children, className }: TableRowProps) {
    return (
        <tr className={cn('hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors', className)}>
            {children}
        </tr>
    );
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
    children: React.ReactNode;
    className?: string;
}

export function TableCell({ children, className, ...props }: TableCellProps) {
    return (
        <td className={cn('px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100', className)} {...props}>
            {children}
        </td>
    );
}

export interface TableHeadProps {
    children: React.ReactNode;
    className?: string;
}

export function TableHead({ children, className }: TableHeadProps) {
    return (
        <th className={cn('px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider', className)}>
            {children}
        </th>
    );
}
