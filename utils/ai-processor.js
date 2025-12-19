// utils/ai-processor.js 

class EnhancedAIProcessor {
    constructor() {
        this.stopWords = new Set([
            'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'ou', 'mais', 
            'dans', 'pour', 'avec', 'est', 'sont', 'était', 'étaient'
        ]);
    }

    analyzeQuestionType(query) {
        const lowerQuery = query.toLowerCase();
        
        const patterns = {
            definition: /(qu['eé]st-ce que|c['eé]est quoi|d[eé]finition|signifie|d[eé]finir)/,
            how: /(comment|faire|r[eé]aliser|mettre en œuvre)/,
            why: /(pourquoi|raison|cause|motif)/,
            what: /(quels? sont|quelles? sont|qu['eé]est|que)/,
            when: /(quand|date|p[eé]riode)/,
            where: /(o[uù]|lieu|endroit)/,
            who: /(qui|personne|individu)/,
            advantages: /(avantages|b[eé]n[eé]fices|points forts)/,
            disadvantages: /(inconv[eé]nients|d[eé]savantages|points faibles)/,
            examples: /(exemples?|cas|illustrations?)/,
            steps: /([eé]tapes?|proc[eé]dure|marche [aà] suivre)/,
            types: /(types?|cat[eé]gories|sortes?)/
        };
        
        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(lowerQuery)) {
                return type;
            }
        }
        
        return 'general';
    }

    extractKeywords(query) {
        const words = query.toLowerCase()
            .replace(/[^\w\sàâäéèêëîïôöùûüç]/g, ' ')
            .split(/\s+/)
            .filter(word => 
                word.length > 3 && 
                !this.stopWords.has(word) &&
                !['quoi', 'comment', 'pourquoi', 'quand', 'où', 'qui'].includes(word)
            );
        
        return [...new Set(words)]; 
    }

    // Trouver les passages les plus pertinents
    findRelevantTextSnippets(fullText, keywords) {
        if (!fullText || fullText.length < 100) return [];
        
        const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const relevantSnippets = [];
        
        sentences.forEach(sentence => {
            const lowerSentence = sentence.toLowerCase();
            let relevance = 0;
            let matchedKeywords = [];
            
            keywords.forEach(keyword => {
                if (lowerSentence.includes(keyword)) {
                    relevance += 2;
                    matchedKeywords.push(keyword);
                }
            });
            
            // Bonus pour les phrases contenant plusieurs mots-clés
            if (matchedKeywords.length > 1) {
                relevance += matchedKeywords.length;
            }
            
            if (sentence.length > 100) {
                relevance += 1;
            }
            
            if (relevance > 0) {
                relevantSnippets.push({
                    text: sentence.trim(),
                    relevance: relevance,
                    keywords: matchedKeywords
                });
            }
        });
        
        // Trier par pertinence et limiter à 3 passages
        return relevantSnippets
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 3)
            .map(s => s.text);
    }

    formatResponse(questionType, snippets, sourceTitle) {
        let response = '';
        let icon = '📖';
        
        switch(questionType) {
            case 'definition':
                icon = '📚';
                response = `${icon} **Définition trouvée** :\n\n`;
                break;
            case 'how':
                icon = '🔧';
                response = `${icon} **Procédure** :\n\n`;
                break;
            case 'why':
                icon = '🤔';
                response = `${icon} **Raisons identifiées** :\n\n`;
                break;
            case 'advantages':
                icon = '✅';
                response = `${icon} **Avantages** :\n\n`;
                break;
            case 'disadvantages':
                icon = '⚠️';
                response = `${icon} **Points à considérer** :\n\n`;
                break;
            case 'examples':
                icon = '📝';
                response = `${icon} **Exemples** :\n\n`;
                break;
            case 'steps':
                icon = '🔢';
                response = `${icon} **Étapes** :\n\n`;
                break;
            case 'types':
                icon = '📋';
                response = `${icon} **Types** :\n\n`;
                break;
            default:
                response = `${icon} **Informations trouvées** :\n\n`;
        }

        if (snippets.length > 0) {
            snippets.forEach((snippet, index) => {
                if (['how', 'steps'].includes(questionType)) {
                    response += `${index + 1}. ${snippet}\n\n`;
                } else if (['advantages', 'disadvantages', 'examples', 'types'].includes(questionType)) {
                    response += `• ${snippet}\n\n`;
                } else {
                    response += `${snippet}\n\n`;
                }
            });
        }
        
        if (sourceTitle) {
            response += `_Source: ${sourceTitle}_`;
        }
        
        return response;
    }

    async processQuestion(query, storageManager) {
        try {
            const memories = await storageManager.getAllMemories();
            
            if (memories.length === 0) {
                return {
                    answer: "📭 Aucun document disponible dans ma mémoire.",
                    knowsAnswer: false,
                    searchQuery: query
                };
            }
            
            // Analyser la question
            const questionType = this.analyzeQuestionType(query);
            const keywords = this.extractKeywords(query);
            
            // Rechercher dans les documents
            let bestResponse = null;
            let bestRelevance = 0;
            
            for (const memory of memories) {
                const text = memory.fullText || memory.excerpt || '';
                const snippets = this.findRelevantTextSnippets(text, keywords);
                
                if (snippets.length > 0) {
                    const relevance = snippets.length * 2 + keywords.length;
                    
                    if (relevance > bestRelevance) {
                        bestRelevance = relevance;
                        bestResponse = this.formatResponse(questionType, snippets, memory.title);
                    }
                }
            }
            
            if (bestResponse && bestRelevance >= 3) {
                return {
                    answer: bestResponse,
                    knowsAnswer: true,
                    searchQuery: null
                };
            } else {
                return {
                    answer: `🤔 Je n'ai pas trouvé d'information spécifique sur "${query}" dans mes documents.\n\nJ'ai analysé ${memories.length} document(s) mais les informations ne semblent pas assez précises.`,
                    knowsAnswer: false,
                    searchQuery: query
                };
            }
            
        } catch (error) {
            console.error('Erreur traitement question:', error);
            return {
                answer: "⚠️ Désolé, une erreur est survenue lors de l'analyse.",
                knowsAnswer: false,
                searchQuery: null
            };
        }
    }
}

const aiProcessor = new EnhancedAIProcessor();