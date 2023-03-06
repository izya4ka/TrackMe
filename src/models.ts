export interface Track {
    name: string,
    track: string
    added: Date,
}

interface Settings {
    language: string
}

interface States {
    addTrack: boolean,
    setLang: boolean,
}

export interface User {
    id: number,
    tracks: Track[],
    settings: Settings,
    states: States,
}