import { createBrowserRouter, Navigate } from 'react-router-dom';
<<<<<<< HEAD
import { HomePage, UploadPage, FilesPage, FileDetailPage, DataTablePage, RuleConfigPage } from '@/pages';
=======
import { HomePage, UploadPage, FilesPage, FileDetailPage, DataTablePage } from '@/pages';
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
import { Layout } from '@/components/layout';

/**
 * 应用路由配置
 */
export const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                index: true,
                element: <HomePage />
            },
            {
                path: 'upload',
                element: <UploadPage />
            },
            {
                path: 'files',
                element: <FilesPage />
            },
            {
                path: 'files/:fileId',
                element: <FileDetailPage />
            },
            {
                path: 'data-table/:jobId',
                element: <DataTablePage />
            },
            {
<<<<<<< HEAD
                path: 'rule-config',
                element: <RuleConfigPage />
            },
            {
=======
>>>>>>> ab86e763c74c7b40cbdb2a6db4337c0e9dcaa40a
                path: '*',
                element: <Navigate to="/" replace />
            }
        ]
    }
]);