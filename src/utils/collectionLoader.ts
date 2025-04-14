import { Collection } from '../models/Collection';

export async function loadCollections(): Promise<Collection[]> {
  try {
    const response = await fetch('/collections/collections.json');
    if (!response.ok) {
      throw new Error('Failed to load collections');
    }
    const collections = await response.json();
    return collections;
  } catch (error) {
    console.error('Error loading collections:', error);
    return [];
  }
}

export async function loadCollectionMetadata(collectionId: string): Promise<Collection | null> {
  try {
    const response = await fetch(`/collections/${collectionId}/metadata.json`);
    if (!response.ok) {
      throw new Error(`Failed to load metadata for collection ${collectionId}`);
    }
    const metadata = await response.json();
    return metadata;
  } catch (error) {
    console.error(`Error loading metadata for collection ${collectionId}:`, error);
    return null;
  }
} 