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
        return `https://storage.service/${filePath}`
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
}

export const getStorageService = (): StorageService => {
    // For now, we only have Vercel storage service
    return new VercelStorageService()
}