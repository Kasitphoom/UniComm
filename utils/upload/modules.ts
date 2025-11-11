import { PutCommandOptions } from '@vercel/blob';

class StorageService {
    uploadFile(file: Buffer, filename: string): Promise<string> {
        // Implementation for uploading file
        return Promise.resolve(`https://storage.service/${filename}`)
    }

    async clientUploadFile(file: Buffer, filename: string, uploadAPIUrl: string): Promise<string> {
        // Implementation for client-side uploading file
        return `https://storage.service/${filename}`
    }

    deleteFile(fileUrl: string): Promise<void> {
        // Implementation for deleting file
        return Promise.resolve()
    }

    async getFileContent(filePath: string): Promise<string> {
        // Implementation for getting file content
        return Promise.resolve('<xml></xml>')
    }
}

class VercelStorageService extends StorageService {
    async uploadFile(file: Buffer, filename: string, overrideOptions?: Partial<PutCommandOptions>): Promise<string> {
        // dynamically import vercel blob storage sdk
        return import('@vercel/blob').then( async ({ put }) => {
            // Infer content type from extension
            const lowered = filename.toLowerCase()
            const contentType = lowered.endsWith('.xml')
                ? 'application/xml; charset=utf-8'
                : lowered.endsWith('.json')
                ? 'application/json; charset=utf-8'
                : 'application/octet-stream'
            const blob = await put(filename, file, {
                access: overrideOptions?.access ?? 'public',
                contentType: overrideOptions?.contentType ?? contentType,
                ...overrideOptions,
            })
            return blob.url
        });
    }

    async clientUploadFile(file: Buffer, filename: string, uploadAPIUrl: string): Promise<string> {
        const { upload } = await import('@vercel/blob/client')

        const blob = await upload(filename, file, { access: 'public', handleUploadUrl: uploadAPIUrl })
        return blob.url
    }

    async getFileContent(filePath: string): Promise<string> {
        const response = await fetch(filePath, { cache: 'no-store' })
        if (!response.ok) {
            throw new Error(`Failed to fetch file content from ${filePath}`)
        }
        const content = await response.text()
        return content
    }
}

export const getStorageService = (): StorageService => {
    // For now, we only have Vercel storage service
    return new VercelStorageService()
}