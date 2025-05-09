import type { Track } from '$lib/types/track';

// Enhanced tracks with metadata for therapy/ambient use
export const musicLibrary: Track[] = [
  {
    id: '1',
    title: 'Stillness',
    artist: 'Brock Cooper',
    src: '/audio/February2(short)_2025.mp3',
    artwork: '/images/Stillness_EnsoAudio_bkcp.png',
    metadata: {
      genre: ['ambient', 'meditation'],
      mood: ['calm', 'peaceful', 'serene'],
      tags: ['morning', 'focus', 'mindfulness'],
      bpm: 60,
      key: 'C major',
      collection: 'Therapeutic Soundscapes',
      year: 2025,
      description: 'A gentle ambient piece designed for meditation and relaxation',
      therapyType: ['meditation', 'mindfulness', 'stress-relief']
    },
    searchableText: 'stillness brock cooper ambient meditation calm peaceful morning focus',
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-02-01')
  },
  {
    id: '2',
    title: 'Breathe',
    artist: 'Brock Cooper',
    src: '/audio/March4(short)_2025.mp3',
    artwork: '/images/Breathe_EnsoAudio_bkcp.png',
    metadata: {
      genre: ['ambient', 'breathwork'],
      mood: ['relaxing', 'flowing', 'gentle'],
      tags: ['breathing', 'yoga', 'pranayama'],
      bpm: 48,
      key: 'F major',
      collection: 'Breathwork Sessions',
      year: 2025,
      description: 'Rhythmic ambient track synchronized with breathing patterns',
      therapyType: ['breathwork', 'yoga', 'anxiety-relief']
    },
    searchableText: 'breathe brock cooper ambient breathwork relaxing yoga breathing',
    createdAt: new Date('2025-03-04'),
    updatedAt: new Date('2025-03-04')
  },
  {
    id: '3',
    title: 'Eclipse',
    artist: 'Brock Cooper',
    src: '/audio/March5(short)_2025.mp3',
    artwork: '/images/Eclipse_EnsoAudio_bkcp.png',
    metadata: {
      genre: ['ambient', 'drone'],
      mood: ['mysterious', 'contemplative', 'deep'],
      tags: ['night', 'introspection', 'shadow-work'],
      bpm: 40,
      key: 'A minor',
      collection: 'Deep Listening',
      year: 2025,
      description: 'Deep ambient exploration for introspective therapy sessions',
      therapyType: ['deep-therapy', 'shadow-work', 'introspection']
    },
    searchableText: 'eclipse brock cooper ambient drone mysterious contemplative night',
    createdAt: new Date('2025-03-05'),
    updatedAt: new Date('2025-03-05')
  },
  {
    id: '4',
    title: 'Empower',
    artist: 'Brock Cooper',
    src: '/audio/March9(short)_2025.mp3',
    artwork: '/images/Empower_EnsoAudio_bkcp.png',
    metadata: {
      genre: ['ambient', 'motivational'],
      mood: ['uplifting', 'energizing', 'confident'],
      tags: ['motivation', 'empowerment', 'morning-routine'],
      bpm: 72,
      key: 'G major',
      collection: 'Empowerment Series',
      year: 2025,
      description: 'Uplifting ambient track for building confidence and motivation',
      therapyType: ['empowerment', 'confidence-building', 'morning-therapy']
    },
    searchableText: 'empower brock cooper ambient motivational uplifting energizing confidence',
    createdAt: new Date('2025-03-09'),
    updatedAt: new Date('2025-03-09')
  },
  {
    id: '5',
    title: 'Elevate',
    artist: 'Brock Cooper',
    src: '/audio/March9(short)a_2025.mp3',
    artwork: '/images/Elevate_EnsoAudio_bkcp.png',
    metadata: {
      genre: ['ambient', 'spiritual'],
      mood: ['transcendent', 'ethereal', 'uplifting'],
      tags: ['spiritual', 'elevation', 'consciousness'],
      bpm: 66,
      key: 'D major',
      collection: 'Spiritual Journey',
      year: 2025,
      description: 'Ethereal soundscape for spiritual practices and elevation of consciousness',
      therapyType: ['spiritual-therapy', 'consciousness-work', 'transcendence']
    },
    searchableText: 'elevate brock cooper ambient spiritual transcendent ethereal consciousness',
    createdAt: new Date('2025-03-09'),
    updatedAt: new Date('2025-03-09')
  }
];