import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { Ollama, OllamaEmbeddings } from "@langchain/ollama";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import * as pdf from 'pdf-parse';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  
  private model = new Ollama({
    baseUrl: "http://localhost:11434",
    model: "phi3:medium-128k",
    temperature: 0.3,
  });

  private embeddings = new OllamaEmbeddings({ model: "bge-m3" });

  private connectionOptions = {
    postgresConnectionOptions: {
      connectionString: process.env.DATABASE_URL,
    },
    tableName: "english_knowledge",
  };
  async getRelevantContext(query: string) {
  const vectorStore = await PGVectorStore.initialize(this.embeddings, this.connectionOptions) as any;
  const docs = await vectorStore.similaritySearch(query, 5);
  
  return {
    context: docs.map(d => d.pageContent).join("\n\n"),
    sources: [...new Set(docs.map(d => d.metadata.source || "Unknown"))]
  };
}
  async answerQuestion(userQuery: string) {
    try {
      // Ép kiểu any nếu trình biên dịch không nhận diện được phương thức của PGVectorStore
      const vectorStore = await PGVectorStore.initialize(this.embeddings, this.connectionOptions) as any;
      const relevantDocs = await vectorStore.similaritySearch(userQuery, 5);
      
      if (relevantDocs.length === 0) return { answer: "No info found.", sources: [] };

      const contextText = relevantDocs.map(doc => doc.pageContent).join("\n\n");

      const prompt = `Context: ${contextText}\n\nQuestion: ${userQuery}`;

      // Nếu .invoke vẫn đỏ, kiểm tra version @langchain/ollama
      const response = await (this.model as any).invoke(prompt);
      
      return {
        answer: response.trim(),
        sources: [...new Set(relevantDocs.map(d => d.metadata.source))]
      };
    } catch (error) {
      throw new InternalServerErrorException("AI processing failed.");
    }
  }
  async saveKnowledge(text: string, source: string) {
  try {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitText(text);
    const docs = chunks.map(chunk => new Document({
      pageContent: chunk,
      metadata: { source: source }
    }));

    const vectorStore = await PGVectorStore.initialize(this.embeddings, this.connectionOptions) as any;
    await vectorStore.addDocuments(docs);

    return { success: true, chunks: docs.length };
  } catch (error) {
    throw new InternalServerErrorException("Text ingestion failed.");
  }
}
  async processPdf(fileBuffer: Buffer, fileName: string) {
    try {
      const data = await (pdf as any)(fileBuffer);
      
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000, 
        chunkOverlap: 200,
      });
      
      const chunks = await splitter.splitText(data.text);
      const docs = chunks.map(chunk => new Document({
        pageContent: chunk,
        metadata: { source: fileName }
      }));

      const vectorStore = await PGVectorStore.initialize(this.embeddings, this.connectionOptions) as any;
      await vectorStore.addDocuments(docs);

      return { success: true, chunks: docs.length };
    } catch (error) {
      throw new InternalServerErrorException("Ingestion failed.");
    }
  }
}