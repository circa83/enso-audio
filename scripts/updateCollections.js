const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Define paths
const collectionsDir = path.join(__dirname, '../public/collections');
const collectionsFile = path.join(collectionsDir, 'collections.json');

// Function to read existing collections
const readExistingCollections = () => {
    try {
        const data = fs.readFileSync(collectionsFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading collections.json:', err);
        return [];
    }
};

// Function to create a new collection entry
const createCollectionEntry = (folder) => {
    const collectionName = folder.charAt(0).toUpperCase() + folder.slice(1).replace(/-/g, ' ');
    return {
        id: folder,
        name: collectionName,
        description: `A collection of ambient layers for creating ${collectionName.toLowerCase()} soundscapes`,
        coverImage: `/collections/${folder}/cover/${folder}_EnsōAudio_bkcp.png`,
        tracks: [
            {
                id: "layer1",
                title: "Layer 1",
                audioUrl: `/collections/${folder}/Layer_1/drone.mp3`,
                variations: [
                    {
                        id: "layer1-01",
                        title: "Layer 1 Variation 1",
                        audioUrl: `/collections/${folder}/Layer_1/drone_01.mp3`
                    },
                    {
                        id: "layer1-02",
                        title: "Layer 1 Variation 2",
                        audioUrl: `/collections/${folder}/Layer_1/drone_02.mp3`
                    }
                ]
            },
            {
                id: "layer2",
                title: "Layer 2",
                audioUrl: `/collections/${folder}/Layer_2/melody.mp3`,
                variations: [
                    {
                        id: "layer2-01",
                        title: "Layer 2 Variation 1",
                        audioUrl: `/collections/${folder}/Layer_2/melody_01.mp3`
                    }
                ]
            },
            {
                id: "layer3",
                title: "Layer 3",
                audioUrl: `/collections/${folder}/Layer_3/rhythm.mp3`,
                variations: [
                    {
                        id: "layer3-01",
                        title: "Layer 3 Variation 1",
                        audioUrl: `/collections/${folder}/Layer_3/rhythm_01.mp3`
                    }
                ]
            },
            {
                id: "layer4",
                title: "Layer 4",
                audioUrl: `/collections/${folder}/Layer_4/nature.mp3`
            }
        ],
        metadata: {
            artist: "Ensō Audio",
            year: new Date().getFullYear(),
            tags: ["ambient", "meditation", "peaceful", "soundscape"]
        }
    };
};

// Function to check if a directory exists
const directoryExists = (path) => {
    try {
        return fs.statSync(path).isDirectory();
    } catch (err) {
        return false;
    }
};

// Function to update collections.json
const updateCollectionsJson = () => {
    fs.readdir(collectionsDir, (err, files) => {
        if (err) {
            console.error('Error reading collections directory:', err);
            return;
        }

        // Get existing collections
        const existingCollections = readExistingCollections();
        const existingIds = new Set(existingCollections.map(c => c.id));

        // Filter out non-directories and the collections.json file
        const collectionFolders = files
            .filter(file => {
                const fullPath = path.join(collectionsDir, file);
                return fs.statSync(fullPath).isDirectory() && file !== 'collections.json';
            });

        // Create a map of existing collections for easy lookup
        const existingCollectionsMap = new Map(
            existingCollections.map(collection => [collection.id, collection])
        );

        // Process all collection folders
        const updatedCollections = collectionFolders.map(folder => {
            // If the collection exists, keep its data
            if (existingCollectionsMap.has(folder)) {
                return existingCollectionsMap.get(folder);
            }
            // If it's a new collection, create a new entry
            return createCollectionEntry(folder);
        });

        // Write the updated collections to the JSON file
        fs.writeFile(collectionsFile, JSON.stringify(updatedCollections, null, 2), (err) => {
            if (err) {
                console.error('Error writing to collections.json:', err);
                return;
            }
            console.log('✅ collections.json has been updated!');
            
            // Log which collections were added or updated
            const newCollections = collectionFolders.filter(folder => !existingIds.has(folder));
            if (newCollections.length > 0) {
                console.log('📁 Added new collections:', newCollections.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', '));
            }
        });
    });
};

// Initial update
console.log('🔄 Initializing collections.json...');
updateCollectionsJson();

// Watch the collections directory for changes
console.log('👀 Watching collections directory for changes...');
chokidar.watch(collectionsDir, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
    }
})
    .on('addDir', (path) => {
        console.log(`📂 New folder added: ${path}`);
        updateCollectionsJson();
    })
    .on('change', (path) => {
        console.log(`🔄 File changed: ${path}`);
        updateCollectionsJson();
    })
    .on('unlink', (path) => {
        console.log(`🗑️ File removed: ${path}`);
        updateCollectionsJson();
    })
    .on('unlinkDir', (path) => {
        console.log(`🗑️ Directory removed: ${path}`);
        updateCollectionsJson();
    })
    .on('error', (error) => {
        console.error('❌ Watcher error:', error);
    });

console.log('🚀 Collections watcher is now running. Press Ctrl+C to stop.'); 