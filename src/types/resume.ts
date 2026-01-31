export type ResumeJSON = {
    personal: {
        name: string
        email?: string
        phone?: string
        location?: string
        links?: {
            label: string
            url: string
        }[]
    }

    summary?: string

    experience: {
        company: string
        role: string
        location?: string
        startDate: string
        endDate?: string
        bullets: string[]
    }[]

    education: {
        institution: string
        degree: string
        startDate?: string
        endDate?: string
        bullets?: string[]
    }[]

    projects?: {
        name: string
        link?: string
        bullets: string[]
    }[]

    skills: {
        category: string
        items: string[]
    }[]

    certifications?: {
        name: string
        date?: string
        issuer?: string
        url?: string
    }[]

    achievements?: string[]
}
