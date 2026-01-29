import { createBrowserRouter, Navigate } from 'react-router-dom';
import { HomePage, UploadPage, AsyncUploadPage, FilesPage, FileDetailPage, DataTablePage } from '@/pages';
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
                path: 'upload/async',
                element: <AsyncUploadPage />
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
                path: '*',
                element: <Navigate to="/" replace />
            }
        ]
    }
]);