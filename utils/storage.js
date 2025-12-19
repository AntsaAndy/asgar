// Active AI Memory - Storage Utilities
class StorageManager {
    constructor() {
        this.storageKey = 'memories';
        this.settingsKey = 'settings';
    }

    async getAllMemories() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.storageKey], (result) => {
                resolve(result[this.storageKey] || []);
            });
        });
    }

    async getMemoryById(id) {
        const memories = await this.getAllMemories();
        return memories.find(m => m.id === id);
    }

    async addMemory(memory) {
        const memories = await this.getAllMemories();
        
        const isDuplicate = this.checkDuplicate(memories, memory);
        if (isDuplicate) return { success: false, message: 'Déjà existant' };

        memories.unshift(memory);

        const settings = await this.getSettings();
        if (memories.length > settings.maxMemories) {
            memories.length = settings.maxMemories;
        }

        await this.saveMemories(memories);
        return { success: true };
    }

    async deleteMemory(id) {
        const memories = await this.getAllMemories();
        const filtered = memories.filter(m => m.id !== id);
        await this.saveMemories(filtered);
        return { success: true };
    }

    async clearAllMemories() {
        await this.saveMemories([]);
        return { success: true };
    }

    // RECHERCHE AMÉLIORÉE DANS LE TEXTE CACHÉ
    async searchMemories(query) {
        const memories = await this.getAllMemories();
        const lowerQuery = query.toLowerCase();

        return memories.filter(m => 
            (m.title && m.title.toLowerCase().includes(lowerQuery)) ||
            (m.fullText && m.fullText.toLowerCase().includes(lowerQuery)) ||
            (m.domain && m.domain.toLowerCase().includes(lowerQuery))
        );
    }

    async exportMemories() {
        const memories = await this.getAllMemories();
        const dataStr = JSON.stringify(memories, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        return URL.createObjectURL(blob);
    }

    async saveMemories(memories) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.storageKey]: memories }, () => {
                resolve();
            });
        });
    }

    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.settingsKey], (result) => {
                const defaultSettings = { autoCapture: true, maxMemories: 500 };
                resolve(result[this.settingsKey] || defaultSettings);
            });
        });
    }

    checkDuplicate(memories, newMemory) {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        return memories.some(m => 
            m.url === newMemory.url && 
            new Date(m.timestamp).getTime() > fiveMinutesAgo
        );
    }
}

const storageManager = new StorageManager();