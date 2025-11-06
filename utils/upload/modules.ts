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

    getFileUrl(filePath: string): string {
        // If it's already an absolute URL, return as-is
        if (/^https?:\/\//i.test(filePath)) return filePath
        // Prefer configured base URL when provided
        const base = process.env.STORAGE_BASE_URL
        if (base) {
            const normalizedBase = base.endsWith('/') ? base : base + '/'
            const normalizedPath = filePath.replace(/^\/+/, '')
            return new URL(normalizedPath, normalizedBase).toString()
        }
        // Fallback (dev placeholder)
        return `https://storage.service/${filePath}`
    }

    async getFileContent(filePath: string): Promise<string> {
        // Implementation for getting file content
        return Promise.resolve('<xml></xml>')
    }
}

class VercelStorageService extends StorageService {
    uploadFile(file: Buffer, filename: string): Promise<string> {
        // dynamically import vercel blob storage sdk
        return import('@vercel/blob').then( async ({ put }) => {
            const blob = await put(filename, file, { access: 'public', allowOverwrite: true })
            return blob.url
        });
    }

    async clientUploadFile(file: Buffer, filename: string, uploadAPIUrl: string): Promise<string> {
        const { upload } = await import('@vercel/blob/client')

        const blob = await upload(filename, file, { access: 'public', handleUploadUrl: uploadAPIUrl })
        return blob.url
    }

    async getFileContent(filePath: string): Promise<string> {
        const fileUrl = this.getFileUrl(filePath)
        const response = await fetch(fileUrl)
        if (!response.ok) {
            throw new Error(`Failed to fetch file content from ${fileUrl}`)
        }
        return response.text()
    }
}

export const getStorageService = (): StorageService => {
    // For now, we only have Vercel storage service
    return new VercelStorageService()
}